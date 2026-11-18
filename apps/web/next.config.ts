import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@reportpilot/core", "@reportpilot/demo", "@reportpilot/charts", "@reportpilot/report"],
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        // Client report links must never appear in search results.
        source: "/r/:token*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default config;
