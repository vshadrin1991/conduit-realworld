/** ESLint 8 config for the TypeScript framework and specs (also used by the IDE inspection). */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    ecmaVersion: 2023,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2023: true },
  ignorePatterns: [
    'node_modules/',
    'reports/',
    'test-results/',
    'playwright-report/',
    '.auth/',
    'dist/',
    // Pages saved from the browser ship minified vendor bundles that are not part of the framework.
    'new_tests/',
    'tasks/',
    '*.mjs',
    '*.cjs',
  ],
  rules: {
    // Page chains are thenable: a chain without `await` never runs.
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    // `data.tagList!` on generated data is intentional in tests.
    '@typescript-eslint/no-non-null-assertion': 'off',
    // `Map<Function, ...>` caches in BaseTest are keyed by class constructors.
    '@typescript-eslint/ban-types': 'off',
  },
};
