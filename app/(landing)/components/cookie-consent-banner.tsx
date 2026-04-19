"use client";

import CookieConsent from "react-cookie-consent";
import Link from "next/link";

export function CookieConsentBanner() {
  return (
    <CookieConsent
      location="bottom"
      buttonText="Accept"
      declineButtonText="Decline"
      enableDeclineButton
      cookieName="humanlogs-cookie-consent"
      style={{
        background: "#1a1a1a",
        padding: "20px",
        alignItems: "center",
      }}
      buttonStyle={{
        background: "#22c55e",
        color: "#ffffff",
        fontSize: "14px",
        padding: "10px 30px",
        borderRadius: "6px",
        fontWeight: "500",
      }}
      declineButtonStyle={{
        background: "transparent",
        color: "#ffffff",
        fontSize: "14px",
        padding: "10px 30px",
        borderRadius: "6px",
        border: "1px solid #ffffff",
        fontWeight: "500",
      }}
      expires={365}
      onAccept={() => {
        // Reload to initialize analytics
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }}
    >
      <span style={{ fontSize: "14px" }}>
        We use cookies to analyze website traffic and improve your experience.{" "}
        <Link
          href="/legal/cookies"
          style={{ textDecoration: "underline", color: "#60a5fa" }}
        >
          Learn more
        </Link>
      </span>
    </CookieConsent>
  );
}
