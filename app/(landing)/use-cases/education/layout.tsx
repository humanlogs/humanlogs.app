import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transcription for Education & E-Learning | HumanLogs",
  description:
    "Transcribe lectures, seminars, and educational content with complete privacy. Support for 100+ languages, accessible transcripts, and GDPR-compliant data handling for schools and universities.",
  keywords: [
    "education transcription",
    "lecture transcription",
    "e-learning transcription",
    "university lectures",
    "educational content",
    "accessible transcripts",
    "multilingual transcription",
    "student transcription",
  ],
  openGraph: {
    title: "Transcription for Education & Universities - HumanLogs",
    description:
      "Privacy-first transcription for lectures, seminars, and educational content. 100+ languages, accessible formats, GDPR compliant.",
    url: "https://humanlogs.app/use-cases/education",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs - Education Transcription Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Transcription for Education - HumanLogs",
    description:
      "Privacy-first lecture and seminar transcription. 100+ languages, accessible, GDPR compliant.",
    images: ["/landing/og-image.png"],
  },
};

export default function EducationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
