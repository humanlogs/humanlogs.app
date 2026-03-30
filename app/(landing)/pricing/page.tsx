import { FAQSection, PricingSection } from "../components/sections";

export default function Page() {
  return (
    <>
      <PricingSection showFeatureGrid={true} />
      <FAQSection />
    </>
  );
}
