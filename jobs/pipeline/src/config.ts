import { z } from "zod";

/**
 * Environment for the scheduled jobs, validated once at start-up. A typo
 * in a secret name fails the run in the first second with a clear
 * message instead of halfway through 40 reports.
 */

const optional = z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined));

export const JobEnv = z.object({
  DATABASE_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  GOOGLE_SERVICE_ACCOUNT_JSON: optional,
  PAGESPEED_API_KEY: optional,
  GEMINI_API_KEY: optional,
  RESEND_API_KEY: optional.refine((v) => v === undefined || v.startsWith("re_"), "RESEND_API_KEY should start with re_"),
  ALERT_FROM: z.string().default("ReportPilot alerts <alerts@reportpilot.app>"),
  ALERT_TO: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  R2_ACCOUNT_ID: optional,
  R2_BUCKET: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  HEALTHCHECK_MONTHLY_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  HEALTHCHECK_DAILY_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  SENTRY_DSN: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  APP_URL: z.string().url().default("http://localhost:3000"),
}).superRefine((env, ctx) => {
  const r2 = [env.R2_ACCOUNT_ID, env.R2_BUCKET, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY];
  if (r2.some(Boolean) && !r2.every(Boolean)) {
    ctx.addIssue({ code: "custom", path: ["R2_BUCKET"], message: "Set all four R2_* variables, or none of them" });
  }
});

export type JobEnv = z.infer<typeof JobEnv>;

export function loadEnv(source: Record<string, string | undefined> = process.env): JobEnv {
  const parsed = JobEnv.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".") || "env"}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

/** Production runs need a database and the service account; say which is missing. */
export function requireProduction(env: JobEnv): asserts env is JobEnv & { DATABASE_URL: string; GOOGLE_SERVICE_ACCOUNT_JSON: string } {
  const missing = (["DATABASE_URL", "GOOGLE_SERVICE_ACCOUNT_JSON"] as const).filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing ${missing.join(" and ")}. Add them as repository secrets, or run with --demo.`);
}
