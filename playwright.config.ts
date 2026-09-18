import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4331', browserName: 'chromium', channel: 'msedge' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4331', url: 'http://127.0.0.1:4331', reuseExistingServer: false },
});
