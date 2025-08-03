import { Env } from "@/env";
import { useUser } from "@features/user/use-user";
import { useEffectPlease } from "@features/utils";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

export function LoginPage() {
  const { login } = useUser();
  const { t } = useTranslation();
  const urlParams = new URLSearchParams(window.location.search);
  const targetApp = urlParams.get("login-to-app"); // Your custom query param
  const utmSource = urlParams.get("utm_source") || ""; // Get UTM source

  // Include UTM params in the redirect URL
  const redirectParams = new URLSearchParams();
  if (targetApp) redirectParams.append("login-to-app", "1");
  if (utmSource) redirectParams.append("utm_source", utmSource);

  const redirectUrl = `${window.location.origin}${
    redirectParams.toString() ? `?${redirectParams.toString()}` : ""
  }`;

  useEffectPlease(() => {
    const redirectFlow = async () => {
      const useRedirect = urlParams.get("redirect"); // Your custom query param

      if (useRedirect) {
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
          Env.googleoauth
        }&redirect_uri=${encodeURIComponent(
          redirectUrl
        )}&response_type=token&scope=email profile`;

        window.location.href = googleAuthUrl;
      }

      // if access_token in URL, login with token (in hash #access_token)
      const hash = window.location.hash;
      const token = hash.split("access_token=")?.[1]?.split("&")?.[0];
      if (token) {
        login("google", "redirect:" + token, {
          utm_source: utmSource,
        });
      }
    };

    redirectFlow();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleOAuthProvider clientId={Env.googleoauth}>
            <div className="auth-button-wrapper google-button-container">
              <GoogleLogin
                width={320}
                size={"large"}
                onSuccess={(credentialResponse) =>
                  login("google", credentialResponse.credential || "")
                }
                onError={() => {
                  toast.error(t("login.failed_to_login"));
                }}
                text="continue_with"
                shape="pill"
                locale="en"
              />
            </div>
          </GoogleOAuthProvider>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              By continuing, you agree to our{" "}
              <a href="/terms" className="text-primary hover:underline">
                Terms of Service
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
