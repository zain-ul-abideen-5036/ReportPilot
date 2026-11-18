import { connect } from "node:tls";

/**
 * Certificate expiry and issuer, read straight from the TLS handshake.
 * Used by the weekly snapshot job (Node). The uptime Worker cannot open
 * raw TLS sockets, so it relies on this job's result.
 */
export interface CertInfo {
  expiresAt: string;
  issuer: string | null;
}

export function certificateInfo(url: string, timeoutMs = 10_000): Promise<CertInfo> {
  const { hostname, port } = new URL(url);
  return new Promise((resolve, reject) => {
    const socket = connect({ host: hostname, port: Number(port) || 443, servername: hostname, timeout: timeoutMs }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert?.valid_to) return reject(new Error(`No certificate presented by ${hostname}`));
      const issuer = cert.issuer ? (cert.issuer.O ?? cert.issuer.CN ?? null) : null;
      resolve({ expiresAt: new Date(cert.valid_to).toISOString(), issuer: Array.isArray(issuer) ? issuer[0] ?? null : issuer });
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`TLS handshake with ${hostname} timed out`));
    });
    socket.on("error", reject);
  });
}
