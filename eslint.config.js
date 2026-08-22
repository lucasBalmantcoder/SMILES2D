export default [
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        Image: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "after-used", argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-undef": "error",
      eqeqeq: ["warn", "smart"],
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "after-used", argsIgnorePattern: "^_" }],
    },
  },
];
