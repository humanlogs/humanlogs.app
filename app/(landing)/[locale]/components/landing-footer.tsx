"use client";

import { useTranslations } from "@/components/locale-provider";
import Image from "next/image";
import Link from "next/link";

export const LandingFooter = () => {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-gray-800 bg-black">
      <div className="container mx-auto px-4 py-12 md:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Logo */}
          <div>
            <Link href="/" className="text-3xl font-semibold text-white">
              <Image
                src="/logo.svg"
                alt="HumanLogs Logo"
                width={96}
                height={96}
                className="inline-block mr-2"
              />
            </Link>
          </div>

          {/* Use Cases */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">
              {t("sections.useCases")}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/use-cases/research"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("useCases.research")}
                </Link>
              </li>
              <li>
                <Link
                  href="/use-cases/journalism"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("useCases.journalism")}
                </Link>
              </li>
              <li>
                <Link
                  href="/use-cases/podcasting"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("useCases.podcasting")}
                </Link>
              </li>
              <li>
                <Link
                  href="/use-cases/education"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("useCases.education")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Free Tools */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">
              {t("sections.freeTools")}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/tools/srt-tester"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("freeTools.srtTester")}
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/video-to-audio"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("freeTools.videoToAudio")}
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/audio-compression"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("freeTools.audioCompression")}
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/mp3-to-wav"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("freeTools.mp3ToWav")}
                </Link>
              </li>
              <li>
                <Link
                  href="/tools"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {t("freeTools.viewAll")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Alternatives */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">
              {t("sections.alternatives")}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/alternatives/otterai"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("alternatives.otter")}
                </Link>
              </li>
              <li>
                <Link
                  href="/alternatives/goodtapeio"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("alternatives.goodtape")}
                </Link>
              </li>
              <li>
                <Link
                  href="/alternatives/vookai"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("alternatives.vook")}
                </Link>
              </li>
              <li>
                <Link
                  href="/alternatives/transcribecom"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("alternatives.transcribe")}
                </Link>
              </li>
              <li>
                <Link
                  href="/alternatives/speakr"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("alternatives.speakr")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Product / Contact / Open Source */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">
              {t("sections.product")}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/blog"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("product.blog")}
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("product.pricing")}
                </Link>
              </li>
              <li>
                <Link
                  href="/#faq"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("product.faq")}
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("product.contactSales")}
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/humanlogs/humanlogs.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
                >
                  {t("product.github")}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">
              {t("sections.legal")}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/legal/privacy"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("legal.privacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/terms"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("legal.terms")}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/gdpr"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("legal.gdpr")}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/cookies"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("legal.cookies")}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/dpa"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("legal.dpa")}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/subprocessors"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("legal.subprocessors")}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/irb"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {t("legal.irb")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-gray-800 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()} humanlogs.app. {t("copyright")}
            </p>
            <p className="text-sm text-gray-400">{t("tagline")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
