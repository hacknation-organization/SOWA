import type { Metadata } from "next";
import { fontMono, fontSans } from "./fonts";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kompas kompetencji",
  description: "Wsparcie przełożonych w ocenie pracowników służby cywilnej",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-card focus:p-2"
        >
          Przejdź do treści
        </a>
        <div className="kk-desktop-only">
          <AuthProvider>{children}</AuthProvider>
        </div>
        <div
          className="kk-narrow-notice min-h-screen items-center justify-center p-8 text-center"
          role="alert"
        >
          <div className="max-w-md">
            <h1 className="mb-2 text-xl font-semibold">Aplikacja przeznaczona na komputer</h1>
            <p className="text-muted-foreground">
              Kompas kompetencji działa w przeglądarce na komputerze stacjonarnym lub laptopie
              (szerokość okna co najmniej 1024 px). Otwórz go na komputerze albo poszerz okno.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
