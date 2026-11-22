import { IBM_Plex_Mono, IBM_Plex_Sans, Montserrat } from "next/font/google";

export const fontSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-kk-sans",
  display: "swap",
});

export const fontMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["500"],
  variable: "--font-kk-mono",
  display: "swap",
});

// Brand typeface: the "SOWA" wordmark (700) and page titles (600).
export const fontBrand = Montserrat({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-kk-brand",
  display: "swap",
});
