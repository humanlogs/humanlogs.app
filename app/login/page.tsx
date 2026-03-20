"use client";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const handleLogin = () => {
    // Redirect to Auth0 login
    window.location.href = "/api/auth/login";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to access your transcriptions
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="space-y-4">
            <Button
              onClick={handleLogin}
              className="w-full h-12 text-base"
              size="lg"
            >
              Sign in with Auth0
            </Button>
          </div>

          <div className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </div>
        </div>
      </div>
    </div>
  );
}
