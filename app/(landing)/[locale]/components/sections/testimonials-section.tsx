"use client";

import { Quote } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { AnimatedSectionTitle } from "../animated-section-title";

interface TestimonialCardProps {
  quote?: string;
  author?: string;
  role?: string;
  institution?: string;
  short?: boolean;
}

export const TestimonialCard = ({
  quote,
  author,
  role,
  institution,
  short,
}: TestimonialCardProps) => {
  const t = useTranslations("testimonials");
  return (
    <div className="border border-gray-200 rounded-lg p-8 hover:shadow-lg transition-shadow flex flex-col h-full bg-white">
      {!short && (
        <div className="mb-6">
          <Quote className="h-10 w-10 text-blue-500 opacity-20" />
        </div>
      )}
      <blockquote className="text-gray-700 leading-relaxed mb-6 flex-grow">
        &ldquo;{quote || t("items.researcher1.quote")}&rdquo;
      </blockquote>
      <div className={short ? "" : "border-t border-gray-100 pt-6"}>
        <div className="font-semibold text-black">
          {author || t("items.researcher1.author")}
        </div>
        <div className="text-sm text-gray-600">
          {role || t("items.researcher1.role")}
        </div>
        {!short && (
          <div className="text-sm text-gray-500">
            {institution || t("items.researcher1.institution")}
          </div>
        )}
      </div>
    </div>
  );
};

export const TestimonialsSection = () => {
  const t = useTranslations("testimonials");

  const testimonials = [
    {
      quote: t("items.researcher1.quote"),
      author: t("items.researcher1.author"),
      role: t("items.researcher1.role"),
      institution: t("items.researcher1.institution"),
    },
    {
      quote: t("items.researcher2.quote"),
      author: t("items.researcher2.author"),
      role: t("items.researcher2.role"),
      institution: t("items.researcher2.institution"),
    },
    {
      quote: t("items.researcher3.quote"),
      author: t("items.researcher3.author"),
      role: t("items.researcher3.role"),
      institution: t("items.researcher3.institution"),
    },
  ];

  return (
    <section className="py-24 bg-gray-50">
      <div className="container mx-auto px-4 md:px-6">
        <AnimatedSectionTitle className="text-black" subtitle={t("subtitle")}>
          {t("title")}
        </AnimatedSectionTitle>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={index} {...testimonial} />
          ))}
        </div>
      </div>
    </section>
  );
};
