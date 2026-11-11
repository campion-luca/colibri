import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/*
 * Test RLS contro il progetto Supabase vero. Solo con `npm run test:rls`:
 * mai dentro `npm test` né in CI automatica. Le chiavi arrivano da .env.local.
 */
export default defineConfig(({ mode }) => ({
  test: {
    include: ['tests/rls/**/*.test.ts'],
    env: loadEnv(mode, process.cwd(), ''),
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
}));
