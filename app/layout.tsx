import type { Metadata, Viewport } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "MonetizeMind Automations — KWelchVisuals",
  description:
    "Build and sell custom business automations: AI needs analysis per client, a visual automation builder, live simulation, and a client-ready business plan for every automation.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
