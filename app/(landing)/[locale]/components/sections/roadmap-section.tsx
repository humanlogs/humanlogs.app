"use client";

import { useTranslations } from "@/components/locale-provider";
import {
  BarChart3,
  Check,
  ChevronRight,
  Mic,
  Tags,
  type LucideIcon,
} from "lucide-react";

type Stage = {
  key: "transcription" | "coding" | "analysis";
  icon: LucideIcon;
  status: "live" | "soon";
};

const STAGES: Stage[] = [
  { key: "transcription", icon: Mic, status: "live" },
  { key: "coding", icon: Tags, status: "soon" },
  { key: "analysis", icon: BarChart3, status: "soon" },
];

export const RoadmapSection = () => {
  const t = useTranslations("roadmap");

  return (
    <section className="container mx-auto px-4 py-8 md:px-6">
      <div className="mx-auto mb-6 max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-black md:text-3xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 text-base text-gray-600 md:text-lg">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:gap-2">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isLive = stage.status === "live";
          const features = t(`stages.${stage.key}.features`) as unknown as
            | string[]
            | string;

          return (
            <div key={stage.key} className="contents">
              <div
                className={`flex flex-1 flex-col rounded-2xl border p-5 md:p-6 ${
                  isLive
                    ? "border-black bg-white shadow-sm"
                    : "border-dashed border-gray-300 bg-gray-50/60"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`rounded-xl p-2 ${
                      isLive
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isLive
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {isLive ? t("status.live") : t("status.soon")}
                  </span>
                </div>

                <h3
                  className={`mt-3 text-lg font-bold ${
                    isLive ? "text-black" : "text-gray-500"
                  }`}
                >
                  {t(`stages.${stage.key}.title`)}
                </h3>

                {/* Features */}
                <ul className="mt-3 space-y-2">
                  {(Array.isArray(features) ? features : []).map(
                    (feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            isLive ? "text-green-600" : "text-gray-400"
                          }`}
                        />
                        <span
                          className={`text-sm ${
                            isLive ? "text-gray-700" : "text-gray-500"
                          }`}
                        >
                          {feature}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              {/* Connector between stages */}
              {index < STAGES.length - 1 && (
                <div className="flex items-center justify-center py-1 lg:py-0">
                  <ChevronRight className="h-6 w-6 rotate-90 text-gray-300 lg:rotate-0" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
