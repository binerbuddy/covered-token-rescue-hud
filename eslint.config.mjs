import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        canvas: "readonly",
        game: "readonly",
        foundry: "readonly",
        Hooks: "readonly",
        CONFIG: "readonly",
        PIXI: "readonly",
        Token: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["error", {argsIgnorePattern: "^_"}]
    }
  },
  {
    files: ["test/**/*.mjs", "tools/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {...globals.node, ...globals.browser}
    }
  }
];
