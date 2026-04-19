"use client";

import { useTranslations } from "@/components/locale-provider";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils/utils";

export interface ComparisonRow {
  feature: string;
  us: boolean | string;
  them: boolean | string;
}

interface ComparisonTableProps {
  competitorName: string;
  translationKey: string;
}

// Comparison data for each competitor (language-agnostic)
const COMPARISON_DATA: Record<
  string,
  Array<{ us: boolean | string; them: boolean | string }>
> = {
  alternativesOtter: [
    { us: true, them: false }, // End-to-end encryption
    { us: true, them: false }, // Zero retention transcription
    { us: true, them: false }, // Audio-based text editor
    { us: true, them: "Partial" }, // GDPR compliant
    { us: true, them: false }, // Self-hostable / Open source
    { us: true, them: false }, // Highest transcription quality
    { us: true, them: true }, // Custom vocabulary
    { us: true, them: true }, // Speaker diarization
    { us: true, them: true }, // Collaboration
    { us: "100 min/month", them: "300 min/month" }, // Free tier
    { us: "€15/month", them: "$16.99/month" }, // Monthly subscription
    { us: true, them: false }, // Advanced export formats
  ],
  alternativesGoodtape: [
    { us: true, them: false }, // End-to-end encryption
    { us: true, them: false }, // Zero retention transcription
    { us: true, them: "Partial" }, // Audio-based text editor
    { us: true, them: true }, // GDPR compliant
    { us: true, them: false }, // Self-hostable / Open source
    { us: true, them: true }, // Highest transcription quality
    { us: true, them: true }, // Custom vocabulary
    { us: true, them: true }, // Speaker diarization
    { us: true, them: "Static" }, // Collaboration
    { us: "100 min/month", them: "60 min/month" }, // Free tier
    { us: "€15/month", them: "€20/month" }, // Monthly subscription
    { us: true, them: true }, // Advanced export formats
  ],
  alternativesSpeakr: [
    { us: true, them: false }, // End-to-end encryption
    { us: true, them: false }, // Zero retention transcription
    { us: true, them: false }, // Audio-based text editor
    { us: true, them: true }, // GDPR compliant
    { us: true, them: true }, // Self-hostable / Open source
    { us: true, them: false }, // Highest transcription quality
    { us: true, them: false }, // Custom vocabulary
    { us: true, them: "Need advanced knowledge" }, // Speaker diarization
    { us: true, them: true }, // Collaboration
    { us: "100 min/month", them: "-" }, // Free tier
    { us: "€15/month", them: "-" }, // Monthly subscription
    { us: true, them: true }, // Advanced export formats
  ],
  alternativesVook: [
    { us: true, them: false }, // End-to-end encryption
    { us: true, them: false }, // Advanced audio-based editor
    { us: false, them: true }, // AI tools (summary, etc.)
    { us: true, them: false }, // Collaboration
    { us: true, them: true }, // GDPR compliant
    { us: true, them: false }, // Self-hostable / Open source
    { us: true, them: true }, // Speaker diarization
    { us: "100 min/month", them: "1/day" }, // Free tier
    { us: "€15/month", them: "€19/month" }, // Monthly subscription price
    { us: "20h", them: "10h" }, // Monthly hours included
    { us: "€1/h", them: "€3/h" }, // Pay-as-you-go value
    { us: true, them: true }, // Custom vocabulary
  ],
  alternativesTranscribe: [
    { us: true, them: false }, // End-to-end encryption
    { us: true, them: false }, // Advanced audio-based editor
    { us: false, them: true }, // AI tools (summary, etc.)
    { us: true, them: false }, // Collaboration
    { us: true, them: true }, // GDPR compliant
    { us: true, them: false }, // Self-hostable / Open source
    { us: true, them: true }, // Speaker diarization
    { us: "100 min/month", them: false }, // Free tier
    { us: "€15/month", them: "€15/month" }, // Monthly subscription price
    { us: "20h", them: "5h" }, // Monthly hours (at €15/mo)
    { us: "€0.75/h", them: "€3/h" }, // Value per hour
    { us: true, them: true }, // Custom vocabulary
  ],
};

export const ComparisonTable = ({
  competitorName,
  translationKey,
}: ComparisonTableProps) => {
  const t = useTranslations(translationKey);

  // Get comparison data for this competitor
  const comparisonData = COMPARISON_DATA[translationKey] || [];

  // Build rows by combining translated feature names with comparison data
  const rows: ComparisonRow[] = comparisonData.map((data, index) => ({
    feature: t(`comparison.features.${index}`),
    us: data.us,
    them: data.them,
  }));

  const renderCell = (value: boolean | string) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="h-5 w-5 text-green-500 mx-auto" />
      ) : (
        <X className="h-5 w-5 text-red-500 mx-auto" />
      );
    }
    return <span className="text-sm text-gray-700">{value}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-black mb-4">
          {t("comparison.title")}
        </h2>
        <p className="text-gray-600">{t("comparison.subtitle")}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                {t("comparison.featureColumn")}
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 bg-blue-50">
                {t("comparison.usColumn")}
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                {competitorName}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                className={cn(
                  "border-b border-gray-100 transition-colors hover:bg-gray-50",
                  index % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                )}
              >
                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                  {row.feature}
                </td>
                <td className="px-6 py-4 text-center bg-blue-50/50">
                  {renderCell(row.us)}
                </td>
                <td className="px-6 py-4 text-center">
                  {renderCell(row.them)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
