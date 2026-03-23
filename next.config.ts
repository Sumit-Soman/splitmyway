import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Playwright (and some tooling) uses 127.0.0.1; without this, dev/HMR can break and the client bundle may not hydrate. */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
