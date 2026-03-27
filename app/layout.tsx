import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { QueryProvider } from "@/components/query-provider";
import { SocketProvider } from "@/components/socket-provider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Transcrire",
  description: "Audio transcription application",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
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
          <SocketProvider>
            <LocaleProvider>
              <ThemeProvider
                defaultTheme="system"
                storageKey="transcription-theme"
              >
                {children}
                <Toaster richColors position="bottom-right" />
              </ThemeProvider>
            </LocaleProvider>
          </SocketProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
