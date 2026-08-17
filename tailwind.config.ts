import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg0: "#0E0F12", bg1: "#16181D", bg2: "#1D2027",
        card: "#20232A", linha: "#2C303A",
        ouro: "#C7A25C", ouroClaro: "#E7D6AE",
        ink: "#F3F0E9", inkDim: "#A6A9B2", inkFaint: "#6E7280",
        zap: "#1E8E4A", verde: "#5B8A69",
      },
      fontFamily: {
        display: ["var(--fonte-display)", "sans-serif"],
        sans: ["var(--fonte-corpo)", "sans-serif"],
        mono: ["var(--fonte-mono)", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
