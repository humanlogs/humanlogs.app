import { FAQSection, PricingSection } from "../components/sections";
import { RelatedLinks } from "../components/related-links";

export default function Page() {
  return (
    <>
      <PricingSection showFeatureGrid={true} />
      <RelatedLinks
        title="Learn More About HumanLogs"
        links={[
          {
            title: "Research Use Case",
            description: "Perfect for academic research and PhD students",
            href: "/use-cases/research",
          },
          {
            title: "Journalism Use Case",
            description: "Protect sources with end-to-end encryption",
            href: "/use-cases/journalism",
          },
          {
            title: "Free Tools",
            description: "Audio conversion and compression tools",
            href: "/tools",
          },
          {
            title: "Compare Alternatives",
            description: "See how HumanLogs compares to competitors",
            href: "/alternatives",
          },
          {
            title: "Security & Privacy",
            description: "Learn about our privacy-first approach",
            href: "/resources",
          },
          {
            title: "Contact Sales",
            description: "Get institutional pricing and DPA",
            href: "/contact",
          },
        ]}
        columns={3}
      />
      <FAQSection />
    </>
  );
}
