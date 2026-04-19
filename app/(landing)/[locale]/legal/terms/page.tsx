import { AnimatedSectionTitle } from "../../components/animated-section-title";
import { DocumentLayout } from "../layout";

export default function Page() {
  return (
    <>
      <AnimatedSectionTitle className="text-black">
        Terms of Service
      </AnimatedSectionTitle>

      <DocumentLayout>
        <h1>Terms of Service</h1>
        <p>
          <strong>Last updated:</strong> March 31, 2026
        </p>

        <h2>Summary</h2>
        <p>
          Your files remain yours and are only used to provide the service. They
          are never used for AI training. You are responsible for your content
          and should verify transcription accuracy. Files are deleted after
          processing unless you choose to store them.
        </p>

        <h2>Introduction</h2>
        <p>
          These Terms of Service ("Terms") govern your use of our transcription
          service ("Service"). By creating an account or using the Service, you
          agree to these Terms.
        </p>

        <h2>Use of the Service</h2>
        <p>
          You must be at least 18 years old to use the Service. You agree to use
          the Service in compliance with applicable laws and not misuse or abuse
          it. We reserve the right to suspend or block any account in case of
          misuse.
        </p>

        <h2>Accuracy of Transcriptions</h2>
        <p>
          Transcriptions are generated using AI and may not be fully accurate.
          You are responsible for reviewing and validating any output before
          use.
        </p>

        <h2>User Content</h2>
        <p>
          You retain full ownership of all files you upload and content
          generated. We process your data only to provide the Service and never
          use it to train AI models. We do not sell, rent, or share your content
          with third parties.
        </p>

        <h2>Data Security</h2>
        <p>
          All files are end-to-end encrypted. You are responsible for safely
          storing your encryption keys or certificates. We are not responsible
          for any loss of data resulting from lost encryption credentials.
        </p>

        <h2>Self-Hosted Version</h2>
        <p>
          We offer a self-hosted version of the Service available on GitHub
          under the GNU Affero General Public License v3 (AGPL-3.0). You may
          use, modify, and deploy this version according to the license terms.
          Reselling the solution or offering it as a service requires prior
          written consent from us.
        </p>

        <h2>Subscriptions, Billing and Refunds</h2>
        <p>
          Paid features are available through subscription plans. You may cancel
          your subscription at any time. Cancellation takes effect at the end of
          the current billing period.
        </p>
        <p>
          Refunds may be granted upon request. Any used credits remain due
          unless otherwise decided by us.
        </p>

        <h2>Service Availability</h2>
        <p>
          The Service is provided "as is" and "as available". We do not
          guarantee uninterrupted availability. We are not responsible for
          temporary service interruptions.
        </p>
        <p>
          In the event of a definitive shutdown of the Service, you may request
          a transfer of your personal data.
        </p>

        <h2>Intellectual Property</h2>
        <p>
          All rights related to the Service (excluding your content) remain our
          property. You are granted a limited, non-exclusive right to use the
          Service.
        </p>

        <h2>Termination</h2>
        <p>
          We may suspend or terminate access to the Service at any time in case
          of misuse or violation of these Terms.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          We are not liable for any damages resulting from the use or inability
          to use the Service, including data loss, inaccuracies, or service
          interruptions.
        </p>

        <h2>Changes to the Service and Terms</h2>
        <p>
          We may update or modify the Service or these Terms at any time. We
          will notify users of significant changes when appropriate.
        </p>

        <h2>Governing Law</h2>
        <p>
          These Terms are governed by the laws of the European Union and
          applicable local regulations.
        </p>

        <h2>Severability</h2>
        <p>
          If any provision of these Terms is found invalid, the remaining
          provisions remain in effect.
        </p>

        <h2>Contact</h2>
        <p>For any questions regarding these Terms, please contact us.</p>
      </DocumentLayout>
    </>
  );
}
