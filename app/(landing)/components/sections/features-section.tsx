"use client";

import { useTranslations } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FileDown,
  FolderKanban,
  MessageSquareHeart,
  PenLine,
  Shield,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { AnimatedSectionTitle } from "../animated-section-title";
import { FakeBrowser } from "./fake-browser";
import Link from "next/link";

// Feature color palette
const FEATURE_COLORS = [
  {
    border: "border-blue-500/50",
    iconBg: "bg-blue-500/10",
    iconText: "text-blue-500",
    badgeBg: "bg-blue-500/10",
    badgeText: "text-blue-500",
    badgeBorder: "border-blue-500/50",
  },
  {
    border: "border-green-500/50",
    iconBg: "bg-green-500/10",
    iconText: "text-green-500",
    badgeBg: "bg-green-500/10",
    badgeText: "text-green-500",
    badgeBorder: "border-green-500/50",
  },
  {
    border: "border-pink-500/50",
    iconBg: "bg-pink-500/10",
    iconText: "text-pink-500",
    badgeBg: "bg-pink-500/10",
    badgeText: "text-pink-500",
    badgeBorder: "border-pink-500/50",
  },
  {
    border: "border-cyan-500/50",
    iconBg: "bg-cyan-500/10",
    iconText: "text-cyan-500",
    badgeBg: "bg-cyan-500/10",
    badgeText: "text-cyan-500",
    badgeBorder: "border-cyan-500/50",
  },
  {
    border: "border-purple-500/50",
    iconBg: "bg-purple-500/10",
    iconText: "text-purple-500",
    badgeBg: "bg-purple-500/10",
    badgeText: "text-purple-500",
    badgeBorder: "border-purple-500/50",
  },
  {
    border: "border-amber-500/50",
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-500",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-500",
    badgeBorder: "border-amber-500/50",
  },
  {
    border: "border-orange-500/50",
    iconBg: "bg-orange-500/10",
    iconText: "text-orange-500",
    badgeBg: "bg-orange-500/10",
    badgeText: "text-orange-500",
    badgeBorder: "border-orange-500/50",
  },
  {
    border: "border-red-500/50",
    iconBg: "bg-red-500/10",
    iconText: "text-red-500",
    badgeBg: "bg-red-500/10",
    badgeText: "text-red-500",
    badgeBorder: "border-red-500/50",
  },
] as const;

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  colorIndex: number;
  centered?: boolean;
}

const FeatureCard = ({
  icon,
  title,
  description,
  badge,
  colorIndex,
  centered,
}: FeatureCardProps) => {
  const color = FEATURE_COLORS[colorIndex % FEATURE_COLORS.length];

  return (
    <div
      className={cn(
        "relative group",
        centered ? "text-center max-w-3xl mx-auto" : "",
      )}
    >
      <div
        className={`rounded-xl p-6 transition-all bg-white h-full flex flex-col`}
      >
        <div
          className={cn(
            `rounded-lg ${color.iconBg} ${color.badgeBorder} border p-3 w-fit mb-4 transition-colors`,
            centered ? "mx-auto" : "",
          )}
        >
          <div className={color.iconText}>{icon}</div>
        </div>
        <h3 className="font-semibold text-lg text-black mb-2">{title}</h3>
        {badge && (
          <Badge
            variant="outline"
            className={`${color.badgeBg} ${color.badgeText} ${color.badgeBorder} mb-3 w-fit`}
          >
            {badge}
          </Badge>
        )}
        <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

export const FeaturesSection = () => {
  const t = useTranslations("features");

  return (
    <section className="pt-24 bg-white border-b overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <AnimatedSectionTitle className="text-black" subtitle={t("subtitle")}>
          {t("title")}
        </AnimatedSectionTitle>

        {/* Row 1: A + B (2 columns) */}
        <div className="grid md:grid-cols-2 gap-6 mb-6 max-w-6xl mx-auto">
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title={t("accurate.title")}
            description={t("accurate.description")}
            badge={t("accurate.badge")}
            colorIndex={0}
          />
          <FeatureCard
            icon={<PenLine className="h-6 w-6" />}
            title={t("editing.title")}
            description={t("editing.description")}
            badge={t("editing.badge")}
            colorIndex={1}
          />
        </div>

        {/* Row 2: E + F + G (3 columns) */}
        <div className="grid md:grid-cols-3 gap-6 mb-6 max-w-6xl mx-auto">
          <FeatureCard
            icon={<UserCog className="h-6 w-6" />}
            title={t("speakers.title")}
            description={t("speakers.description")}
            colorIndex={2}
          />
          <FeatureCard
            icon={<FolderKanban className="h-6 w-6" />}
            title={t("projects.title")}
            description={t("projects.description")}
            colorIndex={3}
          />
          <FeatureCard
            icon={<FileDown className="h-6 w-6" />}
            title={t("export.title")}
            description={t("export.description")}
            colorIndex={4}
          />
        </div>

        {/* Row 3: C + D (2 columns) */}
        <div className="grid md:grid-cols-2 gap-6 mb-6 max-w-6xl mx-auto">
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title={t("collaboration.title")}
            description={t("collaboration.description")}
            colorIndex={5}
          />
          <FeatureCard
            icon={<Shield className="h-6 w-6" />}
            title={t("privacy.title")}
            description={t("privacy.description")}
            colorIndex={6}
          />
        </div>

        {/* Row 5: I (1 column full width) */}
        <div className="grid grid-cols-1 gap-6 max-w-6xl mx-auto mb-12">
          <FeatureCard
            centered
            icon={<MessageSquareHeart className="h-6 w-6" />}
            title={t("feedback.title")}
            description={t("feedback.description")}
            colorIndex={0}
          />
        </div>

        {/* Demo Video - Half covered by next section */}
        <Link href="/app">
          <div className="relative max-w-5xl mx-auto z-10 -mt-[200px] bottom-[-300px] hover:bottom-[-200px] transition-all">
            <FakeBrowser />
            <div className="bg-gray-900 rounded-b-xl border border-gray-200 border-t-0 overflow-hidden shadow-2xl">
              <video className="w-full" autoPlay loop muted playsInline>
                <source src="/landing/demo-humanlogs.webm" type="video/webm" />
                <source
                  src="/landing/demo-humanlogs.mov"
                  type="video/quicktime"
                />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
};
