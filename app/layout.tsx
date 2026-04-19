import { LocaleProvider } from "@/components/locale-provider";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Privacy-First Transcription for Research - humanlogs.app",
  description:
    "Audio transcription software built for research. Fast, secure, and privacy-first.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title:
      "humanlogs.app - Fast, confidential transcription for your research interviews",
    description:
      "Build and refine transcripts 4 times faster. End-to-end encrypted, 100+ languages, open source.",
    url: "https://humanlogs.app",
    siteName: "humanlogs.app",
    images: [
      {
        url: "https://humanlogs.app/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "humanlogs.app - Audio transcription software for research",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "humanlogs.app - Fast, confidential transcription for research",
    description:
      "Build and refine transcripts 4 times faster. End-to-end encrypted, 100+ languages, open source.",
    images: ["https://humanlogs.app/landing/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <LocaleProvider>
            <ThemeProvider
              defaultTheme="system"
              storageKey="transcription-theme"
            >
              {children}
              <Toaster richColors position="bottom-right" />
            </ThemeProvider>
          </LocaleProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
