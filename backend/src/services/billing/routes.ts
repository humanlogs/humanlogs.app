import { captureException } from "@sentry/node";
import config from "config";
import { Express } from "express";
import Stripe from "stripe";
import { CtxReq } from "../../types";
import { generateStripeCheckoutSession, stripeHook } from "./services/stripe";
import { appleHook } from "./services/apple";
import { checkAuthenticated } from "../account/services/register";

export const stripe = new Stripe(config.get("stripe.secret"), {
  apiVersion: "2025-07-30.basil",
});

export const registerBillingRoutes = async (app: Express) => {
  app.post("/api/billing/webhook/stripe", async (req: CtxReq, res) => {
    const ctx = req.ctx;
    const sig = req.headers["stripe-signature"];
    try {
      await stripeHook(ctx, sig as string, req);
      // Return a 200 response to acknowledge receipt of the event
      res.send();
    } catch (err) {
      captureException(err);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  });

  app.post("/api/billing/webhook/apple", async (req: CtxReq, res) => {
    const ctx = req.ctx;
    try {
      await appleHook(ctx, req);
      // Return a 200 response to acknowledge receipt of the event
      res.send();
    } catch (err) {
      captureException(err);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  });

  // Add a new route for creating checkout sessions
  app.post(
    "/api/billing/checkout",
    checkAuthenticated,
    async (req: CtxReq, res) => {
      const ctx = req.ctx;
      try {
        const { plan, interval } = req.body;

        if (
          !plan ||
          !["basic", "essential", "advanced", "business"].includes(plan)
        ) {
          return res.status(400).send({ error: "Invalid plan" });
        }

        if (!interval || !["month", "year"].includes(interval)) {
          return res.status(400).send({ error: "Invalid interval" });
        }

        const checkoutUrl = await generateStripeCheckoutSession(
          ctx,
          plan,
          interval
        );

        res.send({ url: checkoutUrl });
      } catch (err) {
        captureException(err);
        res
          .status(500)
          .send({ error: `Error creating checkout session: ${err.message}` });
      }
    }
  );

  // Add a GET endpoint for direct URL redirection to checkout
  app.get("/api/billing/checkout", async (req: CtxReq, res) => {
    const ctx = req.ctx;
    try {
      const { plan, interval } = req.query;

      if (
        !plan ||
        !["basic", "essential", "advanced", "business"].includes(plan as string)
      ) {
        return res.status(400).send({ error: "Invalid plan" });
      }

      if (!interval || !["month", "year"].includes(interval as string)) {
        return res.status(400).send({ error: "Invalid interval" });
      }

      ctx.id = (req.query.id as string) || ctx.id;
      ctx.lang = (req.query.lang as string) || ctx.lang;

      const checkoutUrl = await generateStripeCheckoutSession(
        ctx,
        plan as any,
        interval as any
      );

      // Redirect the user to the Stripe checkout page
      return res.redirect(301, checkoutUrl);
    } catch (err) {
      captureException(err);
      res
        .status(500)
        .send({ error: `Error creating checkout session: ${err.message}` });
    }
  });
};
