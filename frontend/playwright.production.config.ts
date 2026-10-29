import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Exercise the bundled CSS and JS, not Vite's development style injection.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:4174" },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
});
