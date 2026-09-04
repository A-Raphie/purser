import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans-loaded",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-data-loaded",
});

export const metadata: Metadata = {
  title: "Purser · manifest & ledger",
  description:
    "Control room for a treasurer agent whose judgment lives in Sibyl Memory.",
  openGraph: {
    title: "Purser · the treasurer that never forgets a decision",
    description:
      "An x402 treasurer agent on Base: it refuses what it already paid for, and it earns by selling verdicts.",
    url: "https://purser-production-ef37.up.railway.app",
    siteName: "Purser",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
