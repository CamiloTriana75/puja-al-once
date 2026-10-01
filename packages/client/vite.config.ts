import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Sin proxy de "/silhouettes": el cliente construye URLs absolutas
// (roomId + publicId) contra el servidor, nunca rutas relativas -- ver
// net/types.ts y screens/Lobby.tsx. Un proxy aqui nunca se usaria.

/**
 * URL publica del sitio, sin barra final. Un unico sitio de verdad: de
 * aqui salen el canonical y el og:url de index.html, el Sitemap de
 * robots.txt y el <loc> de sitemap.xml, para que no puedan discrepar.
 *
 * Es la que produce el servicio de render.yaml. El sufijo `-3u8j` no es
 * decorativo: Render no tenia libre el nombre tal cual y le anadio uno
 * propio al crear el servicio. Ese hostname es el que existe, asi que es
 * el que va aqui. Si apunta a un host que no existe, la imagen de la vista
 * previa del enlace (og:image) da 404 y WhatsApp/Discord no la muestran. Si el dominio cambia -- dominio propio, otro nombre de servicio
 * -- cambiala aqui, o exporta VITE_SITE_URL para no tocar el fichero. Es
 * publico, no un secreto.
 */
const DEFAULT_SITE_URL = "https://puja-al-once-3u8j.onrender.com";

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
          "  <url>",
          `    <loc>${base}/actualizaciones.html</loc>`,
          "  </url>",
          "  <url>",
          `    <loc>${base}/legal/terminos.html</loc>`,
          "  </url>",
          "  <url>",
          `    <loc>${base}/legal/privacidad.html</loc>`,
          "  </url>",
          "  <url>",
          `    <loc>${base}/legal/cookies.html</loc>`,
          "  </url>",
          "  <url>",
          `    <loc>${base}/legal/propiedad-intelectual.html</loc>`,
          "  </url>",
          "  <url>",
          `    <loc>${base}/legal/contacto.html</loc>`,
          "  </url>",
          "  <url>",
          `    <loc>${base}/legal/comunidad.html</loc>`,
          "  </url>",
          "  <url>",
          `    <loc>${base}/legal/creditos.html</loc>`,
          "  </url>",
          "</urlset>",
          "",
        ].join("\n"),
      });
    },
  };
}

/**
 * Las paginas publicas de `public/` (actualizaciones, legales, creditos)
 * llevan tambien `%SITE_URL%` en su canonical y en sus etiquetas og:url,
 * pero Vite copia `public/` tal cual: no pasan por `transformIndexHtml` y el
 * marcador se publicaria literal. Este paso lo resuelve DESPUES de la
 * escritura, sobre lo que hay en dist/, y solo en ficheros .html -- es el
 * unico sitio donde estan ya todos los assets y donde buscar no cuesta nada.
 *
 * Motivo por el que existe en vez de escribir el dominio a mano en cada
 * pagina: una sola fuente de verdad. Si el dominio cambia, se cambia en
 * `DEFAULT_SITE_URL` y las ocho paginas se mueven con el; ocho copias
 * hardcodeadas del hostname son ocho formas de que el canonical senale al
 * sitio equivocado, que es la forma mas silenciosa de perder indexacion.
 */
function resolvePublicHtmlUrls(): Plugin {
  return {
    name: "futbolera-public-html-urls",
    closeBundle() {
      const base = siteUrl();
      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          if (statSync(full).isDirectory()) {
            walk(full);
            continue;
          }
          if (!entry.endsWith(".html")) continue;
          const html = readFileSync(full, "utf8");
          if (!html.includes("%SITE_URL%")) continue;
          writeFileSync(full, html.replaceAll("%SITE_URL%", base));
        }
      };
      walk("dist");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoAssets(), resolvePublicHtmlUrls()],
  server: {
    port: 5173,
  },
});
