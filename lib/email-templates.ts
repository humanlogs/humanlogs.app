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
  const title = options?.title || "Transcription App";
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
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
      <div class="email-header">
        <h1>${title}</h1>
      </div>
      <div class="email-body">
        ${content}
      </div>
      <div class="email-footer">
        <p>${footerText}</p>
        <p style="margin-top: 10px; font-size: 12px; color: #9ca3af;">
          &copy; ${new Date().getFullYear()} Transcription App. All rights reserved.
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
    <h2>Welcome to Transcription App!</h2>
    <p>Hi ${data.userName},</p>
    <p>Welcome aboard! We're excited to have you on our platform. You can now start transcribing your audio files with ease.</p>
    ${
      data.loginUrl
        ? `<p style="text-align: center;"><a href="${data.loginUrl}" class="button">Get Started</a></p>`
        : ""
    }
    <p>If you have any questions, feel free to reach out to our support team.</p>
    <p>Best regards,<br>The Transcription App Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Welcome!",
    preheader: "Welcome to Transcription App",
  });

  const text = `
Welcome to Transcription App!

Hi ${data.userName},

Welcome aboard! We're excited to have you on our platform. You can now start transcribing your audio files with ease.

${data.loginUrl ? `Get started: ${data.loginUrl}` : ""}

If you have any questions, feel free to reach out to our support team.

Best regards,
The Transcription App Team
  `.trim();

  return {
    subject: "Welcome to Transcription App!",
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
    <p>Best regards,<br>The Transcription App Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Reset Your Password",
    preheader: "Reset your password for Transcription App",
  });

  const text = `
Reset Your Password

Hi ${data.userName},

We received a request to reset your password. Click the link below to create a new password:

${data.resetUrl}

This link will expire in ${expiresIn}.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
The Transcription App Team
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
    <p>Best regards,<br>The Transcription App Team</p>
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
The Transcription App Team
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
    <p>Best regards,<br>The Transcription App Team</p>
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
The Transcription App Team
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

    <p>Best regards,<br>The Transcription App Team</p>
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
The Transcription App Team
  `.trim();

  return {
    subject: "Confirm Account Deletion",
    html,
    text,
  };
}
