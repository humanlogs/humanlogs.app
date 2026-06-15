export type SeoSlugConfig = {
  slug: string;
  tier: 1 | 2 | 3;
  keywords: {
    primary: string;
    secondary: string[];
  };
};

// English SEO slugs
export const EN_SEO_SLUGS: SeoSlugConfig[] = [
  // TIER 1
  {
    slug: "encrypted-transcription-research-interviews",
    tier: 1,
    keywords: {
      primary: "transcription tool end-to-end encrypted interviews",
      secondary: [
        "encrypted transcription software",
        "secure interview transcription",
      ],
    },
  },
  {
    slug: "irb-compliant-transcription-qualitative-research",
    tier: 1,
    keywords: {
      primary: "transcription software IRB compliant qualitative research",
      secondary: [
        "IRB approved transcription",
        "ethics compliant transcription",
      ],
    },
  },
  {
    slug: "gdpr-compliant-transcription-phd-interviews",
    tier: 1,
    keywords: {
      primary: "GDPR compliant transcription PhD interviews",
      secondary: ["GDPR transcription research", "EU compliant transcription"],
    },
  },
  {
    slug: "eu-data-residency-qualitative-research-transcription",
    tier: 1,
    keywords: {
      primary: "transcription tool EU data residency",
      secondary: [
        "European data residency transcription",
        "EU server transcription",
      ],
    },
  },
  {
    slug: "encrypted-transcription-clinical-psychology",
    tier: 1,
    keywords: {
      primary: "encrypted transcription software clinical psychology",
      secondary: [
        "clinical psychology transcription",
        "therapy transcription encrypted",
      ],
    },
  },
  {
    slug: "open-source-transcription-tool-researchers",
    tier: 1,
    keywords: {
      primary: "open source transcription tool researchers",
      secondary: [
        "open source research transcription",
        "self-hosted transcription",
      ],
    },
  },

  // TIER 2
  {
    slug: "best-transcription-software-qualitative-research-2026",
    tier: 2,
    keywords: {
      primary: "best transcription software qualitative research 2026",
      secondary: [
        "top transcription tools research",
        "qualitative research transcription comparison",
      ],
    },
  },
  {
    slug: "transcription-tool-dissertation-interviews",
    tier: 2,
    keywords: {
      primary: "transcription tool for dissertation interviews",
      secondary: ["dissertation transcription", "PhD interview transcription"],
    },
  },
  {
    slug: "audio-linked-editor-transcription",
    tier: 2,
    keywords: {
      primary: "transcription with audio-linked editor",
      secondary: [
        "audio-synced transcript editor",
        "interactive transcript editor",
      ],
    },
  },
  {
    slug: "transcription-software-phd-students-france",
    tier: 2,
    keywords: {
      primary: "transcription software PhD students France",
      secondary: ["French PhD transcription", "France academic transcription"],
    },
  },
  {
    slug: "hipaa-gdpr-transcription-interviews-eu",
    tier: 2,
    keywords: {
      primary: "HIPAA GDPR transcription interviews EU",
      secondary: [
        "dual compliance transcription",
        "healthcare research transcription",
      ],
    },
  },

  {
    slug: "transcription-tool-ux-research-user-interviews",
    tier: 1,
    keywords: {
      primary: "transcription tool for UX research user interviews",
      secondary: [
        "UX research transcription software",
        "user interview transcription encrypted",
      ],
    },
  },

  // TIER 3
  {
    slug: "best-free-transcription-software-researchers",
    tier: 3,
    keywords: {
      primary: "best free transcription software researchers",
      secondary: [
        "free transcription tool academic",
        "free research transcription",
      ],
    },
  },
  {
    slug: "transcription-tool-academic-interviews",
    tier: 3,
    keywords: {
      primary: "transcription tool for academic interviews",
      secondary: [
        "academic interview transcription",
        "university research transcription",
      ],
    },
  },
  {
    slug: "transcription-software-qualitative-data-analysis",
    tier: 3,
    keywords: {
      primary: "transcription software qualitative data analysis",
      secondary: ["NVivo transcription", "MAXQDA transcription tool"],
    },
  },
];

// French SEO slugs
export const FR_SEO_SLUGS: SeoSlugConfig[] = [
  // TIER 1
  {
    slug: "transcription-entretiens-recherche-qualitative",
    tier: 1,
    keywords: {
      primary: "logiciel transcription entretien recherche",
      secondary: [
        "retranscrire entretien recherche qualitative",
        "outil transcription entretiens",
      ],
    },
  },
  {
    slug: "transcription-entretien-rgpd-recherche",
    tier: 1,
    keywords: {
      primary: "transcription entretien RGPD recherche",
      secondary: ["transcription conforme RGPD", "outil transcription RGPD"],
    },
  },
  {
    slug: "logiciel-transcription-these",
    tier: 1,
    keywords: {
      primary: "logiciel transcription thèse",
      secondary: [
        "transcription entretiens thèse",
        "outil transcription doctorat",
      ],
    },
  },
  {
    slug: "transcription-entretien-chiffrement",
    tier: 1,
    keywords: {
      primary: "transcription entretien chiffrement",
      secondary: [
        "transcription chiffrée bout en bout",
        "transcription cryptée entretiens",
      ],
    },
  },

  {
    slug: "transcription-psychologie-clinique-confidentielle",
    tier: 1,
    keywords: {
      primary: "logiciel transcription psychologie clinique confidentielle",
      secondary: [
        "transcription entretiens psychologie RGPD",
        "logiciel transcription psychologue chiffré",
      ],
    },
  },

  // TIER 2
  {
    slug: "outil-retranscription-entretien-gratuit",
    tier: 2,
    keywords: {
      primary: "outil retranscription entretien gratuit",
      secondary: [
        "logiciel transcription gratuit",
        "transcription gratuite entretiens",
      ],
    },
  },
  {
    slug: "meilleur-logiciel-transcription-entretien",
    tier: 2,
    keywords: {
      primary: "meilleur logiciel transcription entretien",
      secondary: [
        "comparatif logiciel transcription",
        "top logiciel transcription",
      ],
    },
  },
];

// Helper functions
export function getSeoSlugConfig(
  slug: string,
  locale: "en" | "fr",
): SeoSlugConfig | undefined {
  const slugs = locale === "fr" ? FR_SEO_SLUGS : EN_SEO_SLUGS;
  return slugs.find((s) => s.slug === slug);
}

export function getAllSeoSlugs(locale: "en" | "fr"): string[] {
  const slugs = locale === "fr" ? FR_SEO_SLUGS : EN_SEO_SLUGS;
  return slugs.map((s) => s.slug);
}
