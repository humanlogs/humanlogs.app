# SEO Research Pages Implementation

## Overview

This implementation creates SEO-optimized landing pages for research-specific keywords using a scalable, config-driven approach. All pages reuse the existing research use-case content while customizing only the hero section.

## Structure

### Route: `/[locale]/use-cases/research/[slug]`

- **English pages**: 14 SEO-targeted pages (Tiers 1-3)
- **French pages**: 6 SEO-targeted pages

## Files Created

### 1. Configuration File

**`lib/seo-research-slugs.ts`**

- Defines all available slugs for EN and FR
- Contains keywords for SEO (primary + secondary)
- Tier classification (1 = high intent/low competition, 3 = high volume/harder)
- Helper functions: `getSeoSlugConfig()`, `getAllSeoSlugs()`

### 2. Page Route

**`app/(landing)/[locale]/use-cases/research/[slug]/page.tsx`**

- Reuses components from the main research page:
  - `WhyBestSection` (unchanged)
  - `FeaturesListSection` (unchanged)
  - `TestimonialsSection` (unchanged)
  - `FAQSection` (unchanged)
  - `CTASection` (unchanged)
- **Only customizes**: `SeoHeroSection` with slug-specific title and intro

### 3. Layout (Metadata & SEO)

**`app/(landing)/[locale]/use-cases/research/[slug]/layout.tsx`**

- Generates static paths for all slugs
- Uses `defaultMetadata()` helper for consistent OpenGraph, Twitter cards, and other meta tags
- Custom keywords per slug for SEO
- Canonical URLs and robots directives
- Reduces code duplication across all use-case pages

### 4. Translation Files

**`messages/en/seo-research-content.json`**

- Contains title, description, and intro for each slug
- Example:
  ```json
  {
    "encrypted-transcription-research-interviews": {
      "title": "End-to-End Encrypted Transcription...",
      "description": "Military-grade encryption...",
      "intro": "When conducting sensitive research..."
    }
  }
  ```

**`messages/fr/seo-research-content.json`**

- French versions for 6 priority keywords

## All SEO Pages Created

### English (14 pages)

#### Tier 1 — High Intent, Low Competition

1. `/en/use-cases/research/encrypted-transcription-research-interviews`
   - **Keywords**: transcription tool end-to-end encrypted interviews
2. `/en/use-cases/research/irb-compliant-transcription-qualitative-research`
   - **Keywords**: transcription software IRB compliant qualitative research
3. `/en/use-cases/research/gdpr-compliant-transcription-phd-interviews`
   - **Keywords**: GDPR compliant transcription PhD interviews
4. `/en/use-cases/research/eu-data-residency-qualitative-research-transcription`
   - **Keywords**: transcription tool EU data residency
5. `/en/use-cases/research/encrypted-transcription-clinical-psychology`
   - **Keywords**: encrypted transcription software clinical psychology
6. `/en/use-cases/research/open-source-transcription-tool-researchers`
   - **Keywords**: open source transcription tool researchers

#### Tier 2 — Medium Competition

7. `/en/use-cases/research/best-transcription-software-qualitative-research-2026`
8. `/en/use-cases/research/transcription-tool-dissertation-interviews`
9. `/en/use-cases/research/audio-linked-editor-transcription`
10. `/en/use-cases/research/transcription-software-phd-students-france`
11. `/en/use-cases/research/hipaa-gdpr-transcription-interviews-eu`

#### Tier 3 — High Volume

12. `/en/use-cases/research/best-free-transcription-software-researchers`
13. `/en/use-cases/research/transcription-tool-academic-interviews`
14. `/en/use-cases/research/transcription-software-qualitative-data-analysis`

### French (6 pages)

#### Tier 1 — Uncovered/Low Competition

1. `/fr/use-cases/research/transcription-entretiens-recherche-qualitative`
   - **Keywords**: logiciel transcription entretien recherche
2. `/fr/use-cases/research/transcription-entretien-rgpd-recherche`
   - **Keywords**: transcription entretien RGPD recherche
3. `/fr/use-cases/research/logiciel-transcription-these`
   - **Keywords**: logiciel transcription thèse
4. `/fr/use-cases/research/transcription-entretien-chiffrement`
   - **Keywords**: transcription entretien chiffrement

#### Tier 2

5. `/fr/use-cases/research/outil-retranscription-entretien-gratuit`
6. `/fr/use-cases/research/meilleur-logiciel-transcription-entretien`

## How It Works

### DRY Metadata Pattern

All layouts use the `defaultMetadata()` helper from `lib/metadatas.ts` to avoid repeating OpenGraph, Twitter card, and other common metadata:

```typescript
import { defaultMetadata } from "@/lib/metadatas";

return {
  ...defaultMetadata(
    `https://humanlogs.app/${locale}/use-cases/research/${slug}`,
  ),
  title: `${title} | HumanLogs`,
  description,
  keywords: [config.keywords.primary, ...config.keywords.secondary],
};
```

This ensures consistency across all pages and makes updates easier.

### Static Generation

All pages are pre-rendered at build time using `generateStaticParams()`:

```typescript
export async function generateStaticParams() {
  const enSlugs = getAllSeoSlugs("en").map((slug) => ({ locale: "en", slug }));
  const frSlugs = getAllSeoSlugs("fr").map((slug) => ({ locale: "fr", slug }));
  return [...enSlugs, ...frSlugs];
}
```

### SEO Features

✅ **Title optimization**: Unique, keyword-rich titles per page  
✅ **Meta descriptions**: Compelling descriptions with CTAs  
✅ **OpenGraph tags**: Social media sharing optimization  
✅ **Twitter Cards**: Enhanced Twitter previews  
✅ **Canonical URLs**: Prevents duplicate content  
✅ **Structured data**: JSON-LD for rich snippets  
✅ **Keywords meta tag**: Primary + secondary keywords  
✅ **Robots directives**: Full indexing enabled

### Content Reuse

- **Hero section**: Customized per slug (title + intro)
- **Why Best section**: Shared from main research page
- **Features**: Shared from main research page
- **Testimonials**: Shared from main research page
- **FAQ**: Shared from main research page
- **SEO Resources section**: New section on main research page linking to all top 6 Tier 1 SEO pages
- **CTA**: Shared from main research page

### Internal Linking

The main research page (`/use-cases/research`) now includes a "Specialized Resources for Researchers" section that automatically displays links to the top 6 Tier 1 SEO pages. This provides:

- **Internal link juice** for SEO
- **User-friendly navigation** to specific topics
- **Automatic updates** when new Tier 1 pages are added

This creates a hub-and-spoke model where the main research page acts as a content hub linking to specialized topic pages.

## Adding New SEO Pages

### 1. Add slug to config (`lib/seo-research-slugs.ts`)

```typescript
{
  slug: 'new-keyword-page',
  tier: 1,
  keywords: {
    primary: 'your primary keyword',
    secondary: ['related keyword 1', 'related keyword 2']
  }
}
```

### 2. Add translations (`messages/en/seo-research-content.json`)

```json
{
  "new-keyword-page": {
    "title": "Page Title with Keywords",
    "description": "Meta description",
    "intro": "Hero section intro paragraph"
  }
}
```

### 3. Build

Pages are automatically generated at build time. No additional routing needed!

## Performance

- **Static generation**: All pages pre-rendered
- **Shared components**: Reuses existing React components
- **Code splitting**: Lazy-loaded translations
- **No duplication**: Single source of truth for UI

## SEO Strategy Summary

### Target Keywords

- **Tier 1** (6 EN + 4 FR): Ultra-specific, low competition, high conversion
  - Priority: These should rank within 3-6 months
  - Focus: IRB/GDPR compliance, encryption, EU data residency
- **Tier 2** (5 EN + 2 FR): Medium competition, comparison intent
  - Priority: 6-12 months to rank
  - Focus: "Best of" comparisons, PhD-specific needs
- **Tier 3** (3 EN): High volume, harder to rank
  - Priority: Long-term play (12+ months)
  - Focus: Broad academic terms

### Recommended Next Steps

1. **Submit sitemap** to Google Search Console
2. **Create internal links** from main research page to SEO pages
3. **Add blog posts** linking to these pages
4. **Monitor rankings** with Google Search Console
5. **A/B test titles** in Search Console after 3 months
6. **Add FAQ schema** for featured snippets
7. **Build backlinks** from academic forums/Reddit

## Notes

- All pages use the same testimonials, features, and FAQ sections
- Only hero sections are customized per keyword
- French pages focus on uncovered keywords (RGPD, thèse, chiffrement)
- Structured data included for better Google understanding
