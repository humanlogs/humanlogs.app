module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["plugin:react/recommended"],
  parser: "@babel/eslint-parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: "module",
  },
  plugins: ["react"],
  rules: {
    "react/jsx-indent": [2, 2],
    "react/jsx-indent-props": [2, 2],
    "react/jsx-props-no-spreading": 0,
    "react/prop-types": 0,
    "react-hooks/exhaustive-deps": "off",
    "react/react-in-jsx-scope": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
};
