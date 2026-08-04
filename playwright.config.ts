import { defineConfig, devices } from "@playwright/test";

export default defineConfig({ testDir: "./tests/e2e", fullyParallel: true, retries: process.env.CI ? 2 : 0, reporter: "list", use: { baseURL: "http://127.0.0.1:3010", channel: "chromium", trace: "on-first-retry" }, webServer: { command: "npm run dev -- -p 3010", url: "http://127.0.0.1:3010/login", reuseExistingServer: false, timeout: 120000 }, projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }] });
