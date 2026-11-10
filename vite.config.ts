import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { port: 1420, strictPort: true },
  build: { target: "es2022", cssMinify: false, assetsInlineLimit: 10000000, rollupOptions: {output: {inlineDynamicImports: true}} },
  clearScreen: false,
});
