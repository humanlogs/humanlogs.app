import { PlatformService } from "../types";

export interface PushEMailInterfaceAdapterInterface extends PlatformService {
  push(email: {
    to: string[];
    message: {
      html: string;
      text: string;
      subject: string;
    };
    from: string;
    headers?: Record<string, string>;
  }): Promise<void>;
}
