import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Sin proxy de "/silhouettes": el cliente construye URLs absolutas
// (roomId + publicId) contra el servidor, nunca rutas relativas -- ver
// net/types.ts y screens/Lobby.tsx. Un proxy aqui nunca se usaria.

/**
 * URL publica del sitio, sin barra final. Un unico sitio de verdad: de
 * aqui salen el canonical y el og:url de index.html, el Sitemap de
 * robots.txt y el <loc> de sitemap.xml, para que no puedan discrepar.
 *
 * Es la que produce el servicio de render.yaml. Si el dominio cambia --
 * dominio propio, otro nombre de servicio -- cambiala aqui, o exporta
 * VITE_SITE_URL para no tocar el fichero. Es publico, no un secreto.
 */
const DEFAULT_SITE_URL = "https://subasta-futbolera.onrender.com";

function siteUrl(): string {
  return (process.env.VITE_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
}

/**
 * Los ficheros de SEO se generan en el build en vez de guardarse en
 * public/ por una razon concreta: public/ se copia tal cual y no admite
 * la sustitucion de %SITE_URL%, asi que un sitemap ahi seria una copia
 * que se queda vieja en cuanto cambia el dominio. Emitidos desde aqui
 * no hay segunda fuente de verdad que actualizar.
 *
 * Sin `lastmod` a proposito: se pondria a la fecha de cada build, y un
 * lastmod que siempre cambia es exactamente lo que enseña a un rastreador
 * a no mirar ese campo.
 */
function seoAssets(): Plugin {
  return {
    name: "futbolera-seo",
    transformIndexHtml(html) {
      return html.replaceAll("%SITE_URL%", siteUrl());
    },
    generateBundle() {
      const base = siteUrl();

      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: [
          "User-agent: *",
          "Allow: /",
          "",
          "# Rutas de API: no son contenido y no hay nada que rastrear en",
          "# ellas. Esto es higiene de presupuesto de rastreo, NO es control",
          "# de acceso -- esas rutas ya filtran por origen y limitan por IP.",
          "Disallow: /rooms/",
          "Disallow: /time",
          "Disallow: /health/",
          "Disallow: /silhouettes/",
          "Disallow: /photos/",
          "",
          "# /sala/CODE no se lista: son salas efimeras y se llegan por",
          "# enlaces de invitacion, no se rastrean.",
          "",
          `Sitemap: ${base}/sitemap.xml`,
          "",
        ].join("\n"),
      });

      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          "  <url>",
          `    <loc>${base}/</loc>`,
          "  </url>",
          "</urlset>",
          "",
        ].join("\n"),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoAssets()],
  server: {
    port: 5173,
  },
});
