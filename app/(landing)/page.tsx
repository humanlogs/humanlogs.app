import { Layout } from "./_layout";
import {
  EncryptionSection,
  FAQSection,
  PricingSection,
  TestimonialsSection,
} from "./components/sections";
import { HeroSection } from "./components/sections/hero-section";
import { LogoSection } from "./components/sections/logo-section";

export default function LandingPage() {
  return (
    <Layout>
      <HeroSection />
      <LogoSection />
      <TestimonialsSection />
      <EncryptionSection />
      <PricingSection showFeatureGrid={false} />
      <FAQSection />
    </Layout>
  );
}
