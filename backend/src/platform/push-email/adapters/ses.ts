import config from "config";
import { SES } from "@aws-sdk/client-ses";
import { PushEMailInterfaceAdapterInterface } from "../api";

export default class PushEMailSES
  implements PushEMailInterfaceAdapterInterface
{
  private ses: SES;

  async init() {
    this.ses = new SES({
      apiVersion: "2010-12-01",
      region: config.get<string>("aws.region"),
      credentials: {
        accessKeyId: config.get<string>("aws.id"),
        secretAccessKey: config.get<string>("aws.secret"),
      },
      ...(config.get<string>("email.ses.region")
        ? { region: config.get<string>("email.ses.region") }
        : {}),
    });
    return this;
  }

  async push(email: {
    to: string[];
    message: {
      html: string;
      text: string;
      subject: string;
    };
    from: string;
    headers?: Record<string, string>;
  }) {
    const params = {
      Destination: {
        ToAddresses: email.to,
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: email.message.html,
          },
          Text: {
            Charset: "UTF-8",
            Data: email.message.text,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: email.message.subject,
        },
      },
      ReplyToAddresses: [email.from],
      Source: email.from,
      Headers: email.headers
        ? Object.entries(email.headers).map(([name, value]) => ({
            Name: name,
            Value: value,
          }))
        : undefined,
    };
    await this.ses.sendEmail(params);
  }
}
