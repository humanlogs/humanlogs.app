import { toast } from "sonner";

export const fetchGateway = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  if (
    response.status === 429 &&
    !document.location.href.includes("/app/overload")
  ) {
    toast.error("Too many requests. Please try again later.");
    document.location.href = "/app/overload";
  }
  if (
    response.status === 401 &&
    !document.location.href.includes("/app/login") &&
    document.location.href.includes("/app")
  ) {
    document.location.href = "/app/login";
  }
  return response;
};
