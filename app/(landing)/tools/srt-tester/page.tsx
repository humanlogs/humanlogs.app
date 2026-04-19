"use client";

import { useTranslations } from "@/components/locale-provider";
import { SRTValidator } from "../components/srt-validator";
import Link from "next/link";
import { ArrowLeft, FileText, Video, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function SRTTesterPage() {
  const t = useTranslations("freetools");

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <section className="container mx-auto px-4 py-24 md:px-6">
        <Link
          href="/tools"
          className="inline-flex items-center text-blue-600 hover:underline mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("backToTools")}
        </Link>

        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-black md:text-5xl mb-4">
            {t("tools.srtTester.title")}
          </h1>
          <p className="text-lg text-gray-600 md:text-xl">
            {t("tools.srtTester.description")}
          </p>
        </div>

        <SRTValidator />

        {/* Features Grid */}
        <div className="max-w-4xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-black mb-8 text-center">
            {t("tools.srtTester.featuresTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <FileText className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="font-semibold text-lg mb-2">
                {t("tools.srtTester.feature1Title")}
              </h3>
              <p className="text-sm text-gray-600">
                {t("tools.srtTester.feature1Description")}
              </p>
            </Card>

            <Card className="p-6">
              <Video className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="font-semibold text-lg mb-2">
                {t("tools.srtTester.feature2Title")}
              </h3>
              <p className="text-sm text-gray-600">
                {t("tools.srtTester.feature2Description")}
              </p>
            </Card>

            <Card className="p-6">
              <CheckCircle className="h-8 w-8 text-purple-600 mb-3" />
              <h3 className="font-semibold text-lg mb-2">
                {t("tools.srtTester.feature3Title")}
              </h3>
              <p className="text-sm text-gray-600">
                {t("tools.srtTester.feature3Description")}
              </p>
            </Card>
          </div>
        </div>

        {/* SEO Content */}
        <div className="max-w-4xl mx-auto mt-16 prose prose-lg">
          <h2>{t("tools.srtTester.seoTitle")}</h2>
          <p>{t("tools.srtTester.seoDescription")}</p>

          <h3>{t("tools.srtTester.whatIsSRT")}</h3>
          <p>{t("tools.srtTester.srtExplanation")}</p>

          <h3>{t("tools.srtTester.commonIssues")}</h3>
          <ul>
            <li>{t("tools.srtTester.issue1")}</li>
            <li>{t("tools.srtTester.issue2")}</li>
            <li>{t("tools.srtTester.issue3")}</li>
            <li>{t("tools.srtTester.issue4")}</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
