import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Local dev: Vercel functions in /api run via `vercel dev`. When running
    // plain `vite`, the app falls back to mock mode (VITE_ENABLE_MOCK_DATA).
  },
});
