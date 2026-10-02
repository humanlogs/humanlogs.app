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
  status: "live" | "beta" | "soon";
};

/**
 * Three stages, three honest states. Coding is `beta` rather than `live` or
 * `soon`: it ships behind an opt-in, so calling it available would overclaim and
 * calling it coming would deny what people are already using every day.
 */
const STAGES: Stage[] = [
  { key: "transcription", icon: Mic, status: "live" },
  { key: "coding", icon: Tags, status: "beta" },
  { key: "analysis", icon: BarChart3, status: "soon" },
];

export const RoadmapSection = () => {
  const t = useTranslations("roadmap");

  return (
    <section className="mt-24 container mx-auto px-4 py-8 md:px-6" id="roadmap">
      <div className="mx-auto mb-6 max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-black md:text-3xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 text-base text-gray-600 md:text-lg">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:gap-2 max-w-5xl mx-auto">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isLive = stage.status === "live";
          // Beta reads with the live stages, not the planned ones: it exists, it
          // is drawn solid, and only the pill says it is still moving.
          const shipped = stage.status !== "soon";
          const features = t(`stages.${stage.key}.features`) as unknown as
            | string[]
            | string;

          return (
            <div key={stage.key} className="contents">
              <div
                className={`flex flex-1 flex-col rounded-2xl border p-5 md:p-6 ${
                  shipped
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
                        : stage.status === "beta"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isLive
                        ? "bg-green-100 text-green-700"
                        : stage.status === "beta"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {t(`status.${stage.status}`)}
                  </span>
                </div>

                <h3
                  className={`mt-3 text-lg font-bold ${
                    shipped ? "text-black" : "text-gray-500"
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
                            shipped ? "text-green-600" : "text-gray-400"
                          }`}
                        />
                        <span
                          className={`text-sm ${
                            shipped ? "text-gray-700" : "text-gray-500"
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
