"use client";

import { useTranslations } from "@/components/locale-provider";
import { cn } from "@/lib/utils/utils";
import { FileText, Clock, Shield } from "lucide-react";
import {
  CTASection,
  FAQSection,
  TestimonialsSection,
} from "../../components/sections";

export default function JournalismUseCasePage() {
  return (
    <>
      <JournalismContent />
      <WhyBestSection />
      <FeaturesListSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection translationKey="useCasesJournalism.cta" />
    </>
  );
}

function JournalismContent() {
  const t = useTranslations("useCasesJournalism");

  return (
    <section className="container mx-auto px-4 py-24 md:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-black md:text-5xl mb-4">
            {t("title")}
          </h1>
        </div>

        {/* Introduction */}
        <div className="prose prose-lg max-w-none">
          <span className="text-gray-700 leading-relaxed text-xl">
            {t("intro")}
          </span>
        </div>
      </div>
    </section>
  );
}

function WhyBestSection() {
  const t = useTranslations("useCasesJournalism");

  const iconMap: { [key: string]: any } = {
    fileText: FileText,
    clock: Clock,
    shield: Shield,
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
            const Icon = iconMap[item.icon] || FileText;
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
  const t = useTranslations("useCasesJournalism");
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

        <div className="grid md:grid-cols-2 gap-4">
          {features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="rounded-full bg-green-500/10 p-1.5 mt-0.5">
                <svg
                  className="h-4 w-4 text-green-500"
                  fill="none"
                  strokeWidth="2"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <span className="text-gray-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
