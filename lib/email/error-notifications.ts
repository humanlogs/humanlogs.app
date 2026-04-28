import { sendEmail } from "./mailer";

interface ErrorNotificationOptions {
  error: string;
  context?: Record<string, any>;
  stackTrace?: string;
}

/**
 * Send an error notification email for errors
 */
export async function sendAdminError(
  options: ErrorNotificationOptions,
): Promise<void> {
  const { error, context, stackTrace } = options;

  try {
    await sendEmail({
      to: "hello@humanlogs.app",
      subject: "Server Error",
      html: buildErrorEmailHtml({
        title: "Server Error",
        error,
        context,
        stackTrace,
      }),
      text: buildErrorEmailText({
        title: "Server Error",
        error,
        context,
        stackTrace,
      }),
    });
    console.log("Error notification sent successfully");
  } catch (emailError) {
    console.error("Failed to send error notification email:", emailError);
  }
}

/**
 * Send a general webhook processing error notification
 */
export async function sendWebhookProcessingError(
  error: Error | string,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stackTrace = error instanceof Error ? error.stack : undefined;

  try {
    await sendEmail({
      to: "hello@humanlogs.app",
      subject: "Server Processing Error",
      html: buildErrorEmailHtml({
        title: "Server Processing Error",
        error: errorMessage,
        stackTrace,
      }),
      text: buildErrorEmailText({
        title: "Server Processing Error",
        error: errorMessage,
        stackTrace,
      }),
    });
    console.log("Webhook processing error notification sent successfully");
  } catch (emailError) {
    console.error("Failed to send processing error notification:", emailError);
  }
}

/**
 * Send a warning notification for non-critical but noteworthy events
 */
export async function sendAdminWarning(
  warning: string,
  context?: Record<string, any>,
): Promise<void> {
  try {
    await sendEmail({
      to: "hello@humanlogs.app",
      subject: "⚠️ Server Warning",
      html: buildWarningEmailHtml({
        title: "Server Warning",
        warning,
        context,
      }),
      text: buildWarningEmailText({
        title: "Server Warning",
        warning,
        context,
      }),
    });
    console.log("Warning notification sent successfully");
  } catch (emailError) {
    console.error("Failed to send warning notification email:", emailError);
  }
}

// Helper functions for email formatting

interface EmailContent {
  title: string;
  error: string;
  context?: Record<string, any>;
  stackTrace?: string;
}

function buildErrorEmailHtml(content: EmailContent): string {
  const { title, error, context, stackTrace } = content;

  return `
    <h2>${title}</h2>
    <p><strong>Error:</strong> ${escapeHtml(error)}</p>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    ${
      context
        ? `
    <h3>Context:</h3>
    <table style="border-collapse: collapse; width: 100%;">
      ${Object.entries(context)
        .map(
          ([key, value]) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>${escapeHtml(key)}:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(String(value))}</td>
        </tr>
      `,
        )
        .join("")}
    </table>
    `
        : ""
    }
    ${
      context && typeof context === "object" && "payload" in context
        ? `
    <h3>Full Payload:</h3>
    <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">${escapeHtml(JSON.stringify(context.payload, null, 2))}</pre>
    `
        : ""
    }
    ${
      stackTrace
        ? `
    <h3>Stack Trace:</h3>
    <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">${escapeHtml(stackTrace)}</pre>
    `
        : ""
    }
  `;
}

function buildErrorEmailText(content: EmailContent): string {
  const { title, error, context, stackTrace } = content;

  let text = `
${title}

Error: ${error}
Timestamp: ${new Date().toISOString()}
`;

  if (context) {
    text += "\nContext:\n";
    for (const [key, value] of Object.entries(context)) {
      if (key !== "payload") {
        text += `  ${key}: ${value}\n`;
      }
    }

    if ("payload" in context) {
      text += "\nFull Payload:\n";
      text += JSON.stringify(context.payload, null, 2);
    }
  }

  if (stackTrace) {
    text += `\n\nStack Trace:\n${stackTrace}`;
  }

  return text.trim();
}

function buildWarningEmailHtml(content: {
  title: string;
  warning: string;
  context?: Record<string, any>;
}): string {
  const { title, warning, context } = content;

  return `
    <div style="border-left: 4px solid #f59e0b; padding-left: 16px;">
      <h2 style="color: #f59e0b;">${title}</h2>
      <p><strong>Warning:</strong> ${escapeHtml(warning)}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    </div>
    ${
      context
        ? `
    <h3>Details:</h3>
    <table style="border-collapse: collapse; width: 100%;">
      ${Object.entries(context)
        .map(
          ([key, value]) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>${escapeHtml(key)}:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(String(value))}</td>
        </tr>
      `,
        )
        .join("")}
    </table>
    `
        : ""
    }
    ${
      context && typeof context === "object" && "payload" in context
        ? `
    <h3>Payload:</h3>
    <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">${escapeHtml(JSON.stringify(context.payload, null, 2))}</pre>
    `
        : ""
    }
  `;
}

function buildWarningEmailText(content: {
  title: string;
  warning: string;
  context?: Record<string, any>;
}): string {
  const { title, warning, context } = content;

  let text = `
${title}

Warning: ${warning}
Timestamp: ${new Date().toISOString()}
`;

  if (context) {
    text += "\nDetails:\n";
    for (const [key, value] of Object.entries(context)) {
      if (key !== "payload") {
        text += `  ${key}: ${value}\n`;
      }
    }

    if ("payload" in context) {
      text += "\nPayload:\n";
      text += JSON.stringify(context.payload, null, 2);
    }
  }

  return text.trim();
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
