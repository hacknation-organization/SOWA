// Fonts are self-hosted from Fontsource packages instead of next/font/google, so the build
// never downloads from Google Fonts (that download breaks builds on Netlify).
// Each stylesheet declares all subsets with unicode-range; browsers fetch only what a page uses.
// Font family names are mapped to --font-kk-* variables in globals.css.
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/500.css";
// Brand typeface: the "SOWA" wordmark (700) and page titles (600).
import "@fontsource-variable/montserrat";
