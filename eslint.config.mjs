import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Additional custom ignores:
    'node_modules/**',
    '.vercel/**',
    'dist/**',
    'app/generated/**',
    '*.min.js',
    '*.bundle.js',
    'prisma/migrations/**',
    '**/*.log',
    'coverage/**',
  ]),
  // Security: Disallow console statements in API routes and lib/
  {
    files: ['app/api/**/*.{ts,tsx,js,jsx}', 'lib/**/*.{ts,tsx,js,jsx}'],
    ignores: [
      'lib/logger.ts', // Logger itself uses console
      'lib/cron/eventsScraper.ts', // Scraper uses console for cron output
    ],
    rules: {
      'no-console': 'error',
    },
  },
]);

export default eslintConfig;
