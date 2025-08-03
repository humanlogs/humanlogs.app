import config from "config";
import fs from "fs";
import { PushEMailInterfaceAdapterInterface } from "../api";

export default class PushEMailFile
  implements PushEMailInterfaceAdapterInterface
{
  async init() {
    const path = config.get<string>("email.file.path");
    fs.mkdirSync(path, { recursive: true });
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
    const path = config.get<string>("email.file.path");
    const filename = `${path}/${Date.now()}.txt`;

    let content = email.message.text;

    // Add headers to file output for debugging purposes
    if (email.headers) {
      const headersStr = Object.entries(email.headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      content = `--- HEADERS ---\n${headersStr}\n\n--- CONTENT ---\n${content}`;
    }

    fs.writeFileSync(filename, content);
  }
}
