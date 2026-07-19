import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bridge the legacy shareable Next.js configs into ESLint v9 flat config.
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "android/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  // Keep parity with the project's original .eslintrc.json
  // ({ "extends": "next/core-web-vitals" }).
  ...compat.extends("next/core-web-vitals"),
];
