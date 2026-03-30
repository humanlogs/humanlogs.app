# HumanLogs.app Landing Page Project

## Brand Identity

**Name:** HumanLogs.app  
**Tagline:** "Logging what humans say, for the future and for research"  
**Positioning:** Privacy-first, speed-optimized transcription platform for academic research

## Core Pillars

### 1. Privacy

- **End-to-End Encryption:** All transcriptions are encrypted from upload to export
- **Zero Retention Policy:** No data stored on our servers after processing
- **GDPR Compliant:** Full compliance with European data protection regulations
- **Your Data is Not Our Business:** Unlike competitors, we never share, sell, or use recordings to train AI models

### 2. Speed

- **Keyboard-First Workflow:** Navigate and edit entirely from keyboard
- **Word-Audio Binding:** Click any word to jump to that exact moment in audio
- **10-Minute Turnaround:** 1-hour audio transcribed in under 10 minutes
- **Advanced Editor:** Coder-like features for power users (search & replace, batch operations, custom shortcuts)

### 3. Transparency

- **Open Source:** Free self-hosted version available on GitHub
- **No Hidden Costs:** Clear, straightforward pricing
- **Academic-First:** Built for researchers who need reliable, ethical tools

## Target Audience

**Primary:** Researchers, PhD candidates, universities, research institutions  
**Secondary:** Journalists, legal professionals, consultants requiring privacy  
**Use Cases:**

- Academic interviews and field research
- Dissertation and thesis work
- Qualitative data analysis
- Institutional research projects
- Multi-language international studies

## Pricing Model

### Open Source / On-Premise

**Price:** Free (requires ElevenLabs API key)

- All features included for personal use
- Self-hosted on your infrastructure
- Full control over data
- Contact us for professional/academic licensing
- University-wide deployment available

### Cloud - Free Tier

**Price:** €0/month

- 100 minutes per month
- All features included
- End-to-end encryption
- 32 languages supported
- No credit card required

### Cloud - Pro Plan

**Price:** €15/month (€12/month annual)

- 20 hours per month
- All features included
- Priority support
- Team collaboration
- Advanced export formats

### Cloud - Pay As You Go

**Price:** €20 one-time

- 20 hours of credits
- Never expires
- All features included
- Perfect for occasional users

### University / Academic Edition

**Contact Sales for Custom Pricing**

- LDAP / Active Directory integration
- Use our ElevenLabs keys (zero-retention mode)
- Or full on-premise with Whisper (lower quality, full control)
- Admin panels and user management
- Dedicated support and training
- Volume discounts available

## Feature Set

### Core Features

- ✅ End-to-end encryption
- ✅ Real-time collaboration and sharing
- ✅ Ultra-fast keyboard-driven editor
- ✅ Import existing transcriptions (free)
- ✅ 32 languages supported
- ✅ 1-hour audio → transcribed in <10 minutes
- ✅ Word-audio synchronization
- ✅ Speaker identification and labeling
- ✅ Custom keyboard shortcuts

### Advanced Editor Features

- 🎯 Advanced search and replace (regex support)
- 🎯 Speaker-wide changes (edit all instances at once)
- 🎯 Multi-cursor editing
- 🎯 Custom shortcuts configuration
- 🎯 Command palette (like VS Code)
- 🎯 Undo/redo history
- 🎯 Real-time auto-save

### Export Formats

- 📄 Plain text (.txt)
- 📄 Microsoft Word (.docx)
- 📄 CSV with timestamps
- 📄 JSON (structured data)
- 📄 SRT/VTT subtitles
- 📄 Text without punctuation
- 📄 Word frequency analysis
- 📄 Speaker-separated exports

### Privacy & Compliance

- 🔒 End-to-end encryption
- 🔒 Zero-retention policy
- 🔒 GDPR compliant
- 🔒 ISO 27001 ready (academic edition)
- 🔒 No data used for AI training
- 🔒 EU-based infrastructure
- 🔒 Data processing agreements available

### Enterprise/Academic Features

- 🏛️ LDAP/Active Directory integration
- 🏛️ SSO (Single Sign-On)
- 🏛️ Custom branding
- 🏛️ Admin dashboard
- 🏛️ User management
- 🏛️ Usage analytics
- 🏛️ Dedicated support
- 🏛️ On-premise deployment options

## Competitive Advantages

1. **Privacy by Design:** We can't access your data even if we wanted to
2. **Academic Pricing:** Significantly cheaper than Rev, Otter, or competitors
3. **Open Source Option:** Trust through transparency
4. **Speed:** Keyboard shortcuts make editing 10x faster
5. **No Vendor Lock-in:** Export your data anytime, any format
6. **Researcher-Built:** Made by academics, for academics

## Site Map Structure

### Main Navigation

1. **Home** (/)
2. **Features** (/features)
3. **Pricing** (/pricing)
4. **Use Cases** (/use-cases)
   - For Researchers (/use-cases/researchers)
   - For Universities (/use-cases/universities)
   - For PhD Students (/use-cases/phd-students)
   - For Qualitative Analysis (/use-cases/qualitative-analysis)
   - For Multi-language Studies (/use-cases/multilingual)
5. **Open Source** (/open-source)
6. **Security** (/security)
7. **Contact Sales** (/contact-sales)
8. **Documentation** (/docs)
9. **Blog** (/blog)

### Footer Navigation

- About Us
- Privacy Policy
- Terms of Service
- Data Processing Agreement
- GDPR Compliance
- Contact Support
- GitHub Repository
- Community Forum

### Call-to-Action Hierarchy

1. **Primary CTA:** "Start Free Trial" (100 min free)
2. **Secondary CTA:** "See Demo" (editor showcase)
3. **Tertiary CTA:** "Download Open Source"
4. **Enterprise CTA:** "Contact Sales" (universities)

## Design Approach (DA)

### Visual Identity

**Theme:** Scientific precision meets modern developer tools  
**Inspiration:** GitHub + Linear + Notion (clean, professional, functional)  
**Color Palette:**

- Primary: Deep blue (#1E3A8A) - Trust, academia
- Secondary: Bright cyan (#06B6D4) - Technology, speed
- Accent: Amber (#F59E0B) - Highlights, CTAs
- Neutral: Slate grays (#1E293B to #F8FAFC)

### Typography

- **Headings:** Inter (clean, modern, readable)
- **Body:** Inter (consistency, web-safe)
- **Code/Monospace:** JetBrains Mono (for shortcuts, technical content)

### Animation & Interactions

- Subtle fade-ins on scroll
- Typewriter effects for code/shortcuts
- Waveform visualizations for audio
- Smooth transitions between sections
- Micro-interactions on hover/click
- Demo videos embedded inline

### Key Visual Elements

1. **Hero:** Animated waveform + transcript syncing effect
2. **Privacy:** Encryption visualization (lock + shield animations)
3. **Speed:** Keyboard shortcut showcase (interactive demo)
4. **Editor Demo:** Embedded video or interactive component
5. **Testimonials:** University logos + researcher quotes
6. **Comparison Table:** vs. competitors (feature matrix)

## Component Architecture

All sections are standalone, reusable React components that can be composed into any page layout.

### Layout Components

1. **Navigation** (`Navigation.tsx`)
   - Sticky header
   - Mobile responsive menu
   - CTA buttons in nav

2. **Footer** (`Footer.tsx`)
   - Multi-column links
   - Newsletter signup
   - Social links
   - Trust badges

### Hero Sections

3. **HeroMain** (`HeroMain.tsx`)
   - Primary landing hero
   - Headline + subhead + 2 CTAs
   - Animated background
   - Trust indicators (user count, rating)

4. **HeroFeature** (`HeroFeature.tsx`)
   - Feature page hero
   - Focused on single value prop
   - Screenshot/demo preview

5. **HeroUseCase** (`HeroUseCase.tsx`)
   - Use case specific hero
   - Persona-focused messaging
   - Role-specific CTA

### Feature Sections

6. **FeatureGrid** (`FeatureGrid.tsx`)
   - 3-column grid of features
   - Icon + title + description
   - Reorderable items

7. **FeatureShowcase** (`FeatureShowcase.tsx`)
   - Large image/video on one side
   - Text content on other side
   - Alternating left/right layout

8. **FeatureComparison** (`FeatureComparison.tsx`)
   - Side-by-side comparison
   - HumanLogs vs. Competitors
   - Checkmarks and highlights

### Pricing Sections

9. **PricingTable** (`PricingTable.tsx`)
   - 3-4 column pricing cards
   - Feature lists with tooltips
   - Highlighted "popular" option
   - Toggle: monthly/annual

10. **PricingFAQ** (`PricingFAQ.tsx`)
    - Accordion-style questions
    - Pricing-specific concerns
    - Link to full FAQ

### Social Proof

11. **Testimonials** (`Testimonials.tsx`)
    - Rotating carousel
    - Photo + quote + name + institution
    - 3-5 testimonials

12. **LogoCloud** (`LogoCloud.tsx`)
    - University/institution logos
    - Grayscale with hover color
    - "Trusted by" heading

13. **Stats** (`Stats.tsx`)
    - 3-4 key metrics
    - Large numbers with labels
    - Animated count-up on scroll

### Interactive/Demo

14. **EditorDemo** (`EditorDemo.tsx`)
    - Interactive transcript editor preview
    - Keyboard shortcut highlighting
    - Word-audio sync demonstration

15. **PrivacyVisualization** (`PrivacyVisualization.tsx`)
    - Animated encryption flow
    - Data journey diagram
    - Zero-retention explanation

16. **LanguageSelector** (`LanguageSelector.tsx`)
    - Interactive globe or map
    - 32 language flags
    - Click to highlight

### Content Sections

17. **TextBlock** (`TextBlock.tsx`)
    - Centered or full-width text
    - Markdown support
    - Optional background color

18. **TwoColumnText** (`TwoColumnText.tsx`)
    - Split content layout
    - Image + text combinations
    - Flexible ordering

### CTA Sections

19. **CTABanner** (`CTABanner.tsx`)
    - Full-width colored banner
    - Single focused CTA
    - Used between sections

20. **CTACard** (`CTACard.tsx`)
    - Boxed call-to-action
    - Multiple CTAs possible
    - Card-style design

### Educational

21. **HowItWorks** (`HowItWorks.tsx`)
    - Step-by-step process
    - Numbered steps with icons
    - Linear or circular layout

22. **UseCaseCard** (`UseCaseCard.tsx`)
    - Specific use case highlight
    - Icon + title + description + link
    - Grid layout

23. **SecurityBadges** (`SecurityBadges.tsx`)
    - GDPR, ISO, encryption badges
    - Certification logos
    - Compliance indicators

### Forms

24. **ContactForm** (`ContactForm.tsx`)
    - Sales inquiry form
    - University contact form
    - Validation and submission

25. **NewsletterSignup** (`NewsletterSignup.tsx`)
    - Email capture
    - Inline or standalone
    - Success states

### Specialty

26. **CodeExample** (`CodeExample.tsx`)
    - Syntax-highlighted code
    - Installation instructions
    - Copy-to-clipboard button

27. **VideoEmbed** (`VideoEmbed.tsx`)
    - YouTube/Vimeo embed
    - Demo videos
    - Lazy loading

28. **FAQAccordion** (`FAQAccordion.tsx`)
    - Expandable Q&A
    - Categorized questions
    - Search functionality

## Page Compositions

### Homepage (/)

```
- Navigation
- HeroMain
- LogoCloud
- Stats
- FeatureGrid (3 pillars: Privacy, Speed, Transparency)
- EditorDemo
- FeatureShowcase (Encryption visualization)
- FeatureShowcase (Keyboard shortcuts)
- Testimonials
- PricingTable (condensed, 3 options)
- CTABanner ("Start your free trial")
- HowItWorks
- FAQAccordion (top 5 questions)
- NewsletterSignup
- Footer
```

### Features Page (/features)

```
- Navigation
- HeroFeature
- FeatureShowcase x6 (detailed features)
- EditorDemo
- LanguageSelector
- SecurityBadges
- CTACard
- Footer
```

### Pricing Page (/pricing)

```
- Navigation
- HeroFeature (pricing-focused)
- PricingTable (full, 4 options)
- FeatureComparison
- PricingFAQ
- CTABanner ("Need enterprise pricing?")
- Footer
```

### Use Case: Researchers (/use-cases/researchers)

```
- Navigation
- HeroUseCase
- TextBlock (problem statement)
- FeatureShowcase x3 (researcher-specific benefits)
- Testimonials (researcher quotes)
- UseCaseCard (related use cases)
- CTACard ("Try it free")
- Footer
```

### Open Source (/open-source)

```
- Navigation
- HeroFeature
- CodeExample (installation)
- TwoColumnText (why open source)
- FeatureGrid (open source benefits)
- CTABanner ("Download on GitHub")
- FAQAccordion (OSS-specific)
- Footer
```

### Contact Sales (/contact-sales)

```
- Navigation
- HeroFeature
- ContactForm
- Stats (enterprise stats)
- LogoCloud (university logos)
- Testimonials (enterprise/academic)
- Footer
```

## Technical Implementation Notes

### File Structure

```
/app/(landing)/
  page.tsx                    # Homepage
  layout.tsx                  # Landing layout (different from app)
  /components/
    /sections/
      Navigation.tsx
      Footer.tsx
      HeroMain.tsx
      HeroFeature.tsx
      HeroUseCase.tsx
      FeatureGrid.tsx
      FeatureShowcase.tsx
      FeatureComparison.tsx
      PricingTable.tsx
      PricingFAQ.tsx
      Testimonials.tsx
      LogoCloud.tsx
      Stats.tsx
      EditorDemo.tsx
      PrivacyVisualization.tsx
      LanguageSelector.tsx
      TextBlock.tsx
      TwoColumnText.tsx
      CTABanner.tsx
      CTACard.tsx
      HowItWorks.tsx
      UseCaseCard.tsx
      SecurityBadges.tsx
      ContactForm.tsx
      NewsletterSignup.tsx
      CodeExample.tsx
      VideoEmbed.tsx
      FAQAccordion.tsx
  /features/
    page.tsx
  /pricing/
    page.tsx
  /use-cases/
    /researchers/
      page.tsx
    /universities/
      page.tsx
    /phd-students/
      page.tsx
    /qualitative-analysis/
      page.tsx
    /multilingual/
      page.tsx
  /open-source/
    page.tsx
  /security/
    page.tsx
  /contact-sales/
    page.tsx
```

### Internationalization

All landing pages support i18n using next-intl:

- `/en/` - English (default)
- `/fr/` - French
- `/de/` - German
- `/es/` - Spanish

Content keys in `messages/{locale}/landing.json`

### SEO Considerations

- Unique meta titles and descriptions per page
- Schema.org markup for SoftwareApplication
- Open Graph tags for social sharing
- Sitemap.xml generation
- Blog posts for content marketing

### Performance

- All section components lazy-loaded below fold
- Images optimized with Next.js Image
- Critical CSS inlined
- Animations use CSS transforms (GPU accelerated)
- Analytics and tracking scripts deferred

## Content Tone & Voice

**Voice:** Professional but approachable, technical but not jargon-heavy  
**Tone:** Confident, transparent, researcher-friendly  
**Style:** Clear, concise, benefit-focused

**Example Headlines:**

- "Transcription built for researchers who need privacy"
- "Fast enough for professionals. Secure enough for PhDs."
- "Your data is your data. Period."
- "Open source transparency meets enterprise security"

**Writing Guidelines:**

- Lead with benefits, not features
- Use concrete numbers (10 minutes, 32 languages, €15/month)
- Address privacy concerns directly
- Emphasize academic use cases
- Be honest about limitations (e.g., "most accurate" not "perfect")

## Next Steps

1. ✅ Review and approve this document
2. ⬜ Design mockups for key sections (Figma)
3. ⬜ Create section components (start with Navigation, Footer, HeroMain)
4. ⬜ Build homepage composition
5. ⬜ Create content for all pages
6. ⬜ Implement responsive design
7. ⬜ Add animations and interactions
8. ⬜ SEO optimization
9. ⬜ Performance testing
10. ⬜ Launch! 🚀

---

**Questions or feedback?** Let's discuss and iterate on this plan before we start building.
