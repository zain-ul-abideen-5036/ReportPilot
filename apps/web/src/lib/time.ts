import { DEMO_NOW } from "@reportpilot/demo";

/** The demo's sample data is frozen at DEMO_NOW; a real deployment uses the real clock. */
const clock = () => (process.env.DATABASE_URL ? new Date() : DEMO_NOW);

/** "4 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(iso: string, from: Date = clock()): string {
  const minutes = Math.round((from.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}
