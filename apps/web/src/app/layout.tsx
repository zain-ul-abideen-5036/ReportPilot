import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: { default: "ReportPilot", template: "%s · ReportPilot" },
  description:
    "Monthly client reports for web agencies: search, speed and uptime, written in plain English and sent as a branded PDF after approval.",
  applicationName: "ReportPilot",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "ReportPilot",
    description: "Monthly client reports, produced automatically and approved in minutes.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { color: "#f6f2ea" },
  ],
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${hanken.variable} ${geistMono.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
