"use client";

import { useTranslations } from "@/components/locale-provider";
import { cn } from "@/lib/utils/utils";
import { Shield, Users, Zap } from "lucide-react";
import {
  CTASection,
  FAQSection,
  TestimonialsSection,
} from "../../components/sections";

export default function ResearchUseCasePage() {
  return (
    <>
      <ResearchContent />
      <WhyBestSection />
      <FeaturesListSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection translationKey="useCasesResearch.cta" />
    </>
  );
}

function ResearchContent() {
  const t = useTranslations("useCasesResearch");

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

        <div className="grid md:grid-cols-2 gap-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200"
            >
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
              <p className="text-gray-700">{feature}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
