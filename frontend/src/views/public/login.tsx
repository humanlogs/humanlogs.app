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
import { Logo } from "../../components/Logo";

const reviews = [
  {
    name: "Sarah Chen",
    role: "Content Creator",
    content: "totext.app has revolutionized my workflow. I can transcribe hours of interviews in minutes with incredible accuracy.",
    rating: 5
  },
  {
    name: "Michael Rodriguez",
    role: "Journalist", 
    content: "The best transcription tool I've used. Fast, accurate, and the interface is incredibly intuitive.",
    rating: 5
  },
  {
    name: "Emily Johnson",
    role: "Researcher",
    content: "Saves me hours every week. Perfect for academic interviews and focus group sessions.",
    rating: 5
  }
];

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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Login */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Logo className="h-12 w-auto mx-auto mb-6" />
            <h1 className="text-3xl font-bold">Welcome back</h1>
            <p className="text-muted-foreground mt-2">
              Sign in to your account to continue transcribing
            </p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Choose your preferred sign-in method
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GoogleOAuthProvider clientId={Env.googleoauth}>
                <div className="auth-button-wrapper google-button-container flex justify-center">
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
      </div>

      {/* Right side - Reviews */}
      <div className="bg-muted/30 p-8 flex items-center justify-center lg:block hidden">
        <div className="max-w-md mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Loved by creators worldwide</h2>
            <p className="text-muted-foreground">
              Join thousands of professionals who trust totext.app for their transcription needs
            </p>
          </div>
          
          <div className="space-y-6">
            {reviews.map((review, index) => (
              <Card key={index} className="bg-background/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">{review.name}</CardTitle>
                      <CardDescription>{review.role}</CardDescription>
                    </div>
                    <div className="flex">
                      {[...Array(review.rating)].map((_, i) => (
                        <svg key={i} className="h-4 w-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{review.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
