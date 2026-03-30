import { AnimatedSectionTitle } from "../../components/animated-section-title";
import { DocumentLayout } from "../layout";

export default function Page() {
  return (
    <>
      <AnimatedSectionTitle className="text-black">
        Data Subprocessors
      </AnimatedSectionTitle>

      <DocumentLayout>
        <h1>Data Subprocessors</h1>

        <h2>Summary</h2>
        <p>
          Below is the list of data subprocessors used by HumanLogs to deliver
          its services.
        </p>
        <p>This list was last updated on March 30, 2026.</p>
        <p>
          If you have any questions or comments regarding data subprocessors,
          please <a href="/contact">contact us</a>.
        </p>

        <h2>First Tier Subprocessors</h2>
        <p>
          These are the companies that HumanLogs directly uses to process data
          in order to provide the service. They are contractually bound to
          HumanLogs and operate under strict data protection and security
          requirements.
        </p>

        <ul>
          <li>
            <strong>AWS (Amazon Web Services) – Europe</strong>
            <br />
            Used for hosting infrastructure and data processing.
            <br />
            All data is processed and stored within European data centers.
            <br />
          </li>

          <li>
            <strong>ElevenLabs – Europe</strong>
            <br />
            Used for audio processing and transcription services.
            <br />
            HumanLogs operates in Zero Retention Mode with ElevenLabs, meaning
            no data is stored after processing.
            <br />
            All processing is performed within European infrastructure.
            <br />
          </li>

          <li>
            <strong>OVH – Europe</strong>
            <br />
            Used for email infrastructure when users contact HumanLogs.
            <br />
            OVH processes email communications and may have access to sender
            email addresses and message content.
          </li>
        </ul>

        <h2>Second Tier Subprocessors</h2>
        <p>
          At this time, HumanLogs does not rely on additional second tier
          subprocessors for the delivery of its core services.
        </p>
      </DocumentLayout>
    </>
  );
}
