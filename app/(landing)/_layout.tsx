import { LandingHeader } from "./components/landing-header";
import { LandingFooter } from "./components/landing-footer";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <LandingHeader />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
};
