import { acceptAiText, aiPrompt, templateNarrative, type Narrative, type ReportData } from "@reportpilot/core";
import type { Logger } from "../log";

/**
 * The narrative stage. Templates always produce the summary; when AI is
 * on for the client, a free-tier model may rewrite the opening paragraph
 * for flow. Only aggregated figures are sent, never contact details, and
 * the rewrite is discarded if it quotes any number that isn't in the source.
 */

export type Rewriter = (prompt: string) => Promise<string | null>;

export async function writeNarrative(report: ReportData, opts: { aiEnabled: boolean; rewrite?: Rewriter; log: Logger }): Promise<Narrative> {
  const base = templateNarrative(report);
  if (!opts.aiEnabled || !opts.rewrite) return base;
  const source = [base.summary, ...base.highlights].join(" ");
  try {
    const candidate = await opts.rewrite(aiPrompt(base));
    if (candidate && acceptAiText(candidate, source)) {
      return { ...base, summary: candidate.trim(), source: "ai" };
    }
    opts.log.info("AI text rejected by number check; using template");
  } catch (err) {
    opts.log.warn("AI rewrite failed; using template", { error: (err as Error).message });
  }
  return base;
}

/**
 * Gemini free tier via REST. Any model with a text endpoint works; the
 * number check is what makes the choice low-risk.
 */
export function geminiRewriter(apiKey: string, model = "gemini-2.0-flash", fetcher: typeof fetch = fetch): Rewriter {
  return async (prompt) => {
    const res = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Gemini: ${res.status}`);
    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? null;
  };
}
