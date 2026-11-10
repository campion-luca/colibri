import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts'],
    // fuso diverso da Roma: scopre i calcoli che dipendono per errore dall'ora locale
    env: { TZ: 'America/Los_Angeles' },
  },
});
