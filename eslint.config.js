import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
