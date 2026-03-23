import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.join(__dirname, "../../.env") });
loadEnv({ path: path.join(__dirname, ".env.local") });

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

function envForWebServer(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export default defineConfig({
  testDir: path.join(__dirname, "specs"),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: path.join(__dirname, "report-html") }],
  ],
  timeout: 120_000,
  expect: { timeout: 25_000 },
  globalSetup: path.join(__dirname, "global-setup.ts"),
  globalTeardown: path.join(__dirname, "global-teardown.ts"),
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    cwd: path.join(__dirname, "../.."),
    env: envForWebServer(),
  },
});
