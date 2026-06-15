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
        ink: "#17211b",
        moss: "#285840",
        fog: "#f3f6f2",
        line: "#dce5dc",
        signal: "#e6a640",
        clay: "#b85c43",
        steel: "#3f6f8f",
        mint: "#dcefe4"
      },
      boxShadow: {
        soft: "0 14px 40px rgba(23, 33, 27, 0.08)",
        lift: "0 18px 50px rgba(23, 33, 27, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
