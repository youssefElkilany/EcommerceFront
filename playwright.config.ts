import { defineConfig } from "@playwright/test";
const port = process.env.E2E_PORT || "3001";
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL, channel: "msedge", headless: true },
  webServer: {
    command: process.env.E2E_PORT ? `node node_modules/next/dist/bin/next start --port ${port}` : "npm.cmd run dev",
    url: baseURL,
    reuseExistingServer: !process.env.E2E_PORT,
  },
});