/**
 * Email System Usage Examples
 *
 * This file contains examples of how to use the email system in your application.
 * Import the functions you need and use them in your API routes or server-side code.
 */

import { sendEmail } from "@/lib/email/mailer";
import {
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate,
  getTranscriptionCompletedEmailTemplate,
  getNotificationEmailTemplate,
} from "@/lib/email/email-templates-account";
import { getBaseTemplate } from "./email-templates-base";

/**
 * Example 1: Send a welcome email to a new user
 */
export async function sendWelcomeEmail(userEmail: string, userName: string) {
  const template = getWelcomeEmailTemplate({
    userName,
    loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/app/login`,
  });

  await sendEmail({
    to: userEmail,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

/**
 * Example 2: Send a password reset email
 */
export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  resetToken: string,
) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

  const template = getPasswordResetEmailTemplate({
    userName,
    resetUrl,
    expiresIn: "1 hour",
  });

  await sendEmail({
    to: userEmail,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

/**
 * Example 3: Notify user when transcription is complete
 */
export async function sendTranscriptionCompleteEmail(
  userEmail: string,
  userName: string,
  transcriptionId: string,
  fileName: string,
  durationMinutes: number,
) {
  const transcriptionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/app/transcription/${transcriptionId}`;
  const duration = `${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}`;

  const template = getTranscriptionCompletedEmailTemplate({
    userName,
    fileName,
    transcriptionUrl,
    duration,
  });

  await sendEmail({
    to: userEmail,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

/**
 * Example 4: Send a custom notification
 */
export async function sendCustomNotification(
  userEmail: string,
  userName: string,
  title: string,
  message: string,
) {
  const template = getNotificationEmailTemplate({
    userName,
    title,
    message,
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
    actionText: "View Account",
  });

  await sendEmail({
    to: userEmail,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

/**
 * Example 5: Send email with attachment
 */
export async function sendEmailWithAttachment(
  userEmail: string,
  userName: string,
  transcriptionText: string,
  fileName: string,
) {
  const content = `
    <h2>Your Transcription is Attached</h2>
    <p>Hi ${userName},</p>
    <p>Please find your transcription for <strong>${fileName}</strong> attached to this email.</p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Transcription Attached",
    preheader: `Your transcription for ${fileName}`,
  });

  await sendEmail({
    to: userEmail,
    subject: `Transcription: ${fileName}`,
    html,
    text: `Your transcription for ${fileName} is attached.`,
    attachments: [
      {
        filename: `${fileName}.txt`,
        content: Buffer.from(transcriptionText, "utf-8"),
        contentType: "text/plain",
      },
    ],
  });
}

/**
 * Example 6: Send email to multiple recipients
 */
export async function sendBulkNotification(
  recipients: string[],
  title: string,
  message: string,
) {
  const content = `
    <h2>${title}</h2>
    <p>${message}</p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title,
    preheader: message,
  });

  await sendEmail({
    to: recipients,
    subject: title,
    html,
    text: message,
  });
}

/**
 * Example 7: Send email with CC and BCC
 */
export async function sendEmailWithCopies(
  primaryEmail: string,
  ccEmails: string[],
  subject: string,
  message: string,
) {
  const content = `
    <p>${message}</p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: subject,
  });

  await sendEmail({
    to: primaryEmail,
    cc: ccEmails,
    subject,
    html,
    text: message,
  });
}

/**
 * Example 8: Error handling when sending emails
 */
export async function sendEmailWithErrorHandling(
  userEmail: string,
  subject: string,
  message: string,
) {
  try {
    const content = `<p>${message}</p>`;
    const html = getBaseTemplate(content, { title: subject });

    await sendEmail({
      to: userEmail,
      subject,
      html,
      text: message,
    });

    console.log(`Email sent successfully to ${userEmail}`);
    return { success: true };
  } catch (error) {
    console.error(`Failed to send email to ${userEmail}:`, error);

    // Log to monitoring service, database, etc.
    // await logEmailError(userEmail, subject, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Example 9: Usage in an API route (Next.js App Router)
 */
// File: app/api/user/welcome/route.ts
/*
import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email-examples";

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    await sendWelcomeEmail(email, name);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
*/
