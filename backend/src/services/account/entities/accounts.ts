import { TableDefinition } from "../../../platform/db/api";
import { columnsFromEntity } from "../../../platform/db/utils";

export class AccountsType {
  id = "string";
  platform = "string";
  platform_id = "string";
  email = "string";
  name = "string";
  avatar = "string";
  consent = false;
  consent_usage = {
    models: [],
    styles: [],
    images: [],
  };
  analytics = {
    features: [],
    sources: [],
  };
  credits = 0;
  credits_used = 0;
  created_at = 0;
  last_login = 0;
  stripe_id = "string";
  stripe_email = "string";
  apple_pay_id = "string"; // Added Apple Pay ID
  plan = "string";
  plan_renew_at = 0;
  moderated = "string"; // ID of the moderated image
  sent_discount_email = 0;
  last_discount_email = 0; // Last time a discount email was sent
  unsubscribed_discount_email = false; // Whether the user has unsubscribed from discount emails
  lang = "string";
  utm_source = "string"; // Added UTM source field
}

export const AccountsDefinition: TableDefinition = {
  name: "accounts",
  columns: {
    ...columnsFromEntity(AccountsType),
  },
  pk: ["id"],
};
