/**
 * Share tokens for the sample reports. Derived from the site and month so
 * the landing page's sample link stays stable across deploys; real reports
 * use crypto.randomBytes(16). Always 32 lowercase hex characters, the same
 * shape as a real token.
 */
export function shareTokenFor(siteId: string, period: string, salt = ""): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const ch of `${siteId}:${period}:${salt}`) {
    h1 = Math.imul(h1 ^ ch.charCodeAt(0), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ ch.charCodeAt(0), 2246822519) >>> 0;
  }
  // Bitwise results are signed 32-bit in JavaScript; >>> 0 keeps every part positive, so no "-" ever appears.
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `${hex(h1)}${hex(h2)}${hex(h1 ^ 0x5bd1e995)}${hex(h2 + 0x9e3779b9)}`;
}
