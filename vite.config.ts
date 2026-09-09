import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    // Lets the frontend call relative "/api/..." paths in dev too, matching
    // production where the Express server serves both on one origin.
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
