import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Disable the rule that disallows console.log, as it can be useful for debugging.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_.*",
          // Unused vars intentionally prefixed with "_" are allowed (e.g. keys
          // destructured only to strip them from an object rest spread).
          varsIgnorePattern: "^_.*",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
