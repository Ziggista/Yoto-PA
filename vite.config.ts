import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadVersionMeta } from "./scripts/version-meta.mjs";

const versionMeta = loadVersionMeta();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(versionMeta.versionName),
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});
