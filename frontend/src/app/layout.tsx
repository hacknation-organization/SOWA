import type { Metadata } from "next";
import "./fonts";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  // Pages set a short name ("Nowa ocena") and the tab reads "Nowa ocena · SOWA".
  title: { default: "SOWA — System Oceny, Wsparcia i Analizy", template: "%s · SOWA" },
  description: "Wsparcie przełożonych w ocenie pracowników służby cywilnej",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-card focus:p-2"
        >
          Przejdź do treści
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
