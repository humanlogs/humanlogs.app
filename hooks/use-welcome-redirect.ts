import { useEffect } from "react";
import { useUserProfile } from "./use-api";

export const useWelcomeRedirect = () => {
  const { data } = useUserProfile();

  useEffect(() => {
    if (data?.id && !data?.isWelcomeDone) {
      window.location.href = "/app/welcome";
    }
  }, [data]);
};
