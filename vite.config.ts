import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  // Os navegadores-alvo já suportam destructuring; evita rebaixamento incompatível
  // quando o workspace fornece esbuild mais novo que o usado originalmente pelo Vite 5.
  esbuild: { supported: { destructuring: true } },
  root: "client",
  resolve: { alias: { "@shared": path.resolve(__dirname, "shared") } },
  build: { outDir: "../dist/public", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:5000", "/uploads": "http://localhost:5000" } },
});
