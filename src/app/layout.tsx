import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardian Oasis | Elder-First Care & Medication Management",
  description:
    "Everything you need for clearer, calmer caregiving through one easy-to-use, intelligent dashboard. Powered by CareLoop accountable escalation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#f6f9f7] text-[#1c2e27] antialiased selection:bg-emerald-200 selection:text-emerald-950">
        {children}
      </body>
    </html>
  );
}
