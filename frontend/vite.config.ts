import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@views": path.resolve(__dirname, "./src/views"),
    },
  },
  server: {
    port: 443,
    host: "0.0.0.0",
    https: {
      key: fs.readFileSync(
        path.resolve(__dirname, "./certs/hellfish.test.key")
      ),
      cert: fs.readFileSync(
        path.resolve(__dirname, "./certs/hellfish.test.crt")
      ),
      ca: fs.readFileSync(path.resolve(__dirname, "./certs/myCA.pem")), // optional if the client needs to trust your CA
    },
  },
});
