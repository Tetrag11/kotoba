import type { Metadata, Viewport } from "next";
import "@fontsource/klee-one/400.css";
import "@fontsource/klee-one/600.css";
import "@fontsource/zen-kaku-gothic-new/latin-400.css";
import "@fontsource/zen-kaku-gothic-new/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kotoba",
  description: "Practise JLPT N5 vocabulary by typing what each word means.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f8f1" },
    { media: "(prefers-color-scheme: dark)", color: "#1c2b25" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
