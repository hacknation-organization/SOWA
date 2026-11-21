// Jedno miejsce ładowania krojów. Aby podmienić krój, zmień import poniżej –
// nazwy zmiennych CSS (--font-kk-sans, --font-kk-mono) zostają bez zmian.
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

export const fontSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-kk-sans",
  display: "swap",
});

export const fontMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-kk-mono",
  display: "swap",
});
