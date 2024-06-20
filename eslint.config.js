import pluginJs from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '.env*',
      '*.log*',
      '.vscode/*',
      '.idea',
      '.DS_Store',
      '.eslintcache',
      '.stylelintcache',
      '.prettiercache',
      'node_modules',
      'jspm_packages',
      '.npm',
      '.pnp/',
      '.pnp.*',
      '.yarn/*',
      '.yarn-integrity',
      '*.tsbuildinfo',
      'lib',
      'dist',
      'coverage',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'release-it',
      'CHANGELOG.md',
    ],
  },
];
