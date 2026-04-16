import { VisitTracker } from "@/components/visit-tracker";
import { LandingFooter } from "./components/landing-footer";
import { LandingHeader } from "./components/landing-header";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <LandingHeader />
      <VisitTracker />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
};
