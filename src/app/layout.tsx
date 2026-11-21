import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { AppearanceLoader } from "@/components/settings/AppearanceLoader";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ask the Author",
  description:
    "Chat with an AI simulation in the author's voice, grounded in the book's actual passages with chapter citations and spoiler protection.",
};

export const viewport: Viewport = {
  themeColor: "#f6f1e7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="min-h-svh text-ink antialiased">
        <AppearanceLoader />
        {children}
      </body>
    </html>
  );
}
