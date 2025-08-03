import { captureException } from "@sentry/node";
import config from "config";
import Stripe from "stripe";
import Framework from "../../../platform";
import { Context, CtxReq } from "../../../types";
import {
  AccountsDefinition,
  AccountsType,
} from "../../account/entities/accounts";
import {
  getPlanForCustomerId,
  isPlanBetter,
  renewCreditsIfNeeded,
} from "./credit-updater";
import { isNaN } from "lodash";

export const plans = {
  prod_RADSyPnXupW3w1: "basic",
  prod_RAF4DXHZhRrMvQ: "essential",
  prod_RAF7tnKX3Q1i0o: "advanced",
  prod_RAF8dkinP3wZM2: "business",
};

export const stripe = new Stripe(config.get("stripe.secret"), {
  apiVersion: "2025-07-30.basil",
});

const endpointSecret = config.get<string>("stripe.webhook_secret");

const isEuropeLanguage = (lang: string) => {
  return ["fr", "de", "es", "it", "pt", "nl"].some((lng) =>
    lang.toLocaleLowerCase().startsWith(lng)
  );
};

export const generateStripeCheckoutSession = async (
  ctx: Context,
  plan: "basic" | "essential" | "advanced" | "business",
  interval: "month" | "year"
) => {
  const userId = ctx.id;
  const lang = ctx.lang;
  const currency = isEuropeLanguage(lang) ? "eur" : "usd";

  if (!userId) {
    throw new Error("User ID is required");
  }

  // Get user to retrieve email
  const db = await Framework.Db.getService();
  const user = await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
    id: userId,
  });

  if (!user) {
    throw new Error("User not found");
  }

  const productId = Object.keys(plans).find((key) => plans[key] === plan);

  // Retrieve existing prices for the plan
  const prices = (
    await stripe.prices.list({
      active: true,
      expand: ["data.product"],
    })
  )?.data?.filter(
    (price) =>
      price.recurring?.interval === interval &&
      price.active &&
      ((price.product as Stripe.Product).id === productId ||
        (price.product as string) === productId)
  );

  if (!prices.length) {
    throw new Error("No active prices found for the selected plan");
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: user.email,
    client_reference_id: userId,
    line_items: [
      {
        price: prices[0].id,
        quantity: 1,
      },
    ],
    mode: "subscription",
    billing_address_collection: "auto",
    phone_number_collection: {
      enabled: false,
    },
    tax_id_collection: {
      enabled: true,
    },
    allow_promotion_codes: true,
    currency: currency,
    success_url: "https://app.totext.app/?stripe=1",
    cancel_url: "https://app.totext.app/billing",
    automatic_tax: {
      enabled: true,
    },
  });

  return session.url;
};

export const geenrateStripeCheckoutSession = generateStripeCheckoutSession;

export const stripeHook = async (ctx: Context, sig: string, req: CtxReq) => {
  let event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

  // Handle different event types separately
  if (event.type === "checkout.session.completed") {
    await handleCheckoutSessionCompleted(ctx, event.data.object);
  } else if (event.type === "customer.subscription.updated") {
    await handleSubscriptionUpdated(ctx, event.data.object);
  } else if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionDeleted(ctx, event.data.object);
  } else {
    console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  return "";
};

// Handle checkout.session.completed events
async function handleCheckoutSessionCompleted(
  ctx: Context,
  session: Stripe.Checkout.Session
) {
  // Retrieve the client_reference_id or metadata
  const userId = session.client_reference_id;
  const stripeCustomerId = session.customer as string;

  // Link the stripeCustomerId to the user
  const db = await Framework.Db.getService();
  const user = await findUserForStripeCustomer(
    ctx,
    stripeCustomerId,
    userId,
    session.customer_details?.email
  );

  if (!user) {
    captureException(
      new Error(
        `No user found for stripeCustomerId ${stripeCustomerId} and email ${session.customer_details?.email}`
      )
    );
    return "No user found, information sent to sentry";
  }

  const plan = await getPlanForCustomerId(stripeCustomerId);
  const isUpgrade = isPlanBetter(plan, user.plan);

  await db.update<AccountsType>(
    ctx,
    AccountsDefinition.name,
    { id: user.id },
    {
      stripe_id: stripeCustomerId,
      stripe_email: session.customer_details?.email || user.stripe_email,
      plan,
      plan_renew_at: isUpgrade
        ? (session.subscription as any)?.billing_cycle_anchor * 1000 // It is in seconds
        : user.plan_renew_at,
    }
  );

  if (!user.plan || user.plan === "free") {
    await sendWelcomeEmail(ctx, user);
  }

  await renewCreditsIfNeeded(ctx, user.id);

  return "";
}

// Handle customer.subscription.updated events
async function handleSubscriptionUpdated(
  ctx: Context,
  subscription: Stripe.Subscription
) {
  const stripeCustomerId = subscription.customer as string;

  // Find the user
  const db = await Framework.Db.getService();
  const user = await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
    stripe_id: stripeCustomerId || "null",
  });

  if (!user) {
    return "No user found (will be created by checkout end)";
  }

  const plan = await getPlanForCustomerId(stripeCustomerId);
  const isUpgrade = isPlanBetter(plan, user.plan);

  await db.update<AccountsType>(
    ctx,
    AccountsDefinition.name,
    { id: user.id },
    {
      plan,
      plan_renew_at:
        isUpgrade || isNaN(user.plan_renew_at) || !user.plan_renew_at
          ? subscription.billing_cycle_anchor * 1000 // It is in seconds
          : user.plan_renew_at,
    }
  );

  await renewCreditsIfNeeded(ctx, user.id);

  return "";
}

// Handle customer.subscription.deleted events
async function handleSubscriptionDeleted(
  ctx: Context,
  subscription: Stripe.Subscription
) {
  const stripeCustomerId = subscription.customer as string;

  const db = await Framework.Db.getService();
  const user = await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
    stripe_id: stripeCustomerId || "null",
  });

  if (!user) {
    captureException(
      new Error(`No user found for stripeCustomerId ${stripeCustomerId}`)
    );
    return "No user found, information sent to sentry";
  }

  // Set plan to free but preserve existing credits
  await db.update<AccountsType>(
    ctx,
    AccountsDefinition.name,
    { id: user.id },
    {
      plan: "free",
      // Credits remain unchanged - we don't zero them out
    }
  );

  return "";
}

// Helper function to find a user for a Stripe customer
async function findUserForStripeCustomer(
  ctx: Context,
  stripeCustomerId: string,
  userId?: string,
  email?: string
) {
  const db = await Framework.Db.getService();
  return (
    (await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
      stripe_id: stripeCustomerId || "null",
    })) ||
    (await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
      id: userId || "null",
    })) ||
    (await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
      email: email || "null",
    }))
  );
}

// Helper function to send welcome email
async function sendWelcomeEmail(ctx: Context, user: AccountsType) {
  ctx = { ...ctx, lang: user.lang };
  await Framework.PushEMail.push(
    ctx,
    user.email,
    Framework.I18n.t(ctx, "emails.welcome.body", { replacements: [user.name] }),
    {
      subject: Framework.I18n.t(ctx, "emails.welcome.title"),
    }
  );
}
