import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Playwright (and some tooling) uses 127.0.0.1; without this, dev/HMR can break and the client bundle may not hydrate. */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    serverActions: {
      /** Multipart overhead; avatar 2 MB; expense attachments up to 15 MB. */
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
