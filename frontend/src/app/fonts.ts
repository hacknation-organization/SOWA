import { IBM_Plex_Mono, Lato } from "next/font/google";

// Lato on Google Fonts has no 500 weight, so the design's "Medium" renders as 400.
export const fontSans = Lato({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700", "900"],
  variable: "--font-kk-sans",
  display: "swap",
});

export const fontMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-kk-mono",
  display: "swap",
});
