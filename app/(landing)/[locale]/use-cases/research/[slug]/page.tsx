"use client";

import { useTranslations } from "@/components/locale-provider";
import { cn } from "@/lib/utils/utils";
import { Shield, Users, Zap } from "lucide-react";
import {
  CTASection,
  FAQSection,
  TestimonialsSection,
} from "../../../components/sections";
import { getSeoSlugConfig } from "@/lib/seo-research-slugs";
import { useParams } from "next/navigation";

export default function ResearchSeoPage() {
  return (
    <>
      <SeoHeroSection />
      <WhyBestSection />
      <FeaturesListSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection translationKey="useCasesResearch.cta" />
    </>
  );
}

// Custom hero section for SEO pages
function SeoHeroSection() {
  const params = useParams();
  const slug = params.slug as string;
  const locale = params.locale as "en" | "fr";

  // Load SEO-specific translations
  const seoContent = require(`@/messages/${locale}/seo-research-content.json`);
  const content = seoContent[slug];

  const config = getSeoSlugConfig(slug, locale);

  if (!content) {
    return null;
  }

  return (
    <section className="container mx-auto px-4 py-24 md:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-black md:text-5xl mb-4">
            {content.title}
          </h1>
          <p className="text-xl text-gray-700 leading-relaxed">
            {content.intro}
          </p>
        </div>

        {/* Keywords badges for SEO */}
        {config && (
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
              {config.keywords.primary}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// Reuse from original research page
function WhyBestSection() {
  const t = useTranslations("useCasesResearch");

  const iconMap: { [key: string]: any } = {
    shield: Shield,
    zap: Zap,
    users: Users,
  };

  const colors = [
    {
      border: "border-blue-500/50",
      iconBg: "bg-blue-500/10",
      iconText: "text-blue-500",
    },
    {
      border: "border-green-500/50",
      iconBg: "bg-green-500/10",
      iconText: "text-green-500",
    },
    {
      border: "border-pink-500/50",
      iconBg: "bg-pink-500/10",
      iconText: "text-pink-500",
    },
  ];

  const whyBest = [
    {
      title: t("whyBest.0.title"),
      description: t("whyBest.0.description"),
      icon: t("whyBest.0.icon"),
    },
    {
      title: t("whyBest.1.title"),
      description: t("whyBest.1.description"),
      icon: t("whyBest.1.icon"),
    },
    {
      title: t("whyBest.2.title"),
      description: t("whyBest.2.description"),
      icon: t("whyBest.2.icon"),
    },
  ];

  return (
    <section className="bg-gray-50 border-y py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-black mb-4">
            {t("whyBestTitle")}
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {whyBest.map((item, index) => {
            const Icon = iconMap[item.icon] || Shield;
            const color = colors[index % colors.length];

            return (
              <div key={index} className="relative group">
                <div className="rounded-xl p-6 bg-white h-full flex flex-col">
                  <div
                    className={cn(
                      `rounded-lg ${color.iconBg} ${color.border} border p-3 w-fit mb-4 transition-colors`,
                    )}
                  >
                    <Icon className={`h-6 w-6 ${color.iconText}`} />
                  </div>
                  <h3 className="font-semibold text-lg text-black mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeaturesListSection() {
  const t = useTranslations("useCasesResearch");
  const features = [
    t("features.items.0"),
    t("features.items.1"),
    t("features.items.2"),
    t("features.items.3"),
    t("features.items.4"),
    t("features.items.5"),
    t("features.items.6"),
    t("features.items.7"),
  ];

  return (
    <section className="container mx-auto px-4 py-24 md:px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-black mb-8 text-center">
          {t("features.title")}
        </h2>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
          {features.map((feature, index) => (
            <div key={index} className="flex items-start">
              <svg
                className="h-6 w-6 text-green-600 mr-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-gray-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
