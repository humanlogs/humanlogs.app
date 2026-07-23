// Onboarding role model.
//
// The first onboarding step asks for a role. Four headline roles are shown;
// "other" expands to finer professions. The chosen profession is stored as-is
// (for analytics) but also mapped to a coarse "bucket" that drives the second
// step and the smart presets.

export type RoleBucket = "researcher" | "student" | "journalist" | "other";

// Headline roles shown as big buttons.
export const HEADLINE_ROLES = [
  "researcher",
  "student",
  "journalist",
  "other",
] as const;

// Finer professions revealed when the user picks "Other". "other" itself is not
// repeated here — the headline button already represents the generic choice.
export const OTHER_PROFESSIONS = [
  "uxResearcher",
  "phdStudent",
  "podcaster",
  "lawyer",
  "healthcare",
];

// UI languages that map to EU data residency by default.
const EU_LANGUAGES = new Set(["fr", "es", "de"]);

/** Coarse bucket used for step-2 routing and presets. */
export function roleBucket(profession: string): RoleBucket {
  if (profession === "researcher" || profession === "uxResearcher")
    return "researcher";
  if (profession === "student" || profession === "phdStudent") return "student";
  if (profession === "journalist") return "journalist";
  return "other";
}

/**
 * Preset data residency: researchers/students on a European UI language lean
 * EU (Gladia); everyone else leans US (best model). Only meaningful when both
 * providers are configured — otherwise the single available one wins.
 */
export function residencyPreset(
  profession: string,
  locale: string,
): "eu" | "us" {
  const bucket = roleBucket(profession);
  const european = EU_LANGUAGES.has(locale);
  if ((bucket === "researcher" || bucket === "student") && european) {
    return "eu";
  }
  return "us";
}

/** Preset monthly-usage bucket by role — a sensible default, still editable. */
export function hoursPreset(profession: string): string {
  switch (roleBucket(profession)) {
    case "student":
      return "lt1h";
    case "journalist":
      return "h5to20";
    case "researcher":
      return "h1to5";
    default:
      return "h1to5";
  }
}
