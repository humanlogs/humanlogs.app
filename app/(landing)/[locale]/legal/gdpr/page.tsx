import { AnimatedSectionTitle } from "../../components/animated-section-title";
import { DocumentLayout } from "../layout";

export default function Page() {
  return (
    <>
      <AnimatedSectionTitle className="text-black">
        GDPR Compliance
      </AnimatedSectionTitle>

      <DocumentLayout>
        <h1>GDPR Compliance</h1>
        <p>
          <strong>Last updated:</strong> April 27, 2026
        </p>

        <h2>Summary</h2>
        <p>
          HumanLogs is fully committed to complying with the General Data
          Protection Regulation (GDPR). This document explains how we process
          your personal data, your rights under GDPR, and how you can exercise
          them.
        </p>

        <h2>Data Controller</h2>
        <p>
          HumanLogs is the data controller responsible for the processing of
          your personal data. For any questions or requests related to your
          personal data, please <a href="/contact">contact us</a>.
        </p>

        <h2>Legal Basis for Processing</h2>
        <p>
          We process your personal data based on the following legal grounds:
        </p>
        <ul>
          <li>
            <strong>Contractual necessity:</strong> Processing is necessary to
            provide the transcription service you have requested.
          </li>
          <li>
            <strong>Legitimate interests:</strong> We process certain data to
            improve service security, prevent fraud, and ensure proper system
            functionality.
          </li>
          <li>
            <strong>Consent:</strong> For optional features or communications,
            we obtain your explicit consent before processing.
          </li>
          <li>
            <strong>Legal obligations:</strong> In some cases, we process data
            to comply with legal requirements.
          </li>
        </ul>

        <h2>Personal Data We Process</h2>

        <h3>Account Data</h3>
        <ul>
          <li>Email address</li>
          <li>
            Authentication credentials (processed by{" "}
            <a
              href="https://auth0.com/docs/secure/data-privacy-and-compliance/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Auth0 Europe
            </a>
            )
          </li>
          <li>Account preferences and settings</li>
        </ul>

        <h3>Usage Data</h3>
        <ul>
          <li>Technical information (browser type, access times)</li>
          <li>Service usage statistics</li>
          <li>Request logs for security and functionality purposes</li>
          <li>
            Analytics data (collected via Google Analytics with your consent)
          </li>
        </ul>

        <h3>Content Data</h3>
        <ul>
          <li>
            Uploaded audio files (end-to-end encrypted, processed only for
            transcription)
          </li>
          <li>Generated transcriptions (end-to-end encrypted)</li>
          <li>Study data and metadata (when you choose to store content)</li>
        </ul>

        <h3>Communication Data</h3>
        <ul>
          <li>Email correspondence when you contact us</li>
          <li>Feedback and support requests</li>
        </ul>

        <h2>Your Rights Under GDPR</h2>

        <h3>Right of Access (Article 15)</h3>
        <p>
          You have the right to obtain confirmation as to whether we process
          your personal data and to access that data. You can download all your
          data at any time directly from your account interface in a portable
          format.
        </p>

        <h3>Right to Rectification (Article 16)</h3>
        <p>
          You have the right to correct inaccurate or incomplete personal data.
          You can update your account information directly from your account
          settings.
        </p>

        <h3>Right to Erasure / "Right to be Forgotten" (Article 17)</h3>
        <p>
          You have the right to request deletion of your personal data. You can
          permanently delete all your data at any time directly from your
          account interface without needing to contact us.
        </p>

        <h3>Right to Restriction of Processing (Article 18)</h3>
        <p>
          You have the right to request restriction of processing in certain
          circumstances. Please contact us to exercise this right.
        </p>

        <h3>Right to Data Portability (Article 20)</h3>
        <p>
          You have the right to receive your personal data in a structured,
          commonly used, and machine-readable format. You can download all your
          data at any time from your account interface.
        </p>

        <h3>Right to Object (Article 21)</h3>
        <p>
          You have the right to object to processing based on legitimate
          interests. Please contact us to exercise this right.
        </p>

        <h3>Right to Withdraw Consent (Article 7)</h3>
        <p>
          Where processing is based on consent, you have the right to withdraw
          that consent at any time. Withdrawal does not affect the lawfulness of
          processing before withdrawal.
        </p>

        <h3>Right to Lodge a Complaint (Article 77)</h3>
        <p>
          You have the right to lodge a complaint with your local supervisory
          authority if you believe your data protection rights have been
          violated.
        </p>

        <h2>Data Retention</h2>
        <p>We retain personal data only as long as necessary:</p>
        <ul>
          <li>
            <strong>Uploaded unencrypted files:</strong> Immediately deleted
            after processing unless you explicitly choose to store them in your
            account.
          </li>
          <li>
            <strong>Account data:</strong> Retained while your account is active
            and deleted upon account deletion.
          </li>
          <li>
            <strong>Technical logs:</strong> Retained for security purposes for
            a limited period (typically 90 days).
          </li>
          <li>
            <strong>Billing records:</strong> Retained as required by applicable
            tax and accounting regulations.
          </li>
        </ul>

        <h2>Data Security Measures</h2>
        <p>We implement comprehensive security measures including:</p>
        <ul>
          <li>End-to-end encryption for all files and transcriptions</li>
          <li>
            Secure authentication through{" "}
            <a
              href="https://auth0.com/docs/secure/data-privacy-and-compliance/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Auth0 Europe
            </a>
          </li>
          <li>
            Data processing and storage exclusively within the European Union
          </li>
          <li>Regular security audits and updates</li>
          <li>Access controls and encryption at rest and in transit</li>
          <li>
            Secure infrastructure providers with GDPR compliance guarantees
          </li>
        </ul>

        <h2>International Data Transfers</h2>
        <p>
          The majority of data processing and storage occurs within the European
          Union through AWS Europe. By default, audio transcription services are
          provided by Gladia on European servers with no-training and
          no-retention mode, ensuring your data is processed exclusively in the
          EU and immediately deleted after transcription is complete.
        </p>
        <p>
          Alternatively, ElevenLabs transcription services may involve data
          transfers outside the EU/EEA, as ElevenLabs operates globally.
          However, audio data is immediately deleted after transcription is
          complete. For Enterprise plans, we offer ElevenLabs "Zero Retention
          Mode" and EU data residency options.
        </p>
        <p>
          All international data transfers are conducted in compliance with GDPR
          requirements, including appropriate safeguards such as Standard
          Contractual Clauses (SCCs) where applicable. Our subprocessors are
          carefully selected to ensure GDPR compliance. For details, see our{" "}
          <a href="/legal/subprocessors">Data Subprocessors</a> page.
        </p>

        <h2>Data Processing by Third Parties</h2>
        <p>
          We work with carefully selected subprocessors to deliver our services.
          All subprocessors are contractually bound to GDPR compliance
          requirements. For a complete list, see our{" "}
          <a href="/legal/subprocessors">Data Subprocessors</a> page.
        </p>

        <h3>Key Subprocessors</h3>
        <ul>
          <li>
            <strong>AWS Europe:</strong> Infrastructure and data storage (EU
            data centers only)
          </li>
          <li>
            <strong>ElevenLabs:</strong> Audio transcription (data immediately
            deleted after processing)
          </li>
          <li>
            <strong>
              <a
                href="https://auth0.com/docs/secure/data-privacy-and-compliance/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Auth0 Europe
              </a>
              :
            </strong>{" "}
            Authentication and identity management
          </li>
          <li>
            <strong>OVH Europe:</strong> Email infrastructure
          </li>
          <li>
            <strong>Stripe:</strong> Payment processing and billing management
          </li>
          <li>
            <strong>Google Analytics:</strong> Website analytics (only with your
            explicit consent)
          </li>
        </ul>

        <h2>Data Protection by Design and Default</h2>
        <p>Privacy is integrated into our service design:</p>
        <ul>
          <li>
            <strong>Minimal data collection:</strong> We only collect data
            necessary to provide the service
          </li>
          <li>
            <strong>End-to-end encryption:</strong> Your files are encrypted by
            default and we cannot access their content
          </li>
          <li>
            <strong>No AI training:</strong> Your data is never used to train AI
            models
          </li>
          <li>
            <strong>Limited analytics:</strong> We use Google Analytics with
            your explicit consent to improve our service. We do not track your
            activity across other websites or use advertising cookies. You can
            opt out at any time. See our{" "}
            <a href="/legal/cookies">Cookie Policy</a> for details.
          </li>
          <li>
            <strong>User control:</strong> You have full control over your data
            through your account interface
          </li>
        </ul>

        <h2>Automated Decision-Making and Profiling</h2>
        <p>
          We do not use your personal data for automated decision-making or
          profiling as defined under Article 22 of the GDPR.
        </p>

        <h2>Children's Privacy</h2>
        <p>
          Our service is not intended for individuals under 18 years of age. We
          do not knowingly collect personal data from children. If we become
          aware that we have collected data from a child, we will take steps to
          delete that information promptly.
        </p>

        <h2>Data Breach Notification</h2>
        <p>
          In the event of a data breach that is likely to result in a risk to
          your rights and freedoms, we will notify you and the relevant
          supervisory authority within 72 hours as required by GDPR Article 33.
        </p>

        <h2>Updates to GDPR Compliance</h2>
        <p>
          We may update this document to reflect changes in our practices or
          legal requirements. Significant changes will be communicated to users
          in advance.
        </p>

        <h2>Contact and Data Protection Officer</h2>
        <p>
          For any questions, requests, or concerns regarding your personal data
          or GDPR compliance, please <a href="/contact">contact us</a>.
        </p>
        <p>
          To exercise your rights or for privacy-related inquiries, you may also
          contact our Data Protection Officer at the same address.
        </p>

        <h2>Supervisory Authority</h2>
        <p>
          If you believe your data protection rights have been violated, you
          have the right to lodge a complaint with your local data protection
          supervisory authority. For EU residents, you can find your local
          authority at:{" "}
          <a
            href="https://edpb.europa.eu/about-edpb/board/members_en"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://edpb.europa.eu/about-edpb/board/members_en
          </a>
        </p>
      </DocumentLayout>
    </>
  );
}
