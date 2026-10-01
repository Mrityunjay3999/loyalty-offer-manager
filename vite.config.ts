/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// On GitHub Pages the app is served from https://<user>.github.io/<repo>/,
// so production assets need this base path. Dev stays at '/'.
const REPO_BASE = '/loyalty-offer-manager/';

export default defineConfig({
  // Build uses the repo base for GitHub Pages; the dev script overrides with --base=/.
  base: REPO_BASE,
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@radix-ui/react-dialog',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-dropdown-menu',
    ],
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
