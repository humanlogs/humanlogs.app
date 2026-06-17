import { createTranslator } from "next-intl";
import { EmailTemplate, getBaseTemplate } from "./email-templates-base";

type EmailLocale = "en" | "fr" | "es" | "de";

/** Normalize a user language (e.g. "fr", "en-US") to a supported email locale. */
function normalizeEmailLocale(locale?: string): EmailLocale {
  const l = (locale || "en").toLowerCase();
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("de")) return "de";
  return "en";
}

/**
 * Build a next-intl translator for the "email" namespace in the user's locale.
 * Emails are rendered outside the React/request context, so we load the
 * messages directly and use the framework-agnostic `createTranslator`.
 */
async function getEmailTranslator(locale: EmailLocale) {
  const messages = (await import(`../../messages/${locale}/email.json`))
    .default;
  return createTranslator({ locale, messages, namespace: "email" });
}

/** Escape a user-supplied string for safe embedding in HTML email bodies. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Create a referral invitation email template.
 * NOTE: inviterName is user-supplied and sent to third parties, so it is
 * HTML-escaped here and the caller strips control characters.
 */
export function getReferralInviteEmailTemplate(data: {
  inviterName: string;
  signupUrl: string;
}): EmailTemplate {
  const inviterName = escapeHtml(data.inviterName);
  const content = `
    <p>Hi,</p>
    <p><strong>${inviterName}</strong> is using HumanLogs to transcribe interviews and thinks you'd like it too.</p>
    <p>HumanLogs offers fast, confidential transcription for research interviews, with end-to-end encryption so your data never leaves your computer unencrypted.</p>
    <p>You can <a href="${data.signupUrl}">create your free account here</a>.</p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "You've been invited to HumanLogs",
    preheader: `${inviterName} invited you to HumanLogs`,
  });

  const text = `
${data.inviterName} invited you to HumanLogs

Hi,

${data.inviterName} is using HumanLogs to transcribe interviews and thinks you'd like it too.

HumanLogs offers fast, confidential transcription for research interviews, with end-to-end encryption so your data never leaves your computer unencrypted.

Create your free account: ${data.signupUrl}

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: `${data.inviterName} invited you to HumanLogs`,
    html,
    text,
  };
}

/**
 * Create a welcome email template
 */
export function getWelcomeEmailTemplate(data: {
  userName: string;
  loginUrl?: string;
}): EmailTemplate {
  const content = `
    <p>Hi ${data.userName},</p>
    <p>Welcome aboard! We're excited to have you on our platform. You can now start transcribing your audio files with ease.</p>
    ${
      data.loginUrl
        ? `<p>You can <a href="${data.loginUrl}">get started here</a>.</p>`
        : ""
    }
    <p>If you have any questions, feel free to reach out to our support team.</p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Welcome!",
    preheader: "Welcome to HumanLogs",
  });

  const text = `
Welcome to HumanLogs!

Hi ${data.userName},

Welcome aboard! We're excited to have you on our platform. You can now start transcribing your audio files with ease.

${data.loginUrl ? `Get started: ${data.loginUrl}` : ""}

If you have any questions, feel free to reach out to our support team.

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: "Welcome to HumanLogs!",
    html,
    text,
  };
}

/**
 * Create a password reset email template
 */
export function getPasswordResetEmailTemplate(data: {
  userName: string;
  resetUrl: string;
  expiresIn?: string;
}): EmailTemplate {
  const expiresIn = data.expiresIn || "1 hour";

  const content = `
    <p>Hi ${data.userName},</p>
    <p>We received a request to reset your password. You can <a href="${data.resetUrl}">reset your password here</a>.</p>
    <p>This link will expire in ${expiresIn}.</p>
    <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Reset Your Password",
    preheader: "Reset your password for HumanLogs",
  });

  const text = `
Reset Your Password

Hi ${data.userName},

We received a request to reset your password. Click the link below to create a new password:

${data.resetUrl}

This link will expire in ${expiresIn}.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: "Reset Your Password",
    html,
    text,
  };
}

/**
 * Create a transcription completed email template.
 *
 * Intentionally minimal: it does not reveal the file name or any transcript
 * content — only the audio length and which model region processed it.
 */
export async function getTranscriptionCompletedEmailTemplate(data: {
  transcriptionUrl: string;
  durationMinutes?: number;
  modelRegion: "eu" | "us";
  locale?: string;
}): Promise<EmailTemplate> {
  const locale = normalizeEmailLocale(data.locale);
  const t = await getEmailTranslator(locale);
  const model = t(data.modelRegion === "eu" ? "modelEu" : "modelUs");

  const subject = t("completed.subject");
  const title = t("completed.title");
  const greeting = t("greeting");
  const ready = data.durationMinutes
    ? t("completed.ready", { minutes: data.durationMinutes })
    : t("completed.readyNoDuration");
  const modelLine = t("completed.model", { model });
  const button = t("completed.button");
  const feedbackErrors = t("completed.feedbackErrors");
  const feedbackInvite = t("completed.feedbackInvite");
  const signOff = t("completed.signOff");
  const signName = t("completed.signName");

  const content = `
    <p>${greeting}</p>
    <p>${ready}</p>
    <p>${modelLine}</p>
    <p><a href="${data.transcriptionUrl}">${button}</a></p>
    <p>${feedbackErrors}</p>
    <p>${feedbackInvite}</p>
    <p>${signOff}<br>${signName}</p>
  `;

  const html = getBaseTemplate(content, { title: subject, preheader: ready });

  const text = `${title}

${greeting}

${ready}
${modelLine}

${data.transcriptionUrl}

${feedbackErrors}

${feedbackInvite}

${signOff}
${signName}`.trim();

  return { subject, html, text };
}

/**
 * Create a transcription failed email template. Warm and reassuring, and
 * actively invites a reply since failures are exactly when feedback helps most.
 */
export async function getTranscriptionFailedEmailTemplate(data: {
  transcriptionUrl: string;
  durationMinutes?: number;
  modelRegion: "eu" | "us";
  locale?: string;
}): Promise<EmailTemplate> {
  const locale = normalizeEmailLocale(data.locale);
  const t = await getEmailTranslator(locale);
  const model = t(data.modelRegion === "eu" ? "modelEu" : "modelUs");

  const subject = t("failed.subject");
  const title = t("failed.title");
  const greeting = t("greeting");
  const body = t("failed.body");
  const modelLine = t("failed.model", { model });
  const button = t("failed.button");
  const feedbackInvite = t("failed.feedbackInvite");
  const signOff = t("failed.signOff");
  const signName = t("failed.signName");

  const content = `
    <p>${greeting}</p>
    <p>${body}</p>
    <p>${modelLine}</p>
    <p><a href="${data.transcriptionUrl}">${button}</a></p>
    <p>${feedbackInvite}</p>
    <p>${signOff}<br>${signName}</p>
  `;

  const html = getBaseTemplate(content, { title: subject, preheader: body });

  const text = `${title}

${greeting}

${body}
${modelLine}

${data.transcriptionUrl}

${feedbackInvite}

${signOff}
${signName}`.trim();

  return { subject, html, text };
}

/**
 * Create a generic notification email template
 */
export function getNotificationEmailTemplate(data: {
  userName: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}): EmailTemplate {
  const content = `
    <p>Hi ${data.userName},</p>
    <p>${data.message}</p>
    ${
      data.actionUrl && data.actionText
        ? `<p><a href="${data.actionUrl}">${data.actionText}</a></p>`
        : ""
    }
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: data.title,
    preheader: data.message,
  });

  const text = `
${data.title}

Hi ${data.userName},

${data.message}

${data.actionUrl && data.actionText ? `${data.actionText}: ${data.actionUrl}` : ""}

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: data.title,
    html,
    text,
  };
}

/**
 * Create an account deletion confirmation email template
 */
export function getAccountDeletionEmailTemplate(data: {
  userName: string;
  confirmationUrl: string;
  expiresIn?: string;
}): EmailTemplate {
  const expiresIn = data.expiresIn || "24 hours";

  const content = `
    <p>Hi ${data.userName},</p>
    <p>We received a request to permanently delete your account and all associated data.</p>
    <p><strong>This action cannot be undone.</strong> Once confirmed, your transcriptions, audio files, account settings, project data and encryption keys will all be permanently deleted.</p>
    <p>If you want to proceed, you can <a href="${data.confirmationUrl}">confirm the deletion here</a>.</p>
    <p>This link will expire in ${expiresIn}. If you did not request this deletion, you can safely ignore this email and your account will remain active.</p>
    <p>If you have any questions or concerns, please contact our support team.</p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Account Deletion Request",
    preheader: "Confirm your account deletion request",
  });

  const text = `
Account Deletion Request

Hi ${data.userName},

We received a request to permanently delete your account and all associated data.

**This action cannot be undone.** Once confirmed, the following will be permanently deleted:

- All your transcriptions
- All audio files
- Your account settings
- All project data
- Your encryption keys

If you want to proceed with the deletion, click the link below:
${data.confirmationUrl}

Note: This link will expire in ${expiresIn}. If you did not request this deletion, 
you can safely ignore this email and your account will remain active.

If you have any questions or concerns, please contact our support team.

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: "Confirm Account Deletion",
    html,
    text,
  };
}

/**
 * Create a contact form email template (for admin notification)
 */
export function getContactEmailTemplate(data: {
  fullName: string;
  email: string;
  organization: string;
  useCase: string;
  message: string;
}): EmailTemplate {
  const useCaseLabels: Record<string, string> = {
    journalism: "Journalism",
    legal: "Legal",
    government: "Government",
    research: "Research",
  };

  const useCaseLabel = useCaseLabels[data.useCase] || data.useCase;

  const content = `
    <p>You have received a new message from the contact form:</p>
    <p>
      <strong>Name:</strong> ${data.fullName}<br>
      <strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a><br>
      <strong>Organization:</strong> ${data.organization}<br>
      <strong>Use Case:</strong> ${useCaseLabel}
    </p>
    <p><strong>Message:</strong></p>
    <p style="white-space: pre-wrap;">${data.message}</p>
    <p>Reply directly to this email to respond to ${data.fullName}.</p>
  `;

  const html = getBaseTemplate(content, {
    title: "New Contact Form Submission",
    preheader: `New message from ${data.fullName}`,
  });

  const text = `
New Contact Form Submission

You have received a new message from the contact form:

Name: ${data.fullName}
Email: ${data.email}
Organization: ${data.organization}
Use Case: ${useCaseLabel}

Message:
${data.message}

---
Reply directly to this email to respond to ${data.fullName}.
  `.trim();

  return {
    subject: `Contact Form: ${data.fullName} - ${useCaseLabel}`,
    html,
    text,
  };
}

/**
 * Create a contact confirmation email template (for user)
 */
export function getContactConfirmationTemplate(data: {
  fullName: string;
}): EmailTemplate {
  const content = `
    <p>Hi ${data.fullName},</p>
    <p>Thank you for contacting us! We've received your message and our team will review it shortly.</p>
    <p>We typically respond within 1-2 business days. In the meantime, feel free to visit <a href="https://humanlogs.app">our website</a>, check out <a href="https://github.com/humanlogs">our GitHub</a>, or have a look at <a href="https://humanlogs.app/pricing">our pricing plans</a>.</p>
    <p>If you have any urgent questions, you can reply directly to this email.</p>
    <p>Best regards,<br>The Humanlogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Message Received",
    preheader: "We've received your message and will be in touch soon",
  });

  const text = `
We've Received Your Message

Hi ${data.fullName},

Thank you for contacting us! We've received your message and our team will review it shortly.

We typically respond within 1-2 business days. In the meantime, feel free to explore our resources:

- Visit our website: https://humanlogs.app
- Check out our GitHub: https://github.com/humanlogs
- View pricing plans: https://humanlogs.app/pricing

If you have any urgent questions, you can reply directly to this email.

Best regards,
The Humanlogs Team
  `.trim();

  return {
    subject: "Thank you for contacting Humanlogs",
    html,
    text,
  };
}
