import { defineRouting } from "next-intl/routing";
import { locales } from "../utils/i18n";

export const routing = defineRouting({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale: "en",
});
