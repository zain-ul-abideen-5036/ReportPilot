import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "workers/*/test/**/*.test.ts", "jobs/*/test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**", "workers/*/src/**", "jobs/*/src/**", "packages/integrations/src/**"],
      reporter: ["text", "html"],
    },
  },
});
