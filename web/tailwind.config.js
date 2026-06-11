/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#05070a",
          850: "#080b11",
          800: "#0b0f16",
          750: "#0e131c",
          700: "#121826",
          600: "#1a2233",
        },
        pitch: {
          DEFAULT: "#2be07a",
          dim: "#1fa85b",
          glow: "#5cffa6",
          deep: "#0b3d23",
        },
        signal: {
          info: "#46d6ff",
          warn: "#ffb023",
          crit: "#ff4d5e",
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 60px -30px rgba(0,0,0,0.9)",
        pitch: "0 0 0 1px rgba(43,224,122,0.25), 0 0 40px -8px rgba(43,224,122,0.35)",
        crit: "0 0 0 1px rgba(255,77,94,0.3), 0 0 50px -10px rgba(255,77,94,0.45)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(43,224,122,0.45)" },
          "70%": { boxShadow: "0 0 0 10px rgba(43,224,122,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(43,224,122,0)" },
        },
        "pulse-crit": {
          "0%": { boxShadow: "0 0 0 0 rgba(255,77,94,0.5)" },
          "70%": { boxShadow: "0 0 0 12px rgba(255,77,94,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255,77,94,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "scan": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(400%)" },
        },
        "draw": {
          "0%": { strokeDashoffset: "1" },
          "100%": { strokeDashoffset: "0" },
        },
        "stamp-in": {
          "0%": { opacity: "0", transform: "scale(1.8) rotate(-14deg)" },
          "60%": { opacity: "1", transform: "scale(0.92) rotate(-9deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(-10deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "slide-in": "slide-in 0.4s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-ring": "pulse-ring 2s infinite",
        "pulse-crit": "pulse-crit 1.6s infinite",
        shimmer: "shimmer 2.5s linear infinite",
        scan: "scan 4s linear infinite",
        "stamp-in": "stamp-in 0.6s cubic-bezier(0.34,1.56,0.64,1) both",
      },
    },
  },
  plugins: [],
};
