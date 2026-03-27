"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { GoogleLoginButton } from "react-social-login-buttons";
import { MicrosoftLoginButton } from "react-social-login-buttons";
import { LinkedInLoginButton } from "react-social-login-buttons";
import { FacebookLoginButton } from "react-social-login-buttons";
import { toast } from "sonner";

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
        toast.success("Logged in successfully!");
        window.location.href = "/";
      } else {
        toast.error(data.error || "Login failed");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
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
        toast.success("Account created successfully!");
        window.location.href = "/";
      } else {
        toast.error(data.error || "Registration failed");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-950">
        {/* Logo and Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-colors.svg"
              alt="Logo"
              className="flex dark:hidden w-16 h-16"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-white.svg"
              alt="Logo"
              className="dark:flex hidden w-16 h-16"
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to access your transcriptions
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
                  Sign in with Email
                </Button>
              ) : !showRegister ? (
                <form onSubmit={handleLocalLogin} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
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
                    {isLoading ? "Signing in..." : "Sign in"}
                  </Button>
                  <div className="text-center text-sm">
                    <button
                      type="button"
                      onClick={() => setShowRegister(true)}
                      className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      Don&apos;t have an account? Register
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowEmailLogin(false)}
                  >
                    Back
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleLocalRegister} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name (Optional)</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={8}
                    />
                    <p className="text-xs text-zinc-500">
                      At least 8 characters
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating account..." : "Create account"}
                  </Button>
                  <div className="text-center text-sm">
                    <button
                      type="button"
                      onClick={() => setShowRegister(false)}
                      className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      Already have an account? Sign in
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
                    Back
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
            By signing in, you agree to our Terms of Service and Privacy Policy
          </div>
        </div>
      </div>
    </div>
  );
}
