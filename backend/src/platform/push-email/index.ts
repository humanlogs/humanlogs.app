import config from "config";
import platform from "..";
import { Context as Context } from "../../types";
import { PlatformService } from "../types";
import PushEMailFile from "./adapters/file";
import PushEMailSES from "./adapters/ses";
import { PushEMailInterfaceAdapterInterface } from "./api";
import { buildHTML } from "./build-email";

export default class PushEMail implements PlatformService {
  private service: PushEMailInterfaceAdapterInterface;

  async init() {
    if (config.get<string>("email.type") === "ses") {
      console.log("PushEmail: Using SES");
      this.service = await new PushEMailSES().init();
    } else {
      console.log("PushEmail: Using File");
      this.service = await new PushEMailFile().init();
    }
    return this;
  }

  async push(
    context: Context,
    email: string,
    message: string,
    options: {
      subject?: string;
      receipt?: [string, string][];
      post_receipt?: string;
      allow_unsubscribe?: boolean;
    } = {}
  ) {
    const language = platform.I18n.getLanguage(context);
    options.subject = options.subject || "New notification from ToText";
    let built = { html: "", text: "" };

    // Create unsubscribe URL if needed
    const unsubscribe_url = options.allow_unsubscribe
      ? `http://api.totext.app/api/auth/unsubscribe?email=${encodeURIComponent(
          email
        )}`
      : undefined;

    try {
      built = await buildHTML({
        title: options.subject,
        body: message,
        language: language,
        receipt: options.receipt,
        post_receipt: options.post_receipt,
        footer: platform.I18n.t(context, "emails.all.footer"),
        unsubscribe_url: unsubscribe_url,
      });
    } catch (e) {
      platform.LoggerDb.get("push-email").error(context, e);
      return;
    }

    try {
      platform.LoggerDb.get("push-email").info(
        context,
        `Sending email to ${email} with subject "${options.subject}" lng="${language}"`
      );

      // Create headers for email clients to detect unsubscribe functionality
      const headers: Record<string, string> = {};

      if (options.allow_unsubscribe && unsubscribe_url) {
        headers["List-Unsubscribe"] = `<${unsubscribe_url}>`;
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
      }

      await this.service.push({
        to: [email],
        message: {
          html: built.html,
          text: built.text,
          subject: options.subject,
        },
        from: `${config.get<string>("email.from_name")} <${config.get<string>(
          "email.from"
        )}>`,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
    } catch (err) {
      platform.LoggerDb.get("push-email").error(context, err);
    }
  }
}
