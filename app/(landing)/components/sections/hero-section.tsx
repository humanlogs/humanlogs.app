"use client";

import Link from "next/link";
import { Star, Shield, Keyboard, Lock } from "lucide-react";
import { AnimatedWave } from "./animated-wave";
import { AnimatedTranscriptCard } from "./animated-transcript-card";
import { useTranslations } from "@/components/locale-provider";

export const HeroSection = () => {
  const t = useTranslations("hero");
  return (
    <section className="container mx-auto px-4 pt-8 md:px-6 md:pt-6 pb-24">
      {/* Animated Wave */}
      <div className="mb-12 sticky z-10" style={{ top: 10 }}>
        <AnimatedWave />
      </div>

      {/* Main Hero Content */}
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
        {/* Left: Slogan & CTAs */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-black md:text-5xl lg:text-6xl">
              {t("title")}
            </h1>
            <p className="text-lg text-gray-600 md:text-xl">{t("subtitle")}</p>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/app/login"
              className="inline-flex items-center justify-center rounded-lg bg-black px-8 py-4 text-base font-semibold text-white transition-colors"
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

          {/* Badges & Stars */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="h-5 w-5 fill-yellow-400 text-yellow-400"
                />
              ))}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-black">4.9/5</span>{" "}
              {t("rating")}
            </div>
          </div>

          {/* 3 Pillars */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Lock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-black">
                  {t("pillars.encryption")}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Keyboard className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-black">
                  {t("pillars.editing")}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-pink-100 p-2">
                <Shield className="h-5 w-5 text-pink-500" />
              </div>
              <div>
                <h3 className="font-semibold text-black">
                  {t("pillars.openSource")}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Animated Transcript Card */}
        <div className="lg:pl-8">
          <AnimatedTranscriptCard />
        </div>
      </div>
    </section>
  );
};
