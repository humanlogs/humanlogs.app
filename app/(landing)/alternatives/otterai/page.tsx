"use client";

import { useTranslations } from "@/components/locale-provider";
import { CTASection, ComparisonTable } from "../../components/sections";

export default function OtterAIPage() {
  return (
    <>
      <OtterAIContent />
      <ComparisonTable
        competitorName="Otter.ai"
        translationKey="alternativesOtter"
      />
      <div className="py-12"></div>
      <CTASection translationKey="alternativesOtter.cta" />
    </>
  );
}

function OtterAIContent() {
  const t = useTranslations("alternativesOtter");

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
