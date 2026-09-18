import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Run `wrangler dev --port 8787` alongside `vite`. This proxy makes the API
// look same-origin to the browser in dev, so the admin session cookie works
// without any CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/media": "http://127.0.0.1:8787"
    }
  }
});
