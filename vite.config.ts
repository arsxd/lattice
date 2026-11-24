import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageInfo from "./package.json" with { type: "json" };
// @ts-expect-error plain JavaScript helper shared with the build scripts
import { buildId } from "./scripts/build-id.mjs";
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageInfo.version),
    __APP_BUILD__: JSON.stringify(buildId()),
  },
  server: { port: 1420, strictPort: true },
  build: {
    target: "es2022",
    cssMinify: false,
    assetsInlineLimit: 10000000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  clearScreen: false,
});
