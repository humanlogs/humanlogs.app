import {
  getDiscountEmailTemplate,
  getFollowUpEmailTemplate,
  getWelcomeMarketingEmailTemplate,
} from "./email-templates-marketing";
import { prisma } from "../prisma";
import { sendEmail } from "./mailer";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://humanlogs.app";

/**
 * Send the welcome email to a new user (step 1)
 */
export async function sendWelcomeMarketingEmail(
  userId: string,
  userEmail: string,
  userName: string,
  userLanguage?: string,
) {
  try {
    const template = getWelcomeMarketingEmailTemplate({
      userName: userName || "there",
      loginUrl: `${APP_URL}/app/login`,
      language: userLanguage,
    });

    await sendEmail({
      to: userEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    // Update user's marketing email step and timestamp
    await prisma.user.update({
      where: { id: userId },
      data: {
        marketingEmailStep: 1,
        lastMarketingEmailAt: new Date(),
      },
    });

    console.log(`[Marketing Email] Sent welcome email to ${userEmail}`);
  } catch (error) {
    console.error(
      `[Marketing Email] Failed to send welcome email to ${userEmail}:`,
      error,
    );
  }
}

/**
 * Send the follow-up email (step 2) - sent 1 week after signup
 */
export async function sendFollowUpMarketingEmail(
  userId: string,
  userEmail: string,
  userName: string,
  userLanguage?: string,
) {
  try {
    const template = getFollowUpEmailTemplate({
      userName: userName || "there",
      loginUrl: `${APP_URL}/app/login`,
      language: userLanguage,
    });

    await sendEmail({
      to: userEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    // Update user's marketing email step and timestamp
    await prisma.user.update({
      where: { id: userId },
      data: {
        marketingEmailStep: 2,
        lastMarketingEmailAt: new Date(),
      },
    });

    console.log(`[Marketing Email] Sent follow-up email to ${userEmail}`);
  } catch (error) {
    console.error(
      `[Marketing Email] Failed to send follow-up email to ${userEmail}:`,
      error,
    );
  }
}

/**
 * Send the discount email (step 3) - sent 2 weeks after previous email (3 weeks total)
 */
export async function sendDiscountMarketingEmail(
  userId: string,
  userEmail: string,
  userName: string,
  userLanguage?: string,
) {
  try {
    const template = getDiscountEmailTemplate({
      userName: userName || "there",
      loginUrl: `${APP_URL}/app/login`,
      language: userLanguage,
    });

    await sendEmail({
      to: userEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    // Update user's marketing email step to 99 (completed sequence)
    await prisma.user.update({
      where: { id: userId },
      data: {
        marketingEmailStep: 99,
        lastMarketingEmailAt: new Date(),
      },
    });

    console.log(`[Marketing Email] Sent discount email to ${userEmail}`);
  } catch (error) {
    console.error(
      `[Marketing Email] Failed to send discount email to ${userEmail}:`,
      error,
    );
  }
}

/**
 * Check if user should stop receiving marketing emails
 * Stop if user has paid (credits > 100 or creditsUsed > 100)
 */
function shouldStopMarketingEmails(user: {
  credits: number;
  creditsUsed: number;
  marketingEmailStep: number;
}): boolean {
  // Already completed the sequence
  if (user.marketingEmailStep >= 99) {
    return true;
  }

  // User has paid (has more than default 100 credits or used more than 100)
  if (user.credits > 100 || user.creditsUsed > 100) {
    return true;
  }

  return false;
}

/**
 * Process marketing emails for all eligible users
 * This should be run daily via cron job
 */
export async function processMarketingEmails() {
  console.log("[Marketing Email] Processing scheduled marketing emails...");

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  try {
    // Find users who need the follow-up email (step 2)
    // Criteria: marketingEmailStep = 1, lastMarketingEmailAt >= 1 week ago
    const step2Users = await prisma.user.findMany({
      where: {
        marketingEmailStep: 1,
        lastMarketingEmailAt: {
          lte: oneWeekAgo,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        language: true,
        credits: true,
        creditsUsed: true,
        marketingEmailStep: true,
      },
    });

    console.log(
      `[Marketing Email] Found ${step2Users.length} users for step 2 (follow-up)`,
    );

    for (const user of step2Users) {
      if (shouldStopMarketingEmails(user)) {
        // Mark as completed so they don't get more emails
        await prisma.user.update({
          where: { id: user.id },
          data: { marketingEmailStep: 99 },
        });
        console.log(
          `[Marketing Email] User ${user.email} has paid, skipping marketing emails`,
        );
        continue;
      }

      await sendFollowUpMarketingEmail(
        user.id,
        user.email,
        user.name || "",
        user.language,
      );

      // Add small delay to avoid overwhelming email service
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Find users who need the discount email (step 3)
    // Criteria: marketingEmailStep = 2, lastMarketingEmailAt >= 2 weeks ago
    const step3Users = await prisma.user.findMany({
      where: {
        marketingEmailStep: 2,
        lastMarketingEmailAt: {
          lte: twoWeeksAgo,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        language: true,
        credits: true,
        creditsUsed: true,
        marketingEmailStep: true,
      },
    });

    console.log(
      `[Marketing Email] Found ${step3Users.length} users for step 3 (discount)`,
    );

    for (const user of step3Users) {
      if (shouldStopMarketingEmails(user)) {
        // Mark as completed so they don't get more emails
        await prisma.user.update({
          where: { id: user.id },
          data: { marketingEmailStep: 99 },
        });
        console.log(
          `[Marketing Email] User ${user.email} has paid, skipping marketing emails`,
        );
        continue;
      }

      await sendDiscountMarketingEmail(
        user.id,
        user.email,
        user.name || "",
        user.language,
      );

      // Add small delay to avoid overwhelming email service
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(
      `[Marketing Email] Processing complete. Sent ${step2Users.length + step3Users.length} emails`,
    );

    return {
      success: true,
      step2Count: step2Users.length,
      step3Count: step3Users.length,
    };
  } catch (error) {
    console.error(
      "[Marketing Email] Error processing marketing emails:",
      error,
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
