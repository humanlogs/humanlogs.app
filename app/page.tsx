import LandingPage from "./(landing)/[locale]/page";
import { Layout } from "./(landing)/_layout";

export default function RootPage(props: any) {
  // Middleware will handle the redirect, but this is a fallback
  return (
    <Layout>
      <LandingPage {...props} />
    </Layout>
  );
}
