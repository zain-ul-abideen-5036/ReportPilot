/**
 * The number check. Language models are good at phrasing and bad at
 * arithmetic, and a report that misquotes a client's own figures does
 * more damage than one that reads a little stiffly.
 *
 * Rule: every number in the AI text must appear in the source text the
 * model was given. If any does not, the AI text is discarded and the
 * template narrative is used instead.
 */

const NUMBER = /[-+−]?\d[\d,]*(?:\.\d+)?/g;

/** Normalise "12,400" / "+18.3" / "−4.0" to a canonical unsigned form. */
export function normaliseNumber(raw: string): string {
  const cleaned = raw.replace(/[,+\-−]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return cleaned;
  return String(n);
}

export function extractNumbers(text: string): string[] {
  return (text.match(NUMBER) ?? []).map(normaliseNumber);
}

export interface NumberCheckResult {
  ok: boolean;
  /** Numbers present in the candidate but absent from the source. */
  unexpected: string[];
}

export function checkNumbers(candidate: string, source: string): NumberCheckResult {
  const allowed = new Set(extractNumbers(source));
  const unexpected = [...new Set(extractNumbers(candidate))].filter((n) => !allowed.has(n));
  return { ok: unexpected.length === 0, unexpected };
}

/**
 * Choose between AI and template text. Also rejects empty output and text
 * that dropped more than half of the source figures, which usually means
 * the model summarised the substance away.
 */
export function acceptAiText(candidate: string | null | undefined, source: string): boolean {
  if (!candidate || candidate.trim().length < 40) return false;
  if (!checkNumbers(candidate, source).ok) return false;
  const sourceNumbers = new Set(extractNumbers(source));
  const kept = new Set(extractNumbers(candidate));
  if (sourceNumbers.size >= 4 && kept.size < sourceNumbers.size / 2) return false;
  return true;
}
