// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import next from "@next/eslint-plugin-next";
import globals from "globals";

/**
 * One lint config for the whole monorepo. TypeScript's recommended rules
 * everywhere, React hooks and accessibility rules for the components,
 * Next.js rules for the dashboard. Formatting is left to the editor.
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**", "**/.next/**", "**/.next-*/**", "**/dist/**", "output/**", "test-results/**", "playwright-report/**",
      "packages/db/migrations/**", "**/next-env.d.ts", "**/.wrangler/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports", disallowTypeAnnotations: false }],
      "no-console": ["error", { allow: ["info", "warn", "error"] }],
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
  {
    files: ["**/*.tsx"],
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // The compiler-era rules flag deliberate patterns (syncing props into state after a server action).
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": next },
    rules: { ...next.configs.recommended.rules, ...next.configs["core-web-vitals"].rules },
    settings: { next: { rootDir: "apps/web" } },
  },
  {
    // CLIs and scripts print to the terminal on purpose.
    files: ["scripts/**", "jobs/pipeline/src/cli.ts", "packages/db/src/seed.ts", "e2e/**"],
    rules: { "no-console": "off" },
  },
);
