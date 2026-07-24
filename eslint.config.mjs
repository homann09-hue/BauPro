import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "next-env.d.ts",
      "playwright-report/**",
      "public/sw.js",
      "public/workbox-*.js",
      "public/fallback-*.js",
      "test-results/**"
    ]
  }
];

export default eslintConfig;
