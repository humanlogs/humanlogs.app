"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { AnimatedSectionTitle } from "../animated-section-title";

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}

const FAQItem = ({ question, answer, isOpen, onClick }: FAQItemProps) => {
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between py-6 text-left transition-all hover:text-gray-600"
      >
        <span className="text-lg font-semibold text-black pr-8">
          {question}
        </span>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "max-h-96 pb-6" : "max-h-0"
        }`}
      >
        <p className="text-gray-600 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
};

export const FAQSection = () => {
  const t = useTranslations("faq");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: t("questions.cancel.question"),
      answer: t("questions.cancel.answer"),
    },
    {
      question: t("questions.downgrade.question"),
      answer: t("questions.downgrade.answer"),
    },
    {
      question: t("questions.freeVersion.question"),
      answer: t("questions.freeVersion.answer"),
    },
    {
      question: t("questions.invoices.question"),
      answer: t("questions.invoices.answer"),
    },
    {
      question: t("questions.extraHours.question"),
      answer: t("questions.extraHours.answer"),
    },
    {
      question: t("questions.rollover.question"),
      answer: t("questions.rollover.answer"),
    },
    {
      question: t("questions.overLimit.question"),
      answer: t("questions.overLimit.answer"),
    },
    {
      question: t("questions.paymentMethods.question"),
      answer: t("questions.paymentMethods.answer"),
    },
    {
      question: t("questions.enterprise.question"),
      answer: t("questions.enterprise.answer"),
    },
    {
      question: t("questions.university.question"),
      answer: t("questions.university.answer"),
    },
    {
      question: t("questions.security.question"),
      answer: t("questions.security.answer"),
    },
    {
      question: t("questions.selfHosted.question"),
      answer: t("questions.selfHosted.answer"),
    },
  ];

  return (
    <section className="container mx-auto px-4 py-24 md:px-6" id="faq">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <AnimatedSectionTitle className="text-black" subtitle={t("subtitle")}>
          {t("title")}
        </AnimatedSectionTitle>

        {/* FAQ Items */}
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-200">
          <div className="p-6 md:p-8">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === index}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">{t("stillHaveQuestions")}</p>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-800"
          >
            {t("contactUs")}
          </a>
        </div>
      </div>
    </section>
  );
};
