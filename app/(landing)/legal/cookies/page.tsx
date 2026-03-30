import { AnimatedSectionTitle } from "../../components/animated-section-title";
import { DocumentLayout } from "../layout";

export default function Page() {
  return (
    <>
      <AnimatedSectionTitle className="text-black">
        Cookie Policy
      </AnimatedSectionTitle>

      <DocumentLayout>
        <h1>Cookie Policy</h1>

        <p>Last updated: March 30, 2026</p>

        <p>
          This website does not use cookies for tracking, analytics,
          advertising, or any other non-essential purpose.
        </p>

        <h2>No Tracking Cookies</h2>
        <p>We do not use cookies or similar technologies to:</p>
        <ul>
          <li>Track your browsing behavior</li>
          <li>Analyze traffic or usage</li>
          <li>Serve advertisements</li>
          <li>Store personal preferences</li>
        </ul>

        <h2>Authentication Cookie</h2>
        <p>
          The only cookie used on this website is a strictly necessary
          authentication cookie.
        </p>
        <p>
          This cookie is created only after you log in to your account and is
          required to:
        </p>
        <ul>
          <li>Maintain your authenticated session</li>
          <li>Allow secure access to your account</li>
        </ul>
        <p>
          This cookie does not track you and is not used for any purpose other
          than keeping you logged in.
        </p>

        <h2>Legal Basis</h2>
        <p>
          Under applicable data protection laws (including GDPR), strictly
          necessary cookies do not require user consent.
        </p>

        <h2>Managing Cookies</h2>
        <p>
          You can configure your browser to block or delete cookies. However,
          disabling the authentication cookie will prevent you from logging into
          your account.
        </p>

        <h2>Contact</h2>
        <p>
          If you have any questions about this Cookie Policy, please contact us
          at:
          <br />
          <a href="mailto:legal@humanlogs.app">legal@humanlogs.app</a>
        </p>
      </DocumentLayout>
    </>
  );
}
