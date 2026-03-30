"use client";

import { useTranslations } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Key, Lock, Server, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../../../lib/utils";
import { AnimatedSectionTitle } from "../animated-section-title";

// Sample transcript with speakers
const SAMPLE_TRANSCRIPT = [
  {
    speaker: "Speaker 1",
    text: "This is a confidential research transcript",
    color: "bg-blue-100 text-blue-900 border-blue-300",
  },
  {
    speaker: "Speaker 2",
    text: "containing sensitive information about the participants",
    color: "bg-green-100 text-green-900 border-green-300",
  },
  {
    speaker: "Speaker 1",
    text: "and their responses to the questions asked.",
    color: "bg-blue-100 text-blue-900 border-blue-300",
  },
];

// Generate encrypted version by replacing letters with random characters
const encryptText = (text: string, seed: number) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return text
    .split("")
    .map((char, idx) => {
      if (char.match(/[a-zA-Z]/)) {
        // Use seed + idx for consistent randomness during animation
        const randomIndex = (seed + idx * 7) % chars.length;
        return chars[randomIndex];
      }
      return char;
    })
    .join("");
};

export const EncryptionSection = () => {
  const t = useTranslations("encryption");
  const [location, setLocation] = useState<"browser" | "server">("browser");
  const [displayTranscript, setDisplayTranscript] = useState(SAMPLE_TRANSCRIPT);
  const [animationProgress, setAnimationProgress] = useState(0);

  useEffect(() => {
    // Main cycle: pause at browser, then animate to server, pause, animate back
    const cycleTimer = setTimeout(
      () => {
        if (location === "browser" && animationProgress === 0) {
          // Start encrypting
          setAnimationProgress(0.01);
        } else if (location === "server" && animationProgress === 100) {
          // Pause at server, then start decrypting
          setTimeout(() => {
            setAnimationProgress(99);
          }, 2000);
        }
      },
      location === "browser" && animationProgress === 0 ? 2000 : 0,
    );

    return () => clearTimeout(cycleTimer);
  }, [location, animationProgress]);

  useEffect(() => {
    if (animationProgress > 0 && animationProgress < 100) {
      // Animate encryption
      const timer = setTimeout(() => {
        const newProgress = animationProgress + 5;
        setAnimationProgress(Math.min(newProgress, 100));

        // Update display text for each segment
        const progress = newProgress / 100;
        const updatedTranscript = SAMPLE_TRANSCRIPT.map((segment) => {
          const encryptedText = encryptText(
            segment.text,
            Math.floor(progress * 50),
          );
          const mixed = segment.text
            .split("")
            .map((char, idx) => {
              if (idx < segment.text.length * progress) {
                return encryptedText[idx];
              }
              return char;
            })
            .join("");

          return { ...segment, text: mixed };
        });

        setDisplayTranscript(updatedTranscript);

        if (newProgress >= 100) {
          setLocation("server");
        }
      }, 30);

      return () => clearTimeout(timer);
    } else if (
      animationProgress > 0 &&
      animationProgress >= 100 &&
      location === "server"
    ) {
      // At server, fully encrypted
      const fullyEncrypted = SAMPLE_TRANSCRIPT.map((segment) => ({
        ...segment,
        text: encryptText(segment.text, 50),
      }));
      setDisplayTranscript(fullyEncrypted);
    }
  }, [animationProgress, location]);

  useEffect(() => {
    if (
      animationProgress < 100 &&
      animationProgress > 0 &&
      location === "server"
    ) {
      // Animate decryption
      const timer = setTimeout(() => {
        const newProgress = Math.max(animationProgress - 5, 0);
        setAnimationProgress(newProgress);

        // Update display text for each segment
        const progress = newProgress / 100;
        const updatedTranscript = SAMPLE_TRANSCRIPT.map((segment) => {
          const encryptedText = encryptText(segment.text, 50);
          const mixed = encryptedText
            .split("")
            .map((char, idx) => {
              if (idx > segment.text.length * progress) {
                return segment.text[idx];
              }
              return char;
            })
            .join("");

          return { ...segment, text: mixed };
        });

        setDisplayTranscript(updatedTranscript);

        if (newProgress <= 0) {
          setLocation("browser");
          setDisplayTranscript(SAMPLE_TRANSCRIPT);
        }
      }, 30);

      return () => clearTimeout(timer);
    }
  }, [animationProgress, location]);

  const isEncrypted = location === "server";

  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <AnimatedSectionTitle className="text-black" subtitle={t("subtitle")}>
          {t("title")}
        </AnimatedSectionTitle>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Left: Dark Animation Card */}
          <div className="bg-black/80 rounded-none p-8">
            {/* Location Tabs */}
            <div className="flex gap-2 mb-4">
              <Badge
                className={`rounded-none px-4 py-2 transition-all duration-500 ${
                  location === "browser"
                    ? "bg-blue-500/20 text-blue-400 border-blue-500"
                    : "bg-gray-800 text-gray-500 border-gray-700"
                }`}
              >
                Browser
              </Badge>
              <Badge
                className={`rounded-none px-4 py-2 transition-all duration-500 ${
                  location === "server"
                    ? "bg-purple-500/20 text-purple-400 border-purple-500"
                    : "bg-gray-800 text-gray-500 border-gray-700"
                }`}
              >
                Server
              </Badge>
            </div>

            {/* Transcription Display */}
            <div className="bg-black/40 p-6 backdrop-blur-sm border border-gray-700/50 min-h-[280px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-gray-400 font-mono">
                  {isEncrypted ? "ENCRYPTED_DATA" : "transcription.txt"}
                </div>
              </div>

              <div className="flex-1 overflow-hidden space-y-3">
                {displayTranscript.map((segment, idx) => (
                  <div key={idx} className="space-y-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        `${segment.color} text-xs transition-opacity duration-300`,
                        isEncrypted ? "opacity-0" : "opacity-100",
                      )}
                    >
                      {segment.speaker}
                    </Badge>
                    <p
                      className={`font-mono text-sm leading-relaxed transition-colors duration-300 ${
                        isEncrypted ? "text-purple-400" : "text-gray-100"
                      }`}
                    >
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Key Points Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-lg">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="rounded-lg bg-blue-50 p-2">
                    <Lock className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-black mb-1">
                    {t("keyPoints.zeroRetention.title")}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t("keyPoints.zeroRetention.description")}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="rounded-lg bg-purple-50 p-2">
                    <Key className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-black mb-1">
                    {t("keyPoints.clientSide.title")}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t("keyPoints.clientSide.description")}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="rounded-lg bg-green-50 p-2">
                    <Shield className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-black mb-1">
                    {t("keyPoints.gdpr.title")}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t("keyPoints.gdpr.description")}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="rounded-lg bg-orange-50 p-2">
                    <Server className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-black mb-1">
                    {t("keyPoints.euServers.title")}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t("keyPoints.euServers.description")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
