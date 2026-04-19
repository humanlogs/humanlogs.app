import { redirect } from "next/navigation";

export default function RootPage() {
  // Middleware will handle the redirect, but this is a fallback
  redirect("/en");
}
