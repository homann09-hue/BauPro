import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#F0EBE0",
        moss: "#D4580A",
        fog: "#111110",
        line: "#2E2E2B",
        signal: "#D4580A",
        clay: "#DC2626",
        steel: "#7C8EA4",
        mint: "#1E1E1C",
        primary: "#D4580A",
        "primary-dark": "#B8490A",
        anthracite: "#111110",
        warning: "#D4580A",
        danger: "#DC2626",
        info: "#7C8EA4",
        surface: "#1A1918",
        cream: "#F0EBE0",
        ash: "#9A9589",
        ember: "#D4580A",
        coal: "#111110",
        basalt: "#1A1918"
      },
      boxShadow: {
        soft: "0 14px 34px rgba(0, 0, 0, 0.28)",
        lift: "0 22px 60px rgba(0, 0, 0, 0.42)"
      }
    }
  },
  plugins: []
};

export default config;
