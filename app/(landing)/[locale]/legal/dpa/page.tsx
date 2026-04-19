import Link from "next/link";
import { AnimatedSectionTitle } from "../../components/animated-section-title";
import { DocumentLayout } from "../layout";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <>
      <AnimatedSectionTitle className="text-black">
        Data Processing Agreement (DPA)
      </AnimatedSectionTitle>

      <DocumentLayout>
        <h1>Data Processing Agreement (DPA)</h1>

        <h2>Summary</h2>
        <p>
          A Data Processing Agreement or DPA for short, is a legal contract that
          outlines how we process and protect your data.
        </p>
        <ul>
          <li>Our DPA is available for Pro and Business plans.</li>
          <li>
            DPA covers encryption, GDPR compliance, subprocessors, breach
            notifications, and deletion policies.
          </li>
          <li>
            DPA also ensures in writing that your data is yours and never
            trained on, sold, or shared.
          </li>
          <li>
            Customers without a DPA are still ensured the same robust security.
          </li>
        </ul>

        <div className="my-8">
          <Link href="/contact">
            <Button size="lg" variant="default">
              Request DPA
            </Button>
          </Link>
        </div>

        <h2>What is a DPA?</h2>
        <p>
          Our Data Processing Agreement is for Professional and Business users
          only. It is a legally binding contract between a data controller (you,
          the customer) and a data processor (HumanLogs). It outlines how we
          process, protect, and handle personal data on your behalf. Our DPA
          ensures that:
        </p>
        <ul>
          <li>
            If you use storage features, your data remains private and
            accessible only to you.
          </li>
          <li>
            We only process your data for the purpose of delivering
            transcription services.
          </li>
          <li>
            We never use your files for AI training, marketing, or resale.
          </li>
          <li>
            All processing takes place in the European Union, under GDPR rules.
          </li>
        </ul>

        <h2>Our Commitments Outlined in the DPA</h2>
        <p>
          The HumanLogs DPA outlines our strongest privacy and security
          commitments. You remain the full owner and controller of your files,
          and we maintain full transparency about all{" "}
          <a href="/legal/subprocessors">subprocessors</a>. If a data breach
          ever occurs, you will be notified promptly.
        </p>
        <p>
          Enterprise clients receive defined audit and compliance rights, and if
          you leave HumanLogs, your data is deleted according to GDPR
          requirements.
        </p>
        <p>
          Learn more about our <a href="/resources">security practices</a>.
        </p>

        <h2>Who Needs a DPA?</h2>
        <p>
          If you or your organization handle personal or sensitive data, our DPA
          helps you meet compliance obligations while using HumanLogs.
        </p>
        <ul>
          <li>
            <strong>Academic institutions</strong> that process student or
            research data.
          </li>
          <li>
            <strong>Businesses</strong> with compliance teams or enterprise
            requirements.
          </li>
          <li>
            <strong>Consultants and agencies</strong> handling sensitive client
            files.
          </li>
          <li>
            <strong>Legal professionals</strong> who require documented
            guarantees for client confidentiality.
          </li>
        </ul>

        <p>
          Read our <a href="/legal/privacy">privacy policy</a> for more
          information.
        </p>

        <div className="mt-8 p-6 bg-muted rounded-lg">
          <h3 className="text-lg font-semibold mb-3">
            Ready to Request a DPA?
          </h3>
          <p className="mb-4">
            Contact us to receive your Data Processing Agreement. Our team will
            guide you through the process.
          </p>
          <Link href="/contact">
            <Button size="lg" variant="default">
              Contact Us
            </Button>
          </Link>
        </div>
      </DocumentLayout>
    </>
  );
}
