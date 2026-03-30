"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/components/locale-provider";
import { useState } from "react";
import { GoogleLoginButton } from "react-social-login-buttons";
import { MicrosoftLoginButton } from "react-social-login-buttons";
import { LinkedInLoginButton } from "react-social-login-buttons";
import { FacebookLoginButton } from "react-social-login-buttons";
import { toast } from "sonner";
import { AnimatedWave } from "@/app/(landing)/components/sections/animated-wave";
import { AnimatedTranscriptCard } from "@/app/(landing)/components/sections/animated-transcript-card";
import { TestimonialsSection } from "../../(landing)/components/sections";
import { TestimonialCard } from "../../(landing)/components/sections/testimonials-section";

type AuthProvider =
  | "google-oauth2"
  | "facebook"
  | "windowslive"
  | "github"
  | "linkedin"
  | "apple"
  | "orcid"
  | "Username-Password-Authentication";

const USE_LOCAL_AUTH = process.env.NEXT_PUBLIC_AUTH_MODE === "local";

export default function LoginPage() {
  const t = useTranslations("login");
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSocialLogin = (connection: AuthProvider) => {
    const params = new URLSearchParams({ connection });
    window.location.href = `/api/auth/login?${params.toString()}`;
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/local-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t("loginSuccess"));
        // Detect if this is a new account
        window.location.href = "/app";
      } else {
        toast.error(data.error || t("loginFailed"));
      }
    } catch {
      toast.error(t("errorOccurred"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/local-auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t("accountCreated"));
        window.location.href = "/app";
      } else {
        toast.error(data.error || t("registrationFailed"));
      }
    } catch {
      toast.error(t("errorOccurred"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-black p-4 lg:p-8">
        <div className="w-full max-w-md space-y-8 rounded-2xl p-8">
          {/* Logo and Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Logo" className="flex w-16 h-16" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t("title")}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t("subtitle")}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {/* Local Auth - Simple Email/Password */}
            {USE_LOCAL_AUTH ? (
              <>
                {!showEmailLogin ? (
                  <Button
                    onClick={() => setShowEmailLogin(true)}
                    className="w-full h-11 text-base"
                  >
                    {t("signInWithEmail")}
                  </Button>
                ) : !showRegister ? (
                  <form onSubmit={handleLocalLogin} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("email")}</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t("emailPlaceholder")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">{t("password")}</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder={t("passwordPlaceholder")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={isLoading}
                    >
                      {isLoading ? t("signingIn") : t("signIn")}
                    </Button>
                    <div className="text-center text-sm">
                      <button
                        type="button"
                        onClick={() => setShowRegister(true)}
                        className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        {t("noAccount")}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setShowEmailLogin(false)}
                    >
                      {t("back")}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleLocalRegister} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("name")}</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder={t("namePlaceholder")}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">{t("email")}</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder={t("emailPlaceholder")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">{t("password")}</Label>
                      <Input
                        id="reg-password"
                        type="password"
                        placeholder={t("passwordPlaceholder")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        minLength={8}
                      />
                      <p className="text-xs text-zinc-500">
                        {t("minPasswordLength")}
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={isLoading}
                    >
                      {isLoading ? t("creatingAccount") : t("createAccount")}
                    </Button>
                    <div className="text-center text-sm">
                      <button
                        type="button"
                        onClick={() => setShowRegister(false)}
                        className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        {t("alreadyHaveAccount")}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setShowRegister(false);
                        setShowEmailLogin(false);
                      }}
                    >
                      {t("back")}
                    </Button>
                  </form>
                )}
              </>
            ) : (
              <>
                {/* Auth0 Social Login Buttons */}
                <div className="space-y-3">
                  <div>
                    <GoogleLoginButton
                      onClick={() => handleSocialLogin("google-oauth2")}
                      text="Continue with Google"
                      style={{
                        fontSize: "14px",
                        height: "44px",
                        borderRadius: "8px",
                        boxShadow: "none",
                        border: "1px solid #E5E7EB",
                      }}
                    />
                  </div>

                  <div>
                    <MicrosoftLoginButton
                      onClick={() => handleSocialLogin("windowslive")}
                      text="Continue with Microsoft"
                      style={{
                        fontSize: "14px",
                        height: "44px",
                        borderRadius: "8px",
                        boxShadow: "none",
                        border: "1px solid #444",
                      }}
                    />
                  </div>

                  <div>
                    <LinkedInLoginButton
                      onClick={() => handleSocialLogin("linkedin")}
                      text="Continue with LinkedIn"
                      style={{
                        fontSize: "14px",
                        height: "44px",
                        borderRadius: "8px",
                        boxShadow: "none",
                      }}
                    />
                  </div>

                  <div>
                    <FacebookLoginButton
                      onClick={() => handleSocialLogin("facebook")}
                      text="Continue with Facebook"
                      style={{
                        fontSize: "14px",
                        height: "44px",
                        borderRadius: "8px",
                        boxShadow: "none",
                      }}
                    />
                  </div>

                  <Button
                    onClick={() =>
                      handleSocialLogin("Username-Password-Authentication")
                    }
                    variant="link"
                    className={"w-full mt-4"}
                  >
                    Continue with an email
                  </Button>
                </div>
              </>
            )}

            <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 pt-4">
              {t("termsAndConditions")}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Hero Animations */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-zinc-50 to-zinc-100 border-l p-8 items-center justify-center">
        <div className="w-full max-w-2xl space-y-8">
          {/* Animated Wave */}
          <div className="mb-8">
            <AnimatedWave />
          </div>

          {/* Animated Transcript Card */}
          <div>
            <AnimatedTranscriptCard showHoverOverlay={false} />
          </div>
          <TestimonialCard short />
        </div>
      </div>
    </div>
  );
}
