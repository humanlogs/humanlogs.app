import { useEffect } from "react";
import { useUserProfile } from "./use-api";

export const useWelcomeRedirect = () => {
  const { data } = useUserProfile();

  useEffect(() => {
    if (data?.id && !data?.isWelcomeCompleted) {
      window.location.href = "/welcome";
    }
  }, [data]);
};
