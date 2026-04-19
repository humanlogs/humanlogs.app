"use client";

import { useState } from "react";
import { Check, GithubIcon, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/components/locale-provider";
import { AnimatedSectionTitle } from "../animated-section-title";

interface PricingSectionProps {
  showFeatureGrid?: boolean;
}

export const PricingSection = ({
  showFeatureGrid = true,
}: PricingSectionProps) => {
  const t = useTranslations("pricing");
  const [activeTab, setActiveTab] = useState<"cloud" | "selfHosted">("cloud");

  const features = [
    { key: "bulkUpload", all: true },
    { key: "customVocabulary", all: true },
    { key: "speakerDiarization", all: true },
    { key: "languages", all: true },
    { key: "audioPlayback", all: true },
    { key: "audioEditor", all: true },
    { key: "euProcessors", all: true },
    { key: "zeroRetention", all: true },
    { key: "e2eEncryption", all: true },
    { key: "gdprCompliant", all: true },
    { key: "longTranscripts", all: true },
    { key: "speakerLabels", all: true },
    { key: "speakerOptions", all: true },
    { key: "projects", all: true },
    { key: "collaboration", all: true },
    { key: "dpa", all: false },
    { key: "support", all: false },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <AnimatedSectionTitle className="text-black" subtitle={t("subtitle")}>
          {t("title")}
        </AnimatedSectionTitle>

        {/* Tabs */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setActiveTab("cloud")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "cloud"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              {t("tabs.cloud")}
            </button>
            <button
              onClick={() => setActiveTab("selfHosted")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors items-center flex gap-2 ${
                activeTab === "selfHosted"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              <GithubIcon className="inline-block w-4 h-4" />
              {t("tabs.selfHosted")}
            </button>
          </div>
        </div>

        {/* Cloud Pricing */}
        {activeTab === "cloud" && (
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {/* Free Plan */}
            <div className="border border-gray-200 rounded-lg p-8 hover:shadow-lg transition-shadow flex flex-col">
              <h3 className="text-xl font-bold text-black mb-2">
                {t("cloud.free.name")}
              </h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-black">
                  {t("cloud.free.price")}
                </span>
              </div>
              <Link
                href="/app/login"
                className="block w-full text-center rounded-lg border border-black px-6 py-3 text-base font-semibold text-black transition-colors hover:bg-gray-100 mb-6"
              >
                {t("cloud.free.cta")}
              </Link>
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("cloud.free.noCreditCard")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("cloud.free.transcriptionsPerMonth")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.audioEditor")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.collaboration")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("cloud.free.advancedFeatures")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.languages")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.e2eEncryption")}
                  </span>
                </li>
              </ul>
            </div>

            {/* Subscription Plan */}
            <div className="border-2 border-blue-500 rounded-lg p-8 relative hover:shadow-lg transition-shadow flex flex-col">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-100 border-2 border-blue-500 text-blue-500 px-4 py-1 rounded-full text-sm font-medium">
                {t("cloud.subscription.badge")}
              </div>
              <h3 className="text-xl font-bold text-black mb-2">
                {t("cloud.subscription.name")}
              </h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-black">
                  {t("cloud.subscription.price")}
                </span>
                <span className="text-gray-600">
                  {t("cloud.subscription.perMonth")}
                  <span className="text-sm text-gray-500 ml-2">
                    {t("cloud.subscription.yearly")}
                  </span>
                </span>
              </div>
              <Link
                href="/app/login"
                className="block w-full text-center rounded-lg bg-blue-500 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-800 mb-6"
              >
                {t("cloud.subscription.cta")}
              </Link>
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("cloud.subscription.transcriptionsPerMonth")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.audioEditor")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.collaboration")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("cloud.subscription.advancedFeatures")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.languages")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.e2eEncryption")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("cloud.subscription.priorityTranscriptions")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.dpa")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.support")}
                  </span>
                </li>
              </ul>
            </div>

            {/* One-time Plan */}
            <div className="border border-gray-200 rounded-lg p-8 hover:shadow-lg transition-shadow flex flex-col">
              <h3 className="text-xl font-bold text-black mb-2">
                {t("cloud.oneTime.name")}
              </h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-black">
                  {t("cloud.oneTime.price")}
                </span>
              </div>
              <Link
                href="/app/login"
                className="block w-full text-center rounded-lg border border-black px-6 py-3 text-base font-semibold text-black transition-colors hover:bg-gray-100 mb-6"
              >
                {t("cloud.oneTime.cta")}
              </Link>
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("cloud.oneTime.transcriptions")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.audioEditor")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.collaboration")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("cloud.oneTime.advancedFeatures")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.languages")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.e2eEncryption")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.dpa")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">
                    {t("features.support")}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Self-Hosted Pricing */}
        {activeTab === "selfHosted" && (
          <div className="max-w-4xl mx-auto mb-16">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Personal Use */}
              <div className="border border-gray-200 rounded-lg p-8 hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-bold text-black mb-4">
                  {t("selfHosted.personal.name")}
                </h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-black">
                    {t("selfHosted.personal.price")}
                  </span>
                </div>
                <p className="text-gray-600 mb-6">
                  {t("selfHosted.personal.description")}
                </p>
                <a
                  href="https://github.com/humanlogs/humanlogs.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center rounded-lg border border-black px-6 py-3 text-base font-semibold text-black transition-colors hover:bg-gray-100"
                >
                  {t("selfHosted.personal.cta")}
                </a>
              </div>

              {/* Enterprise */}
              <div className="border border-gray-200 rounded-lg p-8 hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-bold text-black mb-4">
                  {t("selfHosted.enterprise.name")}
                </h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-black">
                    {t("selfHosted.enterprise.price")}
                  </span>
                </div>
                <p className="text-gray-600 mb-6">
                  {t("selfHosted.enterprise.description")}
                </p>
                <Link
                  href="/contact"
                  className="block w-full text-center rounded-lg bg-black px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  {t("selfHosted.enterprise.cta")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* View Pricing Page Link */}
        {!showFeatureGrid && activeTab === "cloud" && (
          <div className="text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center text-black font-semibold hover:underline"
            >
              {t("viewPricingPage")} →
            </Link>
          </div>
        )}

        {/* Feature Grid */}
        {showFeatureGrid && activeTab === "cloud" && (
          <div className="max-w-6xl mx-auto">
            <h3 className="text-2xl font-bold text-black text-center mb-8">
              {t("features.title")}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-4 font-semibold text-black">
                      {t("features.feature")}
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-black">
                      {t("cloud.free.name")}
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-black">
                      {t("cloud.subscription.name")}
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-black">
                      {t("cloud.oneTime.name")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => (
                    <tr
                      key={feature.key}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4 text-gray-700">
                        {t(`features.${feature.key}`)}
                      </td>
                      <td className="text-center py-4 px-4">
                        {feature.all ? (
                          <Check className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="text-center py-4 px-4">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                      <td className="text-center py-4 px-4">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
