import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Node.js globals
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        exports: "writable",
        module: "writable",
        require: "readonly",
        global: "readonly",
        // Browser globals for frontend
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        alert: "readonly",
        location: "readonly",
        history: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Chart: "readonly",
        Capacitor: "readonly",
        crypto: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        // Test globals
        test: "readonly",
        describe: "readonly",
        it: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    rules: {
      "no-console": "off", // Allow console for now
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", vars: "all", args: "after-used" }],
      "prefer-const": "warn",
      "no-var": "error",
      eqeqeq: "off", // Disable for existing code
      curly: "off", // Disable for existing code
      "no-throw-literal": "warn",
      "no-undef": "error",
    },
  },
  {
    // Server-side rules (stricter for new code)
    files: ["server/src/**/*.js", "!server/src/middleware/**"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "coverage/",
      "*.min.js",
      "android/",
      ".gradle/",
      "*.apk",
      "*.aab",
      "index.html",
      "prototype.html",
      "frontend/**", // Skip frontend for now
      "server/test/**", // Skip tests for now
      "server/src/market/collectors/**", // Skip collectors with regex patterns
    ],
  },
];
