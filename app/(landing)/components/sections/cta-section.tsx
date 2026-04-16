"use client";

import Link from "next/link";
import { useTranslations } from "@/components/locale-provider";
import { AnimatedWave } from "./animated-wave";

interface CTASectionProps {
  translationKey?: string;
}

export const CTASection = ({ translationKey = "cta" }: CTASectionProps) => {
  const t = useTranslations(translationKey);

  return (
    <section className="container mx-auto px-4 py-24 md:px-6">
      {/* Animated Wave */}
      <div className="mb-12">
        <AnimatedWave />
      </div>

      {/* CTA Content */}
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold tracking-tight text-black md:text-4xl lg:text-5xl">
            {t("title")}
          </h2>
          <p className="text-lg text-gray-600 md:text-xl">{t("subtitle")}</p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/app/login"
            className="inline-flex items-center justify-center rounded-lg bg-black px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-gray-800"
          >
            {t("startForFree")}
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-lg border border-black px-8 py-4 text-base font-semibold text-black transition-colors hover:bg-gray-100"
          >
            {t("contactSales")}
          </Link>
        </div>
      </div>
    </section>
  );
};
