export default [
  {
    ignores: [
      'node_modules/**',
      '.git/**',
      '.work/**',
      '.build/**',
      'vendor/**',
      'assets/**',
      'fonts/**',
      '*-data.js',
      '*-services.js',
      'catalog.js',
      'pricing.js',
      '*-pricing.js',
      'delivery-settlements.js',
      'site-search-index.js',
      'site-search-geography.js',
    ],
  },
  {
    files: ['*.js', '*.mjs', '.server/**/*.mjs', '.server/admin/*.js', 'scripts/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },
];
