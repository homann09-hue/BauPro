import type { Config } from "tailwindcss";

const colorVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: colorVar("--color-ink"),
        moss: colorVar("--color-moss"),
        fog: colorVar("--color-fog"),
        line: colorVar("--color-line"),
        signal: colorVar("--color-signal"),
        clay: colorVar("--color-clay"),
        steel: colorVar("--color-steel"),
        mint: colorVar("--color-mint"),
        primary: colorVar("--color-primary"),
        "primary-dark": colorVar("--color-primary-dark"),
        anthracite: colorVar("--color-anthracite"),
        warning: colorVar("--color-warning"),
        danger: colorVar("--color-danger"),
        info: colorVar("--color-info"),
        surface: colorVar("--color-surface"),
        cream: colorVar("--color-cream"),
        ash: colorVar("--color-ash"),
        ember: colorVar("--color-ember"),
        coal: colorVar("--color-coal"),
        basalt: colorVar("--color-basalt"),
        ocher: colorVar("--color-ocher"),
        "surface-container": colorVar("--color-surface-container"),
        "surface-container-high": colorVar("--color-surface-container-high"),
        "industrial-dark": colorVar("--color-industrial-dark"),
        "industrial-panel": colorVar("--color-industrial-panel")
      },
      boxShadow: {
        soft: "var(--bp-shadow-soft)",
        lift: "var(--bp-shadow-lift)"
      }
    }
  },
  plugins: []
};

export default config;
