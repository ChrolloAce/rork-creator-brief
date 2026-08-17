import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rork Creator Brief — formats, hooks, examples",
  description:
    "The UGC playbook for Rork creators. Video formats, proven hooks, and reference examples for shipping content that actually hits.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      {/* Browser extensions (ColorZilla adds cz-shortcut-listen, Grammarly adds
          data-gr-* ) inject attributes onto <body> before React hydrates, which
          React reports as a hydration mismatch even though nothing in our tree
          differs. Suppressing here covers the body element's own attributes
          only — children still hydrate normally and real mismatches inside the
          app are still reported. */}
      <body className="min-h-full flex flex-col bg-background text-ink" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
