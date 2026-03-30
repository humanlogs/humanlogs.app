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
            </ul>
          </div>

          {/* Product */}
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
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Contact</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Contact Sales
                </Link>
              </li>
            </ul>
          </div>

          {/* Open Source */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">
              Open Source
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://github.com/your-repo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Section */}
        <div className="mt-12 border-t border-gray-800 pt-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/legal/privacy"
              className="text-sm text-gray-400 hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              href="/legal/terms"
              className="text-sm text-gray-400 hover:text-white"
            >
              Terms of Service
            </Link>
            <Link
              href="/legal/cookies"
              className="text-sm text-gray-400 hover:text-white"
            >
              Cookie Policy
            </Link>
            <Link
              href="/legal/dpa"
              className="text-sm text-gray-400 hover:text-white"
            >
              DPA
            </Link>
            <Link
              href="/legal/subprocessors"
              className="text-sm text-gray-400 hover:text-white"
            >
              Subprocessors
            </Link>
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
