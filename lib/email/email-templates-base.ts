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
      background: #000000;
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
      background: #000000;
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
