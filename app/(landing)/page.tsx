import { Layout } from "./_layout";
import { HeroSection } from "./components/sections/hero-section";
import { LogoSection } from "./components/sections/logo-section";

export default function LandingPage() {
  return (
    <Layout>
      <HeroSection />
      <LogoSection />
    </Layout>
  );
}
