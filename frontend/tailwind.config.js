// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cinematic dark forensic — warmer than pure black, oxidized-copper accent.
        bg: "#0a0908",
        panel: "#121110",
        elev: "#1a1816",
        ink: "#f2eee2",
        muted: "#8a8578",
        faint: "#524d43",
        hair: "rgba(242,238,226,0.08)",
        copper: "#c96f34",
        amber: "#e6a352",
        sage: "#7c9070",
        rose: "#c56c67",
      },
      fontFamily: {
        display: ['"Instrument Serif"', "ui-serif", "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -8px rgba(201, 111, 52, 0.45)",
        inset: "0 1px 0 0 rgba(242, 238, 226, 0.04) inset",
      },
      keyframes: {
        "fire-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(230, 163, 82, 0.55)" },
          "70%": { boxShadow: "0 0 0 14px rgba(230, 163, 82, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(230, 163, 82, 0)" },
        },
      },
      animation: { "fire-pulse": "fire-pulse 1.4s ease-out" },
    },
  },
  plugins: [],
};
