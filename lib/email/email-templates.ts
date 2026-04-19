export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface TemplateData {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Base HTML email template with responsive design
 */
export function getBaseTemplate(
  content: string,
  options?: {
    title?: string;
    preheader?: string;
    footerText?: string;
  },
): string {
  const title = options?.title || "HumanLogs";
  const preheader = options?.preheader || "";
  const footerText =
    options?.footerText ||
    "You're receiving this email because you have an account with us.";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f5;
    }
    .email-wrapper {
      width: 100%;
      background-color: #f4f4f5;
      padding: 20px 0;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
    }
    .email-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px 40px;
      text-align: center;
    }
    .email-header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 600;
    }
    .email-body {
      padding: 40px;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .email-footer p {
      margin: 0;
      font-size: 14px;
      color: #6b7280;
    }
    .button {
      display: inline-block;
      padding: 12px 32px;
      margin: 20px 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
    }
    .button:hover {
      opacity: 0.9;
    }
    h1, h2, h3 {
      color: #111827;
    }
    p {
      margin: 16px 0;
      color: #374151;
    }
    .preheader {
      display: none;
      max-height: 0;
      overflow: hidden;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        border-radius: 0;
      }
      .email-header, .email-body, .email-footer {
        padding: 20px !important;
      }
    }
  </style>
</head>
<body>
  <span class="preheader">${preheader}</span>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-body">
        <h1>${title}</h1>
        ${content}
      </div>
      <div class="email-footer">
        <p>${footerText}</p>
        <p style="margin-top: 10px; font-size: 12px; color: #9ca3af;">
          &copy; ${new Date().getFullYear()} HumanLogs. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Replace variables in a template string
 * Example: "Hello {{name}}" with {name: "John"} becomes "Hello John"
 */
export function replaceVariables(template: string, data: TemplateData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Create a welcome email template
 */
export function getWelcomeEmailTemplate(data: {
  userName: string;
  loginUrl?: string;
}): EmailTemplate {
  const content = `
    <h2>Welcome to HumanLogs!</h2>
    <p>Hi ${data.userName},</p>
    <p>Welcome aboard! We're excited to have you on our platform. You can now start transcribing your audio files with ease.</p>
    ${
      data.loginUrl
        ? `<p style="text-align: center;"><a href="${data.loginUrl}" class="button">Get Started</a></p>`
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
    <h2>Reset Your Password</h2>
    <p>Hi ${data.userName},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <p style="text-align: center;">
      <a href="${data.resetUrl}" class="button">Reset Password</a>
    </p>
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
 * Create a transcription completed email template
 */
export function getTranscriptionCompletedEmailTemplate(data: {
  userName: string;
  fileName: string;
  transcriptionUrl: string;
  duration?: string;
}): EmailTemplate {
  const content = `
    <h2>Your Transcription is Ready!</h2>
    <p>Hi ${data.userName},</p>
    <p>Good news! Your transcription for <strong>${data.fileName}</strong> has been completed successfully.</p>
    ${data.duration ? `<p>Total duration: ${data.duration}</p>` : ""}
    <p style="text-align: center;">
      <a href="${data.transcriptionUrl}" class="button">View Transcription</a>
    </p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Transcription Complete",
    preheader: `Your transcription for ${data.fileName} is ready`,
  });

  const text = `
Your Transcription is Ready!

Hi ${data.userName},

Good news! Your transcription for "${data.fileName}" has been completed successfully.

${data.duration ? `Total duration: ${data.duration}` : ""}

View your transcription: ${data.transcriptionUrl}

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: `Transcription Complete: ${data.fileName}`,
    html,
    text,
  };
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
    <h2>${data.title}</h2>
    <p>Hi ${data.userName},</p>
    <p>${data.message}</p>
    ${
      data.actionUrl && data.actionText
        ? `<p style="text-align: center;"><a href="${data.actionUrl}" class="button">${data.actionText}</a></p>`
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
    <h2 style="color: #dc2626;">Account Deletion Request</h2>
    <p>Hi ${data.userName},</p>
    <p>We received a request to permanently delete your account and all associated data.</p>
    
    <p><strong>This action cannot be undone.</strong> Once confirmed, the following will be permanently deleted:</p>
    <ul style="color: #6b7280; line-height: 1.8;">
      <li>All your transcriptions</li>
      <li>All audio files</li>
      <li>Your account settings</li>
      <li>All project data</li>
      <li>Your encryption keys</li>
    </ul>

    <p>If you want to proceed with the deletion, click the button below:</p>
    <p style="text-align: center;">
      <a href="${data.confirmationUrl}" class="button" style="background: #dc2626;">
        Confirm Account Deletion
      </a>
    </p>

    <p style="color: #6b7280; font-size: 14px;">
      <strong>Note:</strong> This link will expire in ${expiresIn}. If you did not request this deletion, 
      you can safely ignore this email and your account will remain active.
    </p>

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
    <h2>New Contact Form Submission</h2>
    <p>You have received a new message from the contact form:</p>
    
    <div style="background-color: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 8px 0;"><strong>Name:</strong> ${data.fullName}</p>
      <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${data.email}" style="color: #667eea;">${data.email}</a></p>
      <p style="margin: 8px 0;"><strong>Organization:</strong> ${data.organization}</p>
      <p style="margin: 8px 0;"><strong>Use Case:</strong> ${useCaseLabel}</p>
    </div>

    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0 0 10px 0;"><strong>Message:</strong></p>
      <p style="margin: 0; color: #374151; white-space: pre-wrap;">${data.message}</p>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Reply directly to this email to respond to ${data.fullName}.
    </p>
  `;

  const html = getBaseTemplate(content, {
    title: "New Contact Form Submission",
    preheader: `New message from ${data.fullName}`,
    footerText: "This is an automated notification from your contact form.",
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
    <h2>We've Received Your Message</h2>
    <p>Hi ${data.fullName},</p>
    <p>Thank you for contacting us! We've received your message and our team will review it shortly.</p>
    <p>We typically respond within 1-2 business days. In the meantime, feel free to explore our resources:</p>
    
    <ul style="color: #374151; line-height: 1.8; margin: 20px 0;">
      <li><a href="https://humanlogs.app" style="color: #667eea; text-decoration: none;">Visit our website</a></li>
      <li><a href="https://github.com/humanlogs" style="color: #667eea; text-decoration: none;">Check out our GitHub</a></li>
      <li><a href="https://humanlogs.app/pricing" style="color: #667eea; text-decoration: none;">View pricing plans</a></li>
    </ul>

    <p>If you have any urgent questions, you can reply directly to this email.</p>
    
    <p>Best regards,<br>The Humanlogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Message Received",
    preheader: "We've received your message and will be in touch soon",
    footerText:
      "You're receiving this email because you contacted us through our website.",
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
