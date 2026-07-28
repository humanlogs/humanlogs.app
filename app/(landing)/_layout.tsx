"use client";

import Script from "next/script";
import { VisitTracker } from "@/components/visit-tracker";
import { LandingFooter } from "./[locale]/components/landing-footer";
import { LandingHeader } from "./[locale]/components/landing-header";
import { CookieConsentBanner } from "./[locale]/components/cookie-consent-banner";
import { useSyncExternalStore } from "react";
import Cookies from "js-cookie";

/** The consent cookie never changes without a reload, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  // Read on the client only (the server has no access to the cookie), without a
  // state-setting effect: the server snapshot is `false`, so hydration matches.
  const hasConsent = useSyncExternalStore(
    subscribeToNothing,
    () => Cookies.get("humanlogs-cookie-consent") === "true",
    () => false,
  );

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
