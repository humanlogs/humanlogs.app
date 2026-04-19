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

        <p>Last updated: April 19, 2026</p>

        <p>
          This Cookie Policy explains what cookies are, how we use them, and how
          you can manage your cookie preferences.
        </p>

        <h2>What Are Cookies?</h2>
        <p>
          Cookies are small text files that are stored on your device when you
          visit a website. They help the website remember your preferences and
          improve your experience.
        </p>

        <h2>Cookies We Use</h2>

        <h3>1. Strictly Necessary Cookies</h3>
        <p>
          These cookies are essential for the website to function properly. We
          use an authentication cookie that is created only after you log in to
          your account.
        </p>
        <p>This cookie is required to:</p>
        <ul>
          <li>Maintain your authenticated session</li>
          <li>Allow secure access to your account</li>
        </ul>
        <p>
          This cookie does not track you and is not used for any purpose other
          than keeping you logged in.
        </p>
        <p>
          <strong>Legal basis:</strong> Under applicable data protection laws
          (including GDPR), strictly necessary cookies do not require user
          consent.
        </p>

        <h3>2. Analytics Cookies (Optional)</h3>
        <p>
          With your consent, we use Google Analytics to understand how visitors
          interact with our website. These cookies help us:
        </p>
        <ul>
          <li>Analyze traffic and usage patterns</li>
          <li>Improve website performance and user experience</li>
          <li>Understand which pages are most popular</li>
        </ul>
        <p>
          Google Analytics may set the following cookies:
        </p>
        <ul>
          <li>
            <strong>_ga:</strong> Used to distinguish users (expires after 2
            years)
          </li>
          <li>
            <strong>_ga_*:</strong> Used to persist session state (expires after
            2 years)
          </li>
        </ul>
        <p>
          <strong>Legal basis:</strong> These cookies are set only after you
          provide your explicit consent through our cookie banner.
        </p>
        <p>
          For more information about how Google uses data, please visit:{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Privacy Policy
          </a>
        </p>

        <h2>No Advertising or Tracking Cookies</h2>
        <p>We do not use cookies to:</p>
        <ul>
          <li>Track your browsing behavior across other websites</li>
          <li>Serve personalized advertisements</li>
          <li>Share your data with third-party advertisers</li>
        </ul>

        <h2>Managing Your Cookie Preferences</h2>
        <p>
          When you first visit our website, you will see a cookie consent
          banner. You can choose to:
        </p>
        <ul>
          <li>
            <strong>Accept:</strong> Allow all cookies, including analytics
          </li>
          <li>
            <strong>Decline:</strong> Only use strictly necessary cookies
          </li>
        </ul>
        <p>
          You can also manage cookies through your browser settings. However,
          please note that disabling the authentication cookie will prevent you
          from logging into your account.
        </p>
        <p>
          To change your cookie preferences after making your initial choice,
          you can clear your browser cookies and revisit the website, or adjust
          your browser settings.
        </p>

        <h2>Updates to This Policy</h2>
        <p>
          We may update this Cookie Policy from time to time. The "Last
          updated" date at the top of this page indicates when the policy was
          last revised.
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
