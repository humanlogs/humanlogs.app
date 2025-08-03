import config from "config";
import { Context as Context } from "../../types";
import { PlatformService } from "../types";

export default class I18n implements PlatformService {
  private default = "en";
  private languages = ["en", "fr"];
  private locales = {};

  async init(): Promise<this> {
    this.languages.forEach((lang) => {
      this.locales[lang] = flattenJSON(
        require(`../../../assets/locales/${lang}.json`) || {}
      );
    });

    return this;
  }

  getLanguage(ctx: Pick<Context, "lang">, country?: string): string {
    const proposal = (ctx.lang || "").slice(0, 2).toLocaleLowerCase();
    const proposalCountry = (country || "").slice(0, 2).toLocaleLowerCase();
    const res =
      this.languages.find((lang) => lang === proposal) ||
      this.languages.find((lang) => lang === proposalCountry) ||
      this.default;

    console.log("getLanguage", ctx.lang, country, res);
    return res;
  }

  t(
    ctx: Pick<Context, "lang">,
    key: string,
    options?: { replacements?: string[]; fallback?: string }
  ): string {
    const lang = this.getLanguage(ctx);
    let translation =
      this.locales[lang]?.[key] ||
      this.locales[this.default]?.[key] ||
      options?.fallback ||
      key;

    translation = translation.replace(
      new RegExp("\\$domain", "gm"),
      config.get<string>("server.domain")
    );

    let i = 1;
    for (const replacement of options?.replacements || []) {
      translation = translation.replace(
        new RegExp("\\$" + i, "gm"),
        replacement
      );
      i++;
    }
    return translation;
  }
}

const flattenJSON = (obj = {}, res = {}, extraKey = "") => {
  for (const key in obj) {
    if (typeof obj[key] !== "object") {
      res[extraKey + key] = obj[key];
    } else {
      flattenJSON(obj[key], res, `${extraKey}${key}.`);
    }
  }
  return res;
};
