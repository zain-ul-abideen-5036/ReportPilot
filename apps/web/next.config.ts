import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Lets a production build live beside a running dev server without the
  // two overwriting each other's output: NEXT_DIST_DIR=.next-prod npm run build
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@reportpilot/core", "@reportpilot/demo", "@reportpilot/charts", "@reportpilot/report"],
  poweredByHeader: false,
  devIndicators: false,
  // Playwright ships a browser binary; keep it out of the server bundle.
  serverExternalPackages: ["playwright", "playwright-core"],
  experimental: {
    // Import only the icons each page uses instead of the whole barrel
    // (about 12,000 modules), which cuts dev compile time from ~25 s to ~2 s.
    optimizePackageImports: ["@phosphor-icons/react"],
  },
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
