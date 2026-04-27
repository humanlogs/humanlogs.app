"use client";

import { useTranslations } from "@/components/locale-provider";
import { RelatedLinks } from "../components/related-links";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Layout } from "../../_layout";

export default function AlternativesPage() {
  const t = useTranslations("landing.alternatives");

  const alternatives = [
    { name: "Otter.ai", slug: "otterai" },
    { name: "Goodtape.io", slug: "goodtapeio" },
    { name: "Transcribe.com", slug: "transcribecom" },
    { name: "Speakr", slug: "speakr" },
    { name: "Vook.ai", slug: "vookai" },
  ];

  return (
    <Layout>
      <section className="container mx-auto px-4 py-24 md:px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight text-black md:text-5xl mb-4 text-center">
            {t("title")}
          </h1>
          <p className="text-lg text-gray-600 md:text-xl mb-12 text-center">
            {t("subtitle")}
          </p>
          <p className="text-gray-700 leading-relaxed mb-12">{t("intro")}</p>

          <div className="grid md:grid-cols-2 gap-6">
            {alternatives.map((alt) => (
              <Link key={alt.slug} href={`/alternatives/${alt.slug}`}>
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                  <h3 className="font-semibold text-xl mb-2">
                    HumanLogs vs {alt.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Compare features, pricing, and privacy
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <RelatedLinks
        title="Why Choose HumanLogs?"
        links={[
          {
            title: "Research Transcription",
            description:
              "GDPR-compliant, encrypted transcription for researchers",
            href: "/use-cases/research",
          },
          {
            title: "Journalism Use Case",
            description: "Protect sources with end-to-end encryption",
            href: "/use-cases/journalism",
          },
          {
            title: "Free Audio Tools",
            description: "Convert and optimize files before transcription",
            href: "/tools",
          },
          {
            title: "View Pricing",
            description: "Transparent pricing, no hidden fees",
            href: "/pricing",
          },
          {
            title: "Security & Privacy",
            description: "Learn about our privacy-first approach",
            href: "/resources",
          },
          {
            title: "I am a university",
            description: "Get institutional pricing and custom solutions",
            href: "/contact",
          },
        ]}
        columns={3}
      />
    </Layout>
  );
}
