import nodemailer, { Transporter } from "nodemailer";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { getConfig } from "./config";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

class Mailer {
  private static instance: Mailer;
  private transporter: Transporter | null = null;
  private sesClient: SESClient | null = null;
  private config = getConfig();
  private isConfigured = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): Mailer {
    if (!Mailer.instance) {
      Mailer.instance = new Mailer();
    }
    return Mailer.instance;
  }

  private initialize() {
    const emailConfig = this.config.email;

    // If email config doesn't exist or provider is not set, skip initialization
    if (!emailConfig || !emailConfig.provider) {
      console.warn("Email service is not configured. Emails will not be sent.");
      this.isConfigured = false;
      return;
    }

    if (emailConfig.provider === "smtp") {
      if (
        !emailConfig.smtp ||
        !emailConfig.smtp.auth.user ||
        !emailConfig.smtp.auth.pass
      ) {
        console.warn(
          "SMTP configuration is incomplete. Emails will not be sent.",
        );
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        auth: {
          user: emailConfig.smtp.auth.user,
          pass: emailConfig.smtp.auth.pass,
        },
      });
      this.isConfigured = true;
    } else if (emailConfig.provider === "ses") {
      if (!emailConfig.ses) {
        console.warn(
          "SES configuration is incomplete. Emails will not be sent.",
        );
        this.isConfigured = false;
        return;
      }

      this.sesClient = new SESClient({
        region: emailConfig.ses.region,
      });
      this.isConfigured = true;
    } else {
      console.warn(
        `Unsupported email provider: ${emailConfig.provider}. Emails will not be sent.`,
      );
      this.isConfigured = false;
    }
  }

  /**
   * Send an email using the configured provider (SMTP or SES)
   */
  public async sendEmail(options: EmailOptions): Promise<void> {
    // If email is not configured, fail silently
    if (!this.isConfigured) {
      console.warn(
        `Email service is not configured. Skipping email to: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`,
      );
      return;
    }

    const emailConfig = this.config.email;
    if (!emailConfig || !emailConfig.from) {
      console.warn("Email configuration is incomplete. Skipping email.");
      return;
    }

    if (!options.html && !options.text) {
      console.warn(
        "Either html or text content must be provided. Skipping email.",
      );
      return;
    }

    const from = `"${emailConfig.from.name}" <${emailConfig.from.address}>`;
    const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;
    const cc = options.cc
      ? Array.isArray(options.cc)
        ? options.cc.join(", ")
        : options.cc
      : undefined;
    const bcc = options.bcc
      ? Array.isArray(options.bcc)
        ? options.bcc.join(", ")
        : options.bcc
      : undefined;

    if (emailConfig.provider === "smtp") {
      await this.sendViaSMTP({
        from,
        to,
        cc,
        bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });
    } else if (emailConfig.provider === "ses") {
      await this.sendViaSES({
        from,
        to,
        cc,
        bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });
    }
  }

  /**
   * Send email via SMTP using nodemailer
   */
  private async sendViaSMTP(mailOptions: {
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
    attachments?: EmailOptions["attachments"];
  }): Promise<void> {
    if (!this.transporter) {
      throw new Error("SMTP transporter is not initialized");
    }

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully via SMTP to ${mailOptions.to}`);
    } catch (error) {
      console.error("Failed to send email via SMTP:", error);
      throw new Error("Failed to send email via SMTP");
    }
  }

  /**
   * Send email via AWS SES
   */
  private async sendViaSES(mailOptions: {
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
    attachments?: EmailOptions["attachments"];
  }): Promise<void> {
    if (!this.sesClient) {
      throw new Error("SES client is not initialized");
    }

    try {
      // Build the raw email message
      const rawMessage = this.buildRawEmail(mailOptions);

      const command = new SendRawEmailCommand({
        RawMessage: {
          Data: Buffer.from(rawMessage),
        },
      });

      await this.sesClient.send(command);
      console.log(`Email sent successfully via SES to ${mailOptions.to}`);
    } catch (error) {
      console.error("Failed to send email via SES:", error);
      throw new Error("Failed to send email via SES");
    }
  }

  /**
   * Build a raw email message for SES
   */
  private buildRawEmail(mailOptions: {
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
    attachments?: EmailOptions["attachments"];
  }): string {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const lines: string[] = [];

    // Headers
    lines.push(`From: ${mailOptions.from}`);
    lines.push(`To: ${mailOptions.to}`);
    if (mailOptions.cc) lines.push(`Cc: ${mailOptions.cc}`);
    if (mailOptions.bcc) lines.push(`Bcc: ${mailOptions.bcc}`);
    if (mailOptions.replyTo) lines.push(`Reply-To: ${mailOptions.replyTo}`);
    lines.push(`Subject: ${mailOptions.subject}`);
    lines.push(`MIME-Version: 1.0`);
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");

    // Text part
    if (mailOptions.text) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: text/plain; charset=UTF-8`);
      lines.push(`Content-Transfer-Encoding: 7bit`);
      lines.push("");
      lines.push(mailOptions.text);
      lines.push("");
    }

    // HTML part
    if (mailOptions.html) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: text/html; charset=UTF-8`);
      lines.push(`Content-Transfer-Encoding: 7bit`);
      lines.push("");
      lines.push(mailOptions.html);
      lines.push("");
    }

    lines.push(`--${boundary}--`);

    return lines.join("\r\n");
  }

  /**
   * Verify the email configuration by attempting to connect
   */
  public async verify(): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn("Email service is not configured.");
      return false;
    }

    const emailConfig = this.config.email;
    if (!emailConfig) {
      return false;
    }

    if (emailConfig.provider === "smtp") {
      if (!this.transporter) {
        console.warn("SMTP transporter is not initialized");
        return false;
      }

      try {
        await this.transporter.verify();
        console.log("SMTP connection verified successfully");
        return true;
      } catch (error) {
        console.error("SMTP verification failed:", error);
        return false;
      }
    } else if (emailConfig.provider === "ses") {
      // For SES, we can't really verify the connection without sending an email
      // Just check if the client is initialized
      return this.sesClient !== null;
    }

    return false;
  }
}

// Export singleton instance
export const mailer = Mailer.getInstance();

// Export helper function
export async function sendEmail(options: EmailOptions): Promise<void> {
  return mailer.sendEmail(options);
}
