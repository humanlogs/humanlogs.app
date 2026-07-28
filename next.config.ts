import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/utils/i18n.ts");

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_AUTH_MODE: process.env.AUTH_MODE || "auth0",
  },
  experimental: {
    proxyClientMaxBodySize: "300mb",
    serverActions: {
      bodySizeLimit: "300mb",
    },
  },
  // `/resources` used to publish the repo's own `docs/` folder (setup guides
  // written for developers). Product documentation now lives at `/docs`; these
  // keep the old URLs alive and point them at their successor page. Both the
  // bare and the locale-prefixed forms were indexed, hence each pair.
  async redirects() {
    const moved: Array<[string, string]> = [
      ["", "/docs"],
      ["/AUTH_SETUP", "/docs/self-hosting/configure"],
      ["/LDAP_SETUP", "/docs/self-hosting/configure"],
      ["/TESTING", "/docs/self-hosting/install"],
      ["/:path*", "/docs/self-hosting/install"],
    ];

    return moved.flatMap(([suffix, destination]) => [
      { source: `/resources${suffix}`, destination, permanent: true },
      {
        source: `/:locale(en|fr|es|de)/resources${suffix}`,
        destination,
        permanent: true,
      },
    ]);
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "s.gravatar.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
