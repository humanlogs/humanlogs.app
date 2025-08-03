import { Env } from "@/env";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const authHeader = () => {
  return {
    Authorization: localStorage.getItem("token")
      ? `Bearer ${localStorage.getItem("token")}`
      : "",
  };
};

export const fetchServer = async <T>(url: string, body?: any) => {
  const res = await fetch(Env.server + url, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify(body),
  });

  if (res.status !== 200) {
    throw new Error("An error occurred");
  }

  return res.json() as T;
};

export const formatNumber = (num: number) => {
  return Intl.NumberFormat().format(num);
};

export const useNavigateAlt = () => {
  const navigate = useNavigate();
  return (str: string, event?: any) => {
    if (
      event &&
      (event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button === 1)
    ) {
      window.open(str, "_blank");
    } else {
      navigate(str, { state: event?.state });
    }
  };
};

export const normalizeString = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

export const useEffectPlease = (fn: () => void, deps: any[]) => {
  (useEffect as any)(fn, deps);
};
