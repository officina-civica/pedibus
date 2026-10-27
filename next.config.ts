import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dati per-utente ovunque: niente cache dei componenti, ogni pagina è dinamica.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      // Il service worker deve poter controllare tutta l'app.
      { source: "/sw.js", headers: [{ key: "Service-Worker-Allowed", value: "/" }, { key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
