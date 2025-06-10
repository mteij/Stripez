module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    "ecmaVersion": 2018,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
    // BEGIN NEW ESLINT RULES FOR FLEXIBILITY
    "max-len": ["error", {
      "code": 120, // Relax maximum line length to 120 characters
      "ignoreComments": true, // Ignore comments from max-len check
      "ignoreUrls": true, // Ignore URLs from max-len check
      "ignoreStrings": true, // Ignore long strings from max-len check
      "ignoreTemplateLiterals": true, // Ignore template literals from max-len check
      "ignoreRegExpLiterals": true // Ignore regex literals from max-len check
    }],
    "indent": ["error", 2, { // Enforce 2-space indentation consistently
      "SwitchCase": 1 // Keep 1-level indent for SwitchCase
    }],
    "no-trailing-spaces": "off", // Turn off the rule for trailing spaces
    // END NEW ESLINT RULES
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};