export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface TemplateData {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Minimal email wrapper.
 *
 * Intentionally plain: no header banner, no card, no footer, no copyright —
 * the goal is for emails to read like a message typed by a person, just text
 * and a few links. Keep new emails in this spirit (prose + inline links).
 */
export function getBaseTemplate(
  content: string,
  options?: {
    title?: string;
    preheader?: string;
  },
): string {
  const title = options?.title || "HumanLogs";
  const preheader = options?.preheader || "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #1a1a1a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
    }
    .email-content {
      max-width: 600px;
      margin: 0 auto;
      padding: 24px;
    }
    p {
      margin: 16px 0;
    }
    a {
      color: #1a56db;
    }
    .preheader {
      display: none;
      max-height: 0;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <span class="preheader">${preheader}</span>
  <div class="email-content">
    ${content}
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
