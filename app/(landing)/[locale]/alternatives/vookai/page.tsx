"use client";

import { useTranslations } from "@/components/locale-provider";
import {
  CTASection,
  ComparisonTable,
  FeaturesSection,
} from "../../components/sections";
import { RelatedLinks } from "../../components/related-links";

export default function VookAIPage() {
  return (
    <>
      <VookAIContent />
      <ComparisonTable
        competitorName="Vook.ai"
        translationKey="alternativesVook"
      />
      <div className="py-12"></div>
      <FeaturesSection />
      <RelatedLinks
        title="Compare Other Alternatives"
        links={[
          {
            title: "HumanLogs vs Otter.ai",
            description: "Compare AI features and collaboration",
            href: "/alternatives/otterai",
          },
          {
            title: "HumanLogs vs Goodtape.io",
            description: "Compare privacy and GDPR compliance",
            href: "/alternatives/goodtapeio",
          },
          {
            title: "HumanLogs vs Transcribe.com",
            description: "Compare value and hours included",
            href: "/alternatives/transcribecom",
          },
          {
            title: "Podcasting Use Case",
            description: "Perfect for podcast transcription",
            href: "/use-cases/podcasting",
          },
          {
            title: "View All Alternatives",
            description: "Explore all transcription tool comparisons",
            href: "/alternatives",
          },
          {
            title: "Try HumanLogs",
            description: "Start with 100 minutes free each month",
            href: "/pricing",
          },
        ]}
        columns={3}
      />
      <CTASection translationKey="alternativesVook.cta" />
    </>
  );
}

function VookAIContent() {
  const t = useTranslations("alternativesVook");

  return (
    <section className="container mx-auto px-4 py-24 md:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-black md:text-5xl mb-4">
            {t("title")}
          </h1>
          <p className="text-lg text-gray-600 md:text-xl">{t("subtitle")}</p>
        </div>

        {/* Introduction */}
        <div className="prose prose-lg max-w-none mb-12">
          <p className="text-gray-700 leading-relaxed mb-6">{t("intro")}</p>
          <p className="text-gray-700 leading-relaxed font-medium">
            {t("comparisonIntro")}
          </p>
        </div>
      </div>
    </section>
  );
}
