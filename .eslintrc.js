module.exports = {
    plugins: [
      "@typescript-eslint", "prettier"
    ],
    extends: [
        "eslint:recommended",
        "plugin:import/typescript",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "prettier",
    ],
    env: {
        node: true,
        es6: true,
        es2022: true,
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
    },
    settings: {
        "import/resolver": {
            typescript: {
                alwaysTryTypes: true
            }
        }
    },
};
  