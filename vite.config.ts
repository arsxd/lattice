import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageInfo from "./package.json" with { type: "json" };
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(packageInfo.version) },
  server: { port: 1420, strictPort: true },
  build: {
    target: "es2022",
    cssMinify: false,
    assetsInlineLimit: 10000000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  clearScreen: false,
});
