"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/** Last-resort error page for errors in the root layout itself. Reported to Sentry when configured. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f2ea", color: "#17201c", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: "#434c46" }}>The error has been recorded. Nothing you changed was lost.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, border: 0, background: "#1d4a3c", color: "#fff", fontWeight: 600 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
