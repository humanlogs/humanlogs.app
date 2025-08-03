import { captureException } from "@sentry/node";
import config from "config";
import Framework from "../../../platform";
import { Context, CtxReq } from "../../../types";
import {
  AccountsDefinition,
  AccountsType,
} from "../../account/entities/accounts";
import { isPlanBetter, renewCreditsIfNeeded } from "./credit-updater";

// Map of Apple product IDs to plan names
const applePlans = {
  "com.yourapp.basic": "basic",
  "com.yourapp.essential": "essential",
  "com.yourapp.advanced": "advanced",
  "com.yourapp.business": "business",
};

// Verification endpoint for Apple receipt validation
const receiptVerificationEndpoint = config.get<string>(
  "apple.verification_endpoint"
);
const appleSharedSecret = config.get<string>("apple.shared_secret");

export const appleHook = async (ctx: Context, req: CtxReq) => {
  try {
    // Extract notification data from request
    const notification = req.body;

    // Verify the notification is authentic (implementation depends on Apple's requirements)
    if (!isValidAppleNotification(notification)) {
      throw new Error("Invalid Apple notification");
    }

    const notificationType = notification.notification_type;

    switch (notificationType) {
      case "INITIAL_BUY":
      case "DID_RENEW":
        await handleSubscriptionPurchaseOrRenewal(ctx, notification);
        break;

      case "CANCEL":
      case "DID_FAIL_TO_RENEW":
        await handleSubscriptionCancellation(ctx, notification);
        break;

      case "PRICE_INCREASE_CONSENT":
      case "REFUND":
      case "REVOKE":
        // Handle other notification types as needed
        console.log(`Processing Apple notification type: ${notificationType}`);
        break;

      default:
        console.log(`Unhandled Apple notification type: ${notificationType}`);
    }

    return "Notification processed";
  } catch (error) {
    captureException(error);
    throw error;
  }
};

// Validate Apple notification
function isValidAppleNotification(notification: any): boolean {
  // Improved validation logic based on Apple's Server-to-Server Notification requirements
  if (!notification || !notification.notification_type) {
    return false;
  }

  // Additional validation could include:
  // 1. Verifying the signature if Apple provides one
  // 2. Checking timestamps to prevent replay attacks
  // 3. Validating required fields based on notification type

  // Ensure the unified_receipt structure exists for relevant notification types
  if (
    ["INITIAL_BUY", "DID_RENEW", "CANCEL", "DID_FAIL_TO_RENEW"].includes(
      notification.notification_type
    )
  ) {
    return (
      !!notification.unified_receipt &&
      !!notification.unified_receipt.latest_receipt_info &&
      notification.unified_receipt.latest_receipt_info.length > 0
    );
  }

  return true;
}

// Handle subscription purchase or renewal
async function handleSubscriptionPurchaseOrRenewal(
  ctx: Context,
  notification: any
) {
  // Extract receipt data
  const receiptData = notification.unified_receipt;
  const latestReceiptInfo = receiptData?.latest_receipt_info;

  if (!latestReceiptInfo || !latestReceiptInfo.length) {
    throw new Error("Missing receipt information in Apple notification");
  }

  // Get the most recent transaction
  const transaction = latestReceiptInfo[0];

  // Extract user information - note that Apple sends only the original_transaction_id
  // as a stable identifier, so we need to store this with the user
  const appleTransactionId = transaction.original_transaction_id;
  const productId = transaction.product_id;
  const userId = notification.auto?.app_account_token; // If using App Account Token

  // Get plan from product ID
  const plan = getApplePlan(productId);

  // Find the user in our database
  const db = await Framework.Db.getService();
  const user = await findUserForAppleTransaction(
    ctx,
    appleTransactionId,
    userId
  );

  if (!user) {
    captureException(
      new Error(`No user found for Apple transaction ID ${appleTransactionId}`)
    );
    return;
  }

  // Determine if this is an upgrade
  const isUpgrade = isPlanBetter(plan, user.plan);

  // Calculate renewal date
  const expiresDate = parseInt(transaction.expires_date_ms);

  // Update user account
  await db.update<AccountsType>(
    ctx,
    AccountsDefinition.name,
    { id: user.id },
    {
      apple_pay_id: appleTransactionId,
      plan,
      plan_renew_at: isUpgrade
        ? expiresDate // Apple provides expiration in milliseconds
        : user.plan_renew_at,
    }
  );

  // Send welcome email for new subscribers
  if (!user.plan) {
    await sendWelcomeEmail(ctx, user);
  }

  // Renew credits if needed
  await renewCreditsIfNeeded(ctx, user.id);
}

// Handle subscription cancellation
async function handleSubscriptionCancellation(ctx: Context, notification: any) {
  // Extract transaction information
  const receiptData = notification.unified_receipt;
  const latestReceiptInfo = receiptData?.latest_receipt_info;

  if (!latestReceiptInfo || !latestReceiptInfo.length) {
    throw new Error("Missing receipt information in Apple notification");
  }

  // Get the transaction ID
  const transaction = latestReceiptInfo[0];
  const appleTransactionId = transaction.original_transaction_id;

  // Find the user
  const db = await Framework.Db.getService();
  const user = await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
    apple_pay_id: appleTransactionId || "null",
  });

  if (!user) {
    captureException(
      new Error(`No user found for Apple transaction ID ${appleTransactionId}`)
    );
    return;
  }

  // Update user plan to free but keep existing credits
  await db.update<AccountsType>(
    ctx,
    AccountsDefinition.name,
    { id: user.id },
    {
      plan: "free",
      // We don't modify credits here to preserve existing credits
    }
  );
}

// Helper function to find a user for an Apple transaction
async function findUserForAppleTransaction(
  ctx: Context,
  transactionId: string,
  userId?: string
) {
  const db = await Framework.Db.getService();
  return (
    (await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
      apple_pay_id: transactionId || "null",
    })) ||
    (await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
      id: userId || "null",
    }))
  );
}

// Helper function to map Apple product IDs to plan names
function getApplePlan(productId: string): string {
  return applePlans[productId] || "free";
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

// Verify Apple receipt (for server-to-server validation)
async function verifyAppleReceipt(receiptData: string): Promise<any> {
  try {
    // Send the receipt to Apple's verification service
    const response = await fetch(receiptVerificationEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "receipt-data": receiptData,
        password: appleSharedSecret,
        "exclude-old-transactions": true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Receipt validation failed: ${response.status}`);
    }

    const verificationResult = await response.json();

    // Apple returns a status code indicating the result of the verification
    if (verificationResult.status !== 0) {
      throw new Error(
        `Receipt validation returned status ${verificationResult.status}`
      );
    }

    return verificationResult;
  } catch (error) {
    captureException(error);
    throw error;
  }
}
