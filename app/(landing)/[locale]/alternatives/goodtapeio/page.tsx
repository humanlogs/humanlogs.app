"use client";

import { Layout } from "../../../_layout";
import {
  CTASection,
  ComparisonTable,
  FeaturesSection,
} from "../../components/sections";
import { RelatedLinks } from "../../components/related-links";
import { useTranslations } from "@/components/locale-provider";

export default function GoodtapeIOPage() {
  return (
    <>
      <GoodtapeIOContent />
      <ComparisonTable
        competitorName="Goodtape.io"
        translationKey="alternativesGoodtape"
      />
      <div className="py-12"></div>
      <FeaturesSection />
      <RelatedLinks
        title="Compare Other Alternatives"
        links={[
          {
            title: "HumanLogs vs Otter.ai",
            description: "Compare pricing and transcription quality",
            href: "/alternatives/otterai",
          },
          {
            title: "HumanLogs vs Speakr",
            description: "Compare open-source transcription solutions",
            href: "/alternatives/speakr",
          },
          {
            title: "HumanLogs vs Transcribe.com",
            description: "Compare features and value for money",
            href: "/alternatives/transcribecom",
          },
          {
            title: "Education Use Case",
            description: "Perfect for universities and schools",
            href: "/use-cases/education",
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
      <CTASection translationKey="alternativesGoodtape.cta" />
    </>
  );
}

function GoodtapeIOContent() {
  const t = useTranslations("alternativesGoodtape");

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
