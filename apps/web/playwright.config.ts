import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: {
    baseURL: "http://localhost:3000",
    geolocation: { latitude: 21.03, longitude: 105.85 },
    permissions: ["geolocation"],
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_AUTH_MODE: "fake",
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:8080",
      // Must equal the backend STORAGE_BUCKET, or it rejects fake upload URLs.
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "memopin-app.firebasestorage.app",
    },
  },
});
