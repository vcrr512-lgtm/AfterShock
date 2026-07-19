import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// Note: No @webspatial/vite-plugin or vite-plugin-html needed for PICO emulator.
// WebSpatial SDK is enabled purely via jsxImportSource in tsconfig.app.json.
// server.host = true exposes the dev server on all IPs so PICO emulator
// can reach it via http://10.0.2.2:5173/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
});
