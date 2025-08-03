import { fetchServer } from "@features/utils";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "react-query";
import { UserType } from "./type";

// If ?login-to-app in url, send jwt to app
const logInAppIfNeeded = () => {
  if (document.location.search.includes("login-to-app")) {
    const token = localStorage.getItem("token");
    if (token) {
      setTimeout(() => {
        window.location.href = "photographeai://login?token=" + token;
      }, 50);
    }
  }
};
logInAppIfNeeded();

// Get UTM parameters from URL
const getUtmParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    utm_source: urlParams.get("utm_source") || "",
  };
};

// If ?token in url, set it to localstorage
if (document.location.search.includes("token=")) {
  const token = document.location.search.split("token=")[1];
  localStorage.setItem("token", token);
}

export const useUser = () => {
  const client = useQueryClient();

  const user = useQuery("user", async () => {
    try {
      return await fetchServer<UserType>("/api/auth/me");
    } catch (e) {
      console.log(e);
      return null;
    }
  });

  useEffect(() => {
    if (
      user.data &&
      !localStorage.getItem("registered_sign_up") &&
      user.data.created_at > Date.now() - 1000 * 60 * 10 // Check if user signed up in the last 10 minutes
    ) {
      localStorage.setItem("registered_sign_up", "true");
    }
  }, [user.data]);

  const login = async (type = "google", token: string, optionalArgs?: any) => {
    try {
      // Get UTM parameters to pass to the backend
      const utmParams = getUtmParams();

      const data = await fetchServer<{ token: string }>("/api/auth/" + type, {
        token,
        options: {
          ...optionalArgs,
          utm_source: utmParams.utm_source,
        },
      });
      if (data.token) {
        localStorage.setItem("token", data.token);
        logInAppIfNeeded();
        client.invalidateQueries("user");
      } else {
        throw new Error("Failed to login");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to login");
    }
  };

  const logout = async () => {
    // Clear all local storage except the ones starting with "ph_" or "persist_"
    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith("ph_") && !key.startsWith("persist_")) {
        localStorage.removeItem(key);
      }
    });
    client.invalidateQueries("user");
    document.location.href = "/";
  };

  const consent = async (
    type: "models" | "styles" | "images" | "initial",
    value?: string
  ) => {
    try {
      await fetchServer(
        "/api/auth/me",
        type === "initial"
          ? {
              consent: true,
            }
          : { [type]: value }
      );
      client.invalidateQueries("user");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update consent");
    }
  };

  const setAnalytics = async (analytics: {
    features: string[];
    sources: string[];
  }) => {
    try {
      await fetchServer("/api/auth/me", {
        analytics,
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to update consent");
    }
  };

  return {
    user,
    login,
    logout,
    refresh: () => client.invalidateQueries("user"),
    consent,
    setAnalytics,
  };
};
