const fs = require("node:fs");
const path = require("node:path");

const root = process.argv[2];
const attributions = JSON.parse(fs.readFileSync(path.join(root, "data/attributions.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

const byId = new Map(players.map((p) => [p.silhouetteId, p]));

const by = {};
for (const x of attributions) (by[x.license] ??= []).push(x);
const lics = Object.keys(by).sort((p, q) => by[q].length - by[p].length);

const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const licSort = (p, q) => p.silhouetteId.localeCompare(q.silhouetteId);

// --- CREDITS.md (documento del repositorio) ---
const tick = (s) => `\`${s}\``;
let md = "";
md += "# Creditos y atribuciones\n\n";
md += `Las ${attributions.length} cartas de \`data/players.json\` usan una fotografia real de cada jugador,\n`;
md += "descargada de Wikimedia Commons. Las tablas de abajo son la atribucion que\n";
md += "exigen las licencias: sin este fichero el repositorio incumple los terminos de\n";
md += "las imagenes que contiene.\n\n";
md += "El listado legible se genera desde `data/attributions.json`, que es la fuente\n";
md += "de verdad y la que valida `pnpm dataset:check`. Si cambia una foto, actualiza el\n";
md += "JSON y regenera este fichero; no lo edites a mano:\n\n";
md += "```powershell\n";
md += "node tools/build-credits.cjs .\n";
md += "```\n\n";
md += "Ese mismo generador emite la pagina publica de creditos en\n";
md += "`packages/client/public/legal/creditos.html`, que es la atribucion que ven los\n";
md += "jugadores (enlazada desde el pie de la portada).\n\n";
md += "## Que se hace con cada imagen\n\n";
md += "De cada original se generan dos ficheros, ambos en `data/`:\n\n";
md += "- `photos/`: la fotografia original, reescalada por `sharp`.\n";
md += "- `silhouettes/`: la misma imagen con el fondo eliminado por\n";
md += "  `@imgly/background-removal-node` (ONNX, en local, sin API externa) y reescalada.\n\n";
md += "Las dos son obras derivadas del original, asi que las licencias Copyleft\n";
md += "(CC BY-SA) siguen obligando: quien reutilice estas imagenes debe mantener la\n";
md += "atribucion y compartir con la misma licencia. Por eso las imagenes y el codigo\n";
md += "no se mezclan bajo un unico LICENSE: `data/` tiene su propio regimen, este\n";
md += "fichero lo declara, y el LICENSE del repo aplica al codigo.\n\n";
md += "## Licencias\n\n";
md += "| Licencia | Imagenes |\n|---|---|\n";
for (const l of lics) md += `| ${l} | ${by[l].length} |\n`;
md += `| **Total** | **${attributions.length}** |\n\n`;
md += "`Public domain` y `CC0` no exigen atribucion, pero se listan igual para dejar\n";
md += "constancia de su procedencia.\n\n";
md += "## Sonido y animaciones\n\n";
md += "- **Golpe de mazo**: efecto de sonido \"Gavel of Justice\" de IntrepidMedia,\n";
md += "  publicado en Pixabay (<https://pixabay.com/sound-effects/gavel-of-justice-124029/>)\n";
md += "  bajo la Pixabay Content License (uso libre, sin atribucion obligatoria). Se\n";
md += "  recorta a un solo golpe y se baja el volumen para el juego.\n";
md += "- **Animacion del mazo**: ilustracion vectorial animada (SVG) aportada por el\n";
md += "  autor del proyecto; se recolorea con la paleta del juego.\n";
md += "- **Iconos**: [Lucide](https://lucide.dev) (licencia ISC).\n";
md += "- **Tipografias**: Unbounded y Jost, autoalojadas con Fontsource (SIL Open Font License).\n\n";
md += "## Detalle por imagen\n\n";
for (const l of lics) {
  md += `### ${l}\n\n`;
  md += "| Carta | Fichero | Autor | Fuente |\n|---|---|---|---|\n";
  for (const x of by[l].sort(licSort)) {
    const card = byId.get(x.silhouetteId);
    const name = card ? `${card.name} (${card.season})` : x.silhouetteId;
    md += `| ${name} | ${tick(x.silhouetteId)} | ${x.author} | [Commons](${x.sourcePage}) |\n`;
  }
  md += "\n";
}

fs.writeFileSync(path.join(root, "CREDITS.md"), md);
console.log(`CREDITS.md: ${attributions.length} imagenes, ${lics.length} licencias, ${md.length} bytes`);

// --- creditos.html (pagina publica en el cliente) ---
const pageTitle = "Créditos · Puja el Once";
const pageDescription = "Autor, licencia y fuente de las 149 fotografías de Wikimedia Commons usadas en las cartas.";
const nav = [
  ["../actualizaciones.html", "Actualizaciones", false],
  ["creditos.html", "Créditos", true],
  ["terminos.html", "Términos", false],
  ["privacidad.html", "Privacidad", false],
  ["cookies.html", "Cookies", false],
  ["propiedad-intelectual.html", "Propiedad intelectual", false],
  ["contacto.html", "Contacto", false],
  ["comunidad.html", "Comunidad", false],
]
  .map(([href, label, current]) => `<a href="${href}"${current ? ' aria-current="true"' : ""}>${label}</a>`)
  .join("\n      ");

let licenseBlocks = "";
for (const l of lics) {
  const rows = by[l].sort(licSort);
  const tds = rows
    .map((x) => {
      const card = byId.get(x.silhouetteId);
      const name = card ? `${esc(card.name)} <small>(${card.season})</small>` : `<code>${esc(x.silhouetteId)}</code>`;
      return `        <tr><td>${name}</td><td>${esc(x.author)}</td><td class="source"><a href="${esc(x.sourcePage)}" rel="noopener" target="_blank">Commons →</a></td></tr>`;
    })
    .join("\n");
  licenseBlocks += `    <section>
      <h2>${esc(l)} <span class="license-count">· ${rows.length}</span></h2>
      <div class="table-scroll">
        <table>
          <caption>Obras derivadas de imágenes ${esc(l)}</caption>
          <thead><tr><th scope="col">Carta</th><th scope="col">Autor</th><th scope="col">Fuente</th></tr></thead>
          <tbody>
${tds}
          </tbody>
        </table>
      </div>
    </section>
`;
}

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  <meta name="description" content="${esc(pageDescription)}" />
  <!--
    Canonical, Open Graph y Twitter Card con %SITE_URL%: el marcador lo
    resuelve el propio build (plugin resolvePublicHtmlUrls de
    packages/client/vite.config.ts) para que el dominio viva en un unico
    sitio y estas ocho paginas no puedan senalar a dominios distintos.
  -->
  <link rel="canonical" href="%SITE_URL%/legal/creditos.html" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Puja el Once" />
  <meta property="og:locale" content="es_ES" />
  <meta property="og:title" content="${esc(pageTitle)}" />
  <meta property="og:description" content="${esc(pageDescription)}" />
  <meta property="og:url" content="%SITE_URL%/legal/creditos.html" />
  <meta property="og:image" content="%SITE_URL%/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Puja el Once: puja a ciegas por un jugador de fútbol oculto y arma tu once." />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(pageTitle)}" />
  <meta name="twitter:description" content="${esc(pageDescription)}" />
  <meta name="twitter:image" content="%SITE_URL%/og-image.png" />
  <link rel="stylesheet" href="./legal.css" />
</head>
<body>
  <header class="top">
    <a class="brand" href="/" aria-label="Volver a la portada de Puja el Once">
      <mark>P</mark>
      <span class="brand-name">Puja el Once<b>· subasta de cromos</b></span>
    </a>
    <a class="back" href="/">← Jugar</a>
  </header>

  <main class="wrap">
    <span class="updated">01·10·2026</span>
    <h1>Créditos <em>y atribuciones</em></h1>
    <p class="lede">Cada carta de Puja el Once usa la fotografía real de su jugador, descargada de Wikimedia Commons. Estas tablas son la atribución que exigen las licencias; sin ellas, el juego incumpliría sus términos. Más abajo, los créditos del sonido, los iconos y las tipografías.</p>

    <section>
      <h2>Qué se hace con cada imagen</h2>
      <p>De cada foto se deriva la <code>photo</code> (reescalada) y la <code>silhouette</code> (fondo eliminado). Ambas son obras derivadas del original: las licencias copyleft (CC BY-SA) siguen obligando a quien las reutilice, y por eso el atributo que toca poner aquí es el de tu compañera o tu compañero de mesa honesto.</p>
    </section>

    <section>
      <h2>Licencias</h2>
      <p><strong>Total: ${attributions.length} cartas</strong>, repartidas así:</p>
      <ul>
${lics.map((l) => `        <li><strong>${esc(l)}</strong>: ${by[l].length} imágenes</li>`).join("\n")}
      </ul>
      <p><code>Public domain</code> y <code>CC0</code> no exigen atribución, pero se listan igual para dejar constancia de su procedencia. El código del juego es MIT (ver <a href="propiedad-intelectual.html">propiedad intelectual</a>).</p>
    </section>
    <section>
      <h2>Sonido y animaciones</h2>
      <ul>
        <li><strong>Golpe de mazo:</strong> efecto de sonido <a href="https://pixabay.com/sound-effects/gavel-of-justice-124029/" rel="noopener" target="_blank">«Gavel of Justice»</a> de IntrepidMedia, publicado en Pixabay bajo la Pixabay Content License (uso libre, sin atribución obligatoria). Lo recortamos a un solo golpe y bajamos el volumen para el juego.</li>
        <li><strong>Animación del mazo:</strong> ilustración vectorial animada (SVG) aportada por el autor del proyecto; la recoloreamos con la paleta del juego.</li>
        <li><strong>Iconos:</strong> <a href="https://lucide.dev" rel="noopener" target="_blank">Lucide</a> (licencia ISC).</li>
        <li><strong>Tipografías:</strong> Unbounded y Jost, autoalojadas con Fontsource (SIL Open Font License).</li>
      </ul>
    </section>
${licenseBlocks}
  </main>

  <footer class="page">
    <span>Puja el Once · juego de amigos, sin ánimo de lucro</span>
    <nav class="legal-nav" aria-label="Páginas legales">
${nav}
    </nav>
  </footer>
</body>
</html>
`;

const htmlPath = path.join(root, "packages/client/public/legal/creditos.html");
fs.writeFileSync(htmlPath, html);
console.log(`creditos.html: ${html.length} bytes en ${path.relative(root, htmlPath)}`);