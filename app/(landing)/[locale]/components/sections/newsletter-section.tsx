"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { useTranslations, useLocale } from "@/components/locale-provider";

const LEGACY_TOOLS = ["NVivo", "MAXQDA", "Alceste", "Iramuteq"];

export const NewsletterSection = () => {
  const t = useTranslations("newsletter");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          locale,
          source: "nvivo-modernization",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || t("error"));
      }

      setStatus("success");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : t("error"),
      );
    }
  };

  return (
    <section id="newsletter" className="container mx-auto px-4 py-24 md:px-6">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8 md:p-12">
        <div className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              {t("badge")}
            </span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-black md:text-4xl">
            {t("title")}
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            {t("description")}
          </p>

          {/* Legacy tools */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {LEGACY_TOOLS.map((tool) => (
              <span
                key={tool}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-500 line-through decoration-gray-400"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* Form / success state */}
        <div className="mx-auto mt-8 max-w-md">
          {status === "success" ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 px-4 py-4 text-center text-green-700">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="font-medium">{t("success")}</span>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("placeholder")}
                aria-label={t("placeholder")}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-black outline-none transition-colors focus:border-black"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "loading" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t("cta")
                )}
              </button>
            </form>
          )}

          {status === "error" && (
            <p className="mt-3 text-center text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          {status !== "success" && (
            <p className="mt-3 text-center text-sm text-gray-500">
              {t("disclaimer")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
