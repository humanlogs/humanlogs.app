"use client";

import { useTranslations } from "@/components/locale-provider";
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
    </Layout>
  );
}
