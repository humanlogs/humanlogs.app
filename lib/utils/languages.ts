import type { SelectOption } from "@/components/ui/select";
import _ from "lodash";

/**
 * Languages supported by the transcription providers. Shared between the audio
 * upload form and the text-import form so both offer the same language list.
 */
export const supportedLanguages: Record<string, string> = {
  bel: "Belarusian",
  bos: "Bosnian",
  bul: "Bulgarian",
  cat: "Catalan",
  hrv: "Croatian",
  ces: "Czech",
  dan: "Danish",
  nld: "Dutch",
  eng: "English",
  est: "Estonian",
  fin: "Finnish",
  fra: "Français",
  glg: "Galician",
  deu: "German",
  ell: "Greek",
  hun: "Hungarian",
  isl: "Icelandic",
  ind: "Indonesian",
  ita: "Italian",
  jpn: "Japanese",
  kan: "Kannada",
  lav: "Latvian",
  mkd: "Macedonian",
  msa: "Malay",
  mal: "Malayalam",
  nor: "Norwegian",
  pol: "Polish",
  por: "Portuguese",
  ron: "Romanian",
  rus: "Russian",
  slk: "Slovak",
  spa: "Spanish",
  swe: "Swedish",
  tur: "Turkish",
  ukr: "Ukrainian",
  vie: "Vietnamese",
  hye: "Armenian",
  aze: "Azerbaijani",
  ben: "Bengali",
  fil: "Filipino",
  kat: "Georgian",
  guj: "Gujarati",
  hin: "Hindi",
  kaz: "Kazakh",
  lit: "Lithuanian",
  mlt: "Maltese",
  cmn: "Mandarin",
  mar: "Marathi",
  nep: "Nepali",
  fas: "Persian",
  srp: "Serbian",
  slv: "Slovenian",
  swa: "Swahili",
  tam: "Tamil",
  tel: "Telugu",
  afr: "Afrikaans",
  ara: "Arabic",
  asm: "Assamese",
  mya: "Burmese",
  hau: "Hausa",
  heb: "Hebrew",
  jav: "Javanese",
  kor: "Korean",
  ltz: "Luxembourgish",
  mri: "Māori",
  oci: "Occitan",
  pan: "Punjabi",
  tgk: "Tajik",
  tha: "Thai",
  uzb: "Uzbek",
  cym: "Welsh",
  amh: "Amharic",
  khm: "Khmer",
  lao: "Lao",
  mon: "Mongolian",
  pus: "Pashto",
  sna: "Shona",
  snd: "Sindhi",
  som: "Somali",
  urd: "Urdu",
  yor: "Yoruba",
};

// The most commonly used languages, surfaced at the top of the selector
// (followed by a separator) before the alphabetical list of the rest.
export const TOP_LANGUAGES = ["eng", "fra", "spa", "deu", "ita"];

// Cache the computed option list per locale: deriving names via Intl is cheap
// but there's no reason to redo it on every render.
const languageOptionsCache = new Map<string, SelectOption[]>();

/**
 * Build the language selector options for a given UI locale. Each option's
 * label shows the language name translated into the current locale alongside
 * its name in its own dialect (e.g. "German (Deutsch)"), and both names — plus
 * the ISO code — are searchable.
 */
export function getLanguageOptions(locale: string): SelectOption[] {
  const cached = languageOptionsCache.get(locale);
  if (cached) return cached;

  const translatedNames = new Intl.DisplayNames([locale], { type: "language" });

  const buildOption = (code: string): SelectOption => {
    let translated: string;
    try {
      translated = translatedNames.of(code) ?? supportedLanguages[code];
    } catch {
      translated = supportedLanguages[code];
    }

    let native = translated;
    try {
      native =
        new Intl.DisplayNames([code], { type: "language" }).of(code) ??
        translated;
    } catch {
      native = translated;
    }

    const sameName = native.toLowerCase() === translated.toLowerCase();
    return {
      value: code,
      label: sameName ? translated : `${translated} (${native})`,
      keywords: sameName ? [translated, code] : [translated, native, code],
    };
  };

  const allCodes = Object.keys(supportedLanguages);
  const topCodes = TOP_LANGUAGES.filter((code) => allCodes.includes(code));
  const restCodes = allCodes.filter((code) => !topCodes.includes(code));

  const options: SelectOption[] = [
    ...topCodes.map(buildOption),
    { value: "__separator__", label: "", separator: true },
    ..._.sortBy(restCodes.map(buildOption), (option) =>
      option.label.toLowerCase(),
    ),
  ];

  languageOptionsCache.set(locale, options);
  return options;
}
