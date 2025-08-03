import { Express } from "express";
import Framework from "../../platform";
import { Context, createContext, CtxReq } from "../../types";
import { AccountsDefinition, AccountsType } from "./entities/accounts";
import {
  checkAuthenticated,
  registerAccountRegisterRoutes,
} from "./services/register";
import { plansConfigurations } from "../billing/services/credit-updater";

export const registerAccountRoutes = async (app: Express) => {
  await registerAccountRegisterRoutes(app);

  const db = await Framework.Db.getService();
  await db.createTable(AccountsDefinition);

  // Send discount / feedback tracks
  Framework.Cron.schedule(
    "send-discount-emails",
    "0 * * * *",
    async (ctx) => {
      const db = await Framework.Db.getService();

      // Free tracks
      const freeTracks = {
        free_track_1_free_preview: { order: 0, delay: 3 * 60 * 60 * 1000 },
        free_track_2_30_percent_off: { order: 1, delay: 21 * 60 * 60 * 1000 }, // 24-3h
        free_track_3_extended_discount: {
          order: 2,
          delay: 48 * 60 * 60 * 1000,
        },
        free_track_4_feedback_request: {
          order: 3,
          delay: 5 * 24 * 60 * 60 * 1000,
        },
      };

      for (const [track, { order, delay }] of Object.entries(freeTracks).sort(
        (a, b) => a[1].order - b[1].order
      )) {
        const accounts = await db.select<AccountsType>(
          ctx,
          AccountsDefinition.name,
          {
            where:
              "plan = 'free' AND sent_discount_email = $1 AND created_at < $2 AND last_discount_email < $3 AND unsubscribed_discount_email = false",
            values: [order, Date.now() - delay, Date.now() - delay],
          },
          { limit: 50 }
        );
        for (const account of accounts) {
          ctx = { ...ctx, lang: account.lang };
          await Framework.PushEMail.push(
            ctx,
            account.email,
            Framework.I18n.t(ctx, "emails." + track + ".body", {
              replacements: [account.name],
            }),
            {
              subject: Framework.I18n.t(ctx, "emails." + track + ".title"),
              allow_unsubscribe: true, // Allow users to unsubscribe from these emails
            }
          );
          await db.update<AccountsType>(
            ctx,
            AccountsDefinition.name,
            { id: account.id },
            {
              sent_discount_email: order + 1,
              last_discount_email: Date.now(),
            }
          );
        }
      }

      // Paid tracks
      const paidTracks = {
        paid_track_1_feedback: {
          order: 100,
          delay: 3 * 24 * 60 * 60 * 1000,
        },
      };

      for (const [track, { order, delay }] of Object.entries(paidTracks).sort(
        (a, b) => a[1].order - b[1].order
      )) {
        const accounts = await db.select<AccountsType>(
          ctx,
          AccountsDefinition.name,
          {
            where:
              "plan != 'free' AND (sent_discount_email = $1 OR sent_discount_email < 100) AND created_at < $2 AND last_discount_email < $3 AND unsubscribed_discount_email = false",
            values: [order, Date.now() - delay, Date.now() - delay],
          },
          { limit: 50 }
        );
        for (const account of accounts) {
          ctx = { ...ctx, lang: account.lang };
          await Framework.PushEMail.push(
            ctx,
            account.email,
            Framework.I18n.t(ctx, "emails." + track + ".body", {
              replacements: [account.name],
            }),
            {
              subject: Framework.I18n.t(ctx, "emails." + track + ".title"),
              allow_unsubscribe: true, // Allow users to unsubscribe from these emails
            }
          );
          await db.update<AccountsType>(
            ctx,
            AccountsDefinition.name,
            { id: account.id },
            {
              sent_discount_email: Math.max(100, order + 1), // Ensure we don't go below 100 to avoid loops
              last_discount_email: Date.now(),
            }
          );
        }
      }
    },
    true
  );

  app.get("/api/auth/me", checkAuthenticated, async (req: CtxReq, res) => {
    const ctx = req.ctx;
    if (!req.user.id) return res.sendStatus(401);
    let me = await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
      id: req.user.id,
    });

    res.json({
      ...me,
      plan_credits: plansConfigurations[me.plan]?.monthly_credits || 0,
    });
  });

  app.get("/api/auth/unsubscribe", async (req: CtxReq, res) => {
    const db = await Framework.Db.getService();
    const email = req.query.email as string;
    if (!email) return res.sendStatus(400);
    if (!email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/))
      return res.send(
        "We were unable to unsubscribe you, this email is not valid."
      );
    await db.update<AccountsType>(
      createContext(),
      AccountsDefinition.name,
      { email },
      { unsubscribed_discount_email: true }
    );
    return res.send(
      "You have been successfully unsubscribed from our onboarding emails."
    );
  });

  // Add a POST endpoint to update user consent and data
  app.post("/api/auth/me", checkAuthenticated, async (req: CtxReq, res) => {
    const ctx = req.ctx;
    if (!req.user.id) return res.sendStatus(401);

    const user = await db.selectOne<AccountsType>(
      ctx,
      AccountsDefinition.name,
      {
        id: req.user.id,
      }
    );

    if (!user) return res.sendStatus(404);

    const updates: Partial<AccountsType> = {};

    // Handle consent update
    if (req.body.consent !== undefined) {
      updates.consent = req.body.consent;
    }

    // Handle analytics update
    if (req.body.analytics !== undefined) {
      updates.analytics = req.body.analytics;
    }

    // Handle models, styles, and images consent
    if (req.body.models && typeof req.body.models === "string") {
      const updatedModels = [...(user.consent_usage?.models || [])];
      if (!updatedModels.includes(req.body.models)) {
        updatedModels.push(req.body.models);
      }
      updates.consent_usage = {
        ...((user.consent_usage || {}) as any),
        models: updatedModels,
      };
    }

    if (req.body.styles && typeof req.body.styles === "string") {
      const updatedStyles = [...(user.consent_usage?.styles || [])];
      if (!updatedStyles.includes(req.body.styles)) {
        updatedStyles.push(req.body.styles);
      }
      updates.consent_usage = {
        ...((user.consent_usage || {}) as any),
        styles: updatedStyles,
      };
    }

    if (req.body.images && typeof req.body.images === "string") {
      const updatedImages = [...(user.consent_usage?.images || [])];
      if (!updatedImages.includes(req.body.images)) {
        updatedImages.push(req.body.images);
      }
      updates.consent_usage = {
        ...((user.consent_usage || {}) as any),
        images: updatedImages,
      };
    }

    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      await db.update<AccountsType>(
        ctx,
        AccountsDefinition.name,
        { id: user.id },
        updates
      );
    }

    // Return the updated user
    const updatedUser = await db.selectOne<AccountsType>(
      ctx,
      AccountsDefinition.name,
      {
        id: req.user.id,
      }
    );

    res.json(updatedUser);
  });

  app.get("/api/debug/email", async (req: CtxReq, res) => {
    let ctx = createContext();
    ctx = { ...ctx, lang: req.query.lang as any };
    const type = req.query.type as string;
    await Framework.PushEMail.push(
      ctx,
      "romaric.mollard@gmail.com",
      Framework.I18n.t(ctx, "emails." + type + ".body", {
        replacements: [
          (req.query.name as string) || "Test User",
          (req.query.model as string) || "Test Model",
        ],
      }),
      {
        subject: Framework.I18n.t(ctx, "emails." + type + ".title"),
        allow_unsubscribe: true, // Allow users to unsubscribe from these emails
      }
    );
    res.json({
      message: "Email sent successfully",
    });
  });
};

export const useCredits = async (ctx: Context, credits: number) => {
  const db = await Framework.Db.getService();
  const user = await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
    id: ctx.id,
  });
  if (!user || !ctx.id) throw new Error("User not found to remove credits");
  if (credits > 0 && user.credits < credits)
    throw new Error(
      "Not enough credits, you have " + user.credits + " but need " + credits
    );
  await db.update<AccountsType>(
    ctx,
    AccountsDefinition.name,
    { id: ctx.id },
    {
      credits: Math.max(0, user.credits - credits),
      credits_used: user.credits_used + credits,
    }
  );

  await Framework.Socket.publishPrivate(ctx, user.id, "credits", {
    credits: user.credits - credits,
  });
};
