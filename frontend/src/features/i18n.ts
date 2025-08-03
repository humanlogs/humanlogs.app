import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

const languageDefault = "en";
const languageAvailable = ["fr", "en"];

const hashCode = function (s: string) {
  return s.split("").reduce(function (a, b) {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: languageDefault,
    supportedLngs: languageAvailable,
    backend: {
      loadPath: "/locales/{{lng}}.json?v=" + hashCode(document.head.innerHTML),
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      bindI18n: "languageChanged",
      bindI18nStore: "",
      transEmptyNodeValue: "",
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ["br", "strong", "i"],
      useSuspense: true,
    },
  });

export default i18n;
