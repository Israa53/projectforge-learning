import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), basicSsl()],

  server: {
    port: 5173,
    strictPort: true,

    proxy: {
      "/api": {
        target: "https://localhost:7050",
        changeOrigin: true,

        // Local development: ASP.NET uses a development certificate.
        secure: false,
      },
    },
  },
});
