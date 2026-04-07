const eslintPluginPrettier = require("eslint-plugin-prettier");
const eslintConfigPrettier = require("eslint-config-prettier");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: ["dist/", "node_modules/", "projects/", "coverage/", "commands/", ".tmp/"], // Ignored paths
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      ecmaVersion: "latest",
    },
    plugins: {
      prettier: eslintPluginPrettier,
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...eslintConfigPrettier.rules,
      "prettier/prettier": ["error", { singleQuote: true }],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "method", format: ["camelCase"] },
        { selector: "property", format: ["camelCase", "UPPER_CASE"] },
        { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
        { selector: "function", format: ["camelCase"] },
        { selector: "parameter", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "class", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
        { selector: "interface", format: ["PascalCase"] }
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "max-lines": ["error", { max: 600, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 100, skipBlankLines: true, skipComments: true }],
      "no-debugger": "error",
      "curly": "error",
      "no-alert": "error",
      "arrow-body-style": ["error", "as-needed"],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { vars: "all", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": ["warn", { ignoreRestArgs: true }],
      "object-shorthand": ["error", "always", { avoidQuotes: true }],
      "prefer-template": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "no-unused-expressions": [
        2,
        { allowTaggedTemplates: true }
      ],
      "quotes": [
        "error",
        "single",
        { avoidEscape: true, allowTemplateLiterals: true }
      ]
    },
  },
];
