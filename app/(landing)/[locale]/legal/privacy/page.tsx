import { AnimatedSectionTitle } from "../../components/animated-section-title";
import { DocumentLayout } from "../layout";

export default function Page() {
  return (
    <>
      <AnimatedSectionTitle className="text-black">
        Privacy Policy
      </AnimatedSectionTitle>

      <DocumentLayout>
        <h1>Privacy Policy</h1>
        <p>
          <strong>Last updated:</strong> March 31, 2026
        </p>

        <h2>Summary</h2>
        <p>
          We only collect the minimum personal data required to provide our
          service. Your files are end-to-end encrypted and never used to train
          AI models. We do not sell or share your data with third parties. All
          data is processed and stored within the European Union.
        </p>

        <h2>Our Approach to Privacy</h2>
        <p>
          Privacy is at the core of our service. We understand that you may
          upload sensitive content, and we treat this responsibility with the
          highest level of care. All files are encrypted end-to-end, meaning
          only you can access their content.
        </p>

        <h2>Information We Collect</h2>

        <h3>Website Visitors</h3>
        <p>
          We collect minimal technical information such as browser type, access
          times, and basic request data to ensure the proper functioning and
          security of our service.
        </p>

        <h3>Uploaded Files</h3>
        <p>
          When you upload a file, it is securely transmitted and processed on
          servers located in the European Union. Files are end-to-end encrypted
          and processed only to provide the requested service. We do not access,
          analyze, or use your files for any other purpose.
        </p>

        <h3>Account Information</h3>
        <p>
          If you create an account, we collect basic information such as your
          email address and authentication data. This information is securely
          stored within the European Union using our infrastructure partners.
        </p>

        <h2>What We Do Not Do</h2>
        <p>
          We do not sell, rent, or trade your personal data. We do not use your
          data to train artificial intelligence models. We do not track your
          activity across other websites.
        </p>

        <h2>Cookies</h2>
        <p>
          We do not use cookies for tracking or analytics. We only use essential
          session mechanisms required for authentication and service
          functionality. For more details, please refer to our dedicated cookies
          policy.
        </p>

        <h2>Data Storage and Processing</h2>
        <p>
          All data is processed and stored within the European Union. We rely on
          secure infrastructure providers to ensure data protection and
          availability.
        </p>

        <h2>Data Retention</h2>
        <p>
          We retain personal data only as long as necessary to provide the
          service. Uploaded files are not stored unless explicitly requested by
          you. You may request deletion of your data at any time.
        </p>

        <h2>Data Security</h2>
        <p>
          We implement strong security measures to protect your data from
          unauthorized access, alteration, or loss. However, no system is
          completely secure, and we encourage caution when handling highly
          sensitive data.
        </p>

        <h2>Legal Disclosure</h2>
        <p>
          We may disclose personal data if required by law. When possible, we
          will inform you before such disclosure unless legally prohibited.
        </p>

        <h2>Managing Your Personal Data</h2>
        <p>
          You have full control over your personal data directly from your
          account interface. You can download all your data at any time in a
          portable format. You can also permanently delete all your data at any
          time without needing to contact us.
        </p>

        <h2>Your Rights</h2>
        <p>
          You have the right to access, correct, or delete your personal data.
          You may contact us at any time to exercise these rights.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time. We will notify
          users of significant changes before they take effect.
        </p>

        <h2>Contact</h2>
        <p>
          If you have any questions regarding this privacy policy, please
          contact us.
        </p>
      </DocumentLayout>
    </>
  );
}
