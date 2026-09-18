import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Exercise Astro's dev routing too: preview alone misses JSON trailing-slash bugs.
export default defineConfig({
  ...config,
  use: { ...config.use, baseURL: 'http://127.0.0.1:4332' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4332',
    url: 'http://127.0.0.1:4332',
    reuseExistingServer: false,
  },
});
