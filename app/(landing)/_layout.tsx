"use client";

import Script from "next/script";
import { VisitTracker } from "@/components/visit-tracker";
import { LandingFooter } from "./components/landing-footer";
import { LandingHeader } from "./components/landing-header";
import { CookieConsentBanner } from "./components/cookie-consent-banner";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    // Check if user has given consent
    const consent = Cookies.get("humanlogs-cookie-consent");
    setHasConsent(consent === "true");
  }, []);

  return (
    <>
      {/* Google Analytics - Only load if user has consented */}
      {hasConsent && (
        <>
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-82T49CWGM7"
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-82T49CWGM7');
            `}
          </Script>
        </>
      )}

      <div className="flex min-h-screen flex-col bg-white">
        <LandingHeader />
        <VisitTracker />
        <main className="flex-1">{children}</main>
        <LandingFooter />
      </div>

      <CookieConsentBanner />
    </>
  );
};
