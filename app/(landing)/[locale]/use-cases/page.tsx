"use client";

import { useTranslations } from "@/components/locale-provider";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Layout } from "../../_layout";
import { BookOpen, FileText, Mic, Users } from "lucide-react";

export default function UseCasesPage() {
  const t = useTranslations("landing");

  const useCases = [
    {
      name: "Research",
      slug: "research",
      icon: BookOpen,
      description:
        "For PhD students, universities, and qualitative researchers",
    },
    {
      name: "Education",
      slug: "education",
      icon: Users,
      description: "For lectures, seminars, and educational content",
    },
    {
      name: "Journalism",
      slug: "journalism",
      icon: FileText,
      description: "For investigative journalism and media production",
    },
    {
      name: "Podcasting",
      slug: "podcasting",
      icon: Mic,
      description: "For podcast transcription and content creation",
    },
  ];

  return (
    <Layout>
      <section className="container mx-auto px-4 py-24 md:px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight text-black md:text-5xl mb-4 text-center">
            HumanLogs Use Cases
          </h1>
          <p className="text-lg text-gray-600 md:text-xl mb-12 text-center">
            Discover how HumanLogs serves different professional needs
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {useCases.map((useCase) => (
              <Link key={useCase.slug} href={`/use-cases/${useCase.slug}`}>
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                  <useCase.icon className="h-8 w-8 text-blue-600 mb-3" />
                  <h3 className="font-semibold text-xl mb-2">{useCase.name}</h3>
                  <p className="text-sm text-gray-600">{useCase.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
