import Link from "next/link";
import { Github } from "lucide-react";
import Image from "next/image";

export const LandingFooter = () => {
  return (
    <footer className="border-t border-gray-800 bg-black">
      <div className="container mx-auto px-4 py-12 md:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
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
            <h3 className="mb-4 text-sm font-semibold text-white">Use Cases</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/use-cases/research"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Research
                </Link>
              </li>
              {/*<li>
                <Link
                  href="/use-cases/journalism"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Journalism
                </Link>
              </li>
              <li>
                <Link
                  href="/use-cases/podcasting"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Podcasting
                </Link>
              </li>
              <li>
                <Link
                  href="/use-cases/education"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Education
                </Link>
              </li>*/}
            </ul>
          </div>

          {/* Alternatives */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">
              Alternatives
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/alternatives/otterai"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  vs Otter.ai
                </Link>
              </li>
              <li>
                <Link
                  href="/alternatives/goodtapeio"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  vs Goodtape.io
                </Link>
              </li>
              <li>
                <Link
                  href="/alternatives/speakr"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  vs Speakr
                </Link>
              </li>
            </ul>
          </div>

          {/* Product / Contact / Open Source */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/pricing"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/#faq"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Contact Sales
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/humanlogs/humanlogs.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/legal/privacy"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/terms"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/cookies"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/dpa"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  DPA
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/subprocessors"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Subprocessors
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-gray-800 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()} humanlogs.app. All rights reserved.
            </p>
            <p className="text-sm text-gray-400">
              Privacy-first transcription for research
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
