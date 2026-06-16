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
        ink: "#1F2937",
        moss: "#2E7D32",
        fog: "#F8FAFC",
        line: "#E2E8F0",
        signal: "#F59E0B",
        clay: "#DC2626",
        steel: "#2563EB",
        mint: "#E8F5E9",
        primary: "#2E7D32",
        "primary-dark": "#1B5E20",
        anthracite: "#1F2937",
        warning: "#F59E0B",
        danger: "#DC2626",
        info: "#2563EB",
        surface: "#FFFFFF"
      },
      boxShadow: {
        soft: "0 12px 28px rgba(31, 41, 55, 0.08)",
        lift: "0 18px 46px rgba(31, 41, 55, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
