import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/cloud",
  outputDir: "test-results/cloud",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    ...devices["Desktop Chrome"],
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    env: {
      // Regression: the actual site must show cloud login with no build variables.
      // Every API call is intercepted by the tests; the live project isn't contacted.
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      VITE_ATLAS_DEMO: "false",
    },
    reuseExistingServer: false,
  },
});
