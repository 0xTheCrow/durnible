module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'airbnb',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  globals: {
    JSX: 'readonly',
  },
  plugins: ['react', '@typescript-eslint'],
  rules: {
    'linebreak-style': 0,
    'no-underscore-dangle': 0,
    'no-shadow': 'off',

    'import/prefer-default-export': 'off',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: true,
      },
    ],

    'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
    'react/jsx-filename-extension': [
      'error',
      {
        extensions: ['.tsx', '.jsx'],
      },
    ],

    'react/require-default-props': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',

    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    'no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-shadow': 'error',

    // Override airbnb's no-restricted-syntax to drop the for-of ban. Airbnb
    // forbids for...of because it required regenerator-runtime when targeting
    // ES5; we target modern browsers via Vite, so for...of is fine. Keep the
    // bans on for-in (prototype-chain pitfalls), labeled statements, and
    // `with` (forbidden in strict mode anyway).
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForInStatement',
        message:
          'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
      },
      {
        selector: 'LabeledStatement',
        message:
          'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message:
          '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
    ],

    // Allow console.warn / console.error as legitimate diagnostics; only
    // console.log (and friends) are flagged as forgotten debug output.
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Allow empty arrow functions — `onClick={() => {}}` for intentionally
    // inert handlers is a legitimate React pattern. The eslint-native rule
    // is disabled in favor of the TS variant which honors `allow`.
    'no-empty-function': 'off',
    '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],

    // Function declarations are hoisted, so forward references to them are
    // safe at runtime. The conservative default flags every forward reference
    // including hoisted functions; relax it for functions specifically.
    'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],

    // TypeScript's `strict` mode already errors on forward references to
    // const/let/class via TS2448, so the eslint rule is purely redundant in
    // this codebase. The remaining categories it catches (function declarations,
    // var) are either safe-at-runtime or already forbidden.
    'no-use-before-define': 'off',

    // Slate editors and forwarded React refs are *designed* to be mutated —
    // their APIs treat .children / .current as the canonical write target.
    // Allow property mutation on parameters with these specific names;
    // every other parameter still trips the rule.
    'no-param-reassign': [
      'error',
      {
        props: true,
        ignorePropertyModificationsFor: ['editor', 'ref'],
      },
    ],

    // Pure stylistic preferences from airbnb that don't fit this codebase:
    'no-plusplus': 'off', // i++ is fine; i += 1 is just noise
    'no-continue': 'off', // continue is often the clearest way to skip an iteration
    'no-nested-ternary': 'off', // single-level nesting is often the cleanest expression
    'react/jsx-boolean-value': 'off', // both `prop` and `prop={true}` are fine
    'spaced-comment': 'off', // formatting concern, not a correctness one
    'prefer-destructuring': 'off', // sometimes the un-destructured form is clearer
  },
  overrides: [
    {
      // TypeScript's own checker is the source of truth for "is this defined";
      // ESLint's no-undef doesn't see DOM/TS types and only causes false
      // positives in TS files.
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-undef': 'off',
      },
    },
    {
      // Web Worker files: `self` is the worker's global scope, not a window
      // shadow. Tell ESLint we're in a worker env so the no-restricted-globals
      // rule from airbnb stops flagging it.
      files: ['**/*.worker.ts'],
      env: { worker: true, browser: false },
      rules: {
        'no-restricted-globals': 'off',
      },
    },
    {
      // Test files don't need a11y compliance, performance lints,
      // sequential-await caution, or production-only rules — they're
      // rendering minimal mock markup and constructing edge-case payloads
      // (XSS strings, etc.) to exercise component behavior.
      files: ['**/*.test.{ts,tsx}'],
      rules: {
        'jsx-a11y/click-events-have-key-events': 'off',
        'jsx-a11y/no-noninteractive-element-interactions': 'off',
        'jsx-a11y/no-static-element-interactions': 'off',
        'jsx-a11y/interactive-supports-focus': 'off',
        'react/jsx-no-constructed-context-values': 'off',
        'no-await-in-loop': 'off',
        // Sanitizer tests must construct javascript: URLs to verify they're stripped.
        'no-script-url': 'off',
        // Tests use known-good fixture data; non-null assertions on
        // queryByX() / fixture lookups are pragmatic.
        '@typescript-eslint/no-non-null-assertion': 'off',
        // Matrix mock events / `as any` casts to construct fixture state
        // are the entire reason these tests can exist without rebuilding
        // the full matrix-js-sdk type tree. The rule's signal is noise here.
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
