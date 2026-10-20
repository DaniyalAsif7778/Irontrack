import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5174 },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return;

          if (/\/node_modules\/(recharts|victory-vendor|d3-[^/]+)\//.test(id)) return "vendor-charts";
          if (/\/node_modules\/(react|react-dom|react-router-dom|react-router|scheduler|@remix-run)\//.test(id)) return "vendor-react";
          if (/\/node_modules\/@tanstack\//.test(id)) return "vendor-query";
          if (/\/node_modules\/gsap\//.test(id)) return "vendor-motion";
          if (/\/node_modules\/lucide-react\//.test(id)) return "vendor-icons";
          if (/\/node_modules\/(date-fns|@date-fns)\//.test(id)) return "vendor-dates";
          if (/\/node_modules\/(zod|react-hook-form|@hookform)\//.test(id)) return "vendor-forms";
        },
      },
    },
  },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/test/setup.ts" },
});
