/**
 * Hoja de contactos para revisar las siluetas A OJO, que es la unica revision
 * que no se puede automatizar (scripts/audit-silhouettes.ts mide geometria, pero
 * no puede decir si la foto es del jugador correcto).
 *
 * Replica la carta real de packages/client/src/components/AuctionCard.tsx al
 * pixel: mismo figure recortado, misma cuña lima con skew, misma banda deep,
 * mismo -top-6 / right-[6%] / h-[112%], mismo recorte de panel, mismos colores
 * de index.css. El objetivo es que lo que se ve aqui sea lo que se ve en la
 * web -- si la foto pasa en la hoja, pasa en produccion.
 *
 * NO es una vista de "how-to": por eso el cutout va superpuesto al panel, que
 * es donde de verdad lo tapa.
 *
 *   npx tsx scripts/contact-sheet.ts                      # flagged, vertical, fotos
 *   npx tsx scripts/contact-sheet.ts --all                # las 154
 *   npx tsx scripts/contact-sheet.ts --mode=silhouette    # mascara blanca
 *   npx tsx scripts/contact-sheet.ts --layout=wide        # como se ve en escritorio
 *
 * La salida es contact-sheets/index.html, referenciando los PNG por ruta
 * relativa. Se abre con doble click; no hace falta servidor.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { LIMITS, type Measures, auditSilhouettes, measureSilhouette } from "./audit-silhouettes.js";
import { thumbName } from "./fetch-candidate-thumbs.js";

interface Player {
  cardId: string;
  name: string;
  season: number;
  slot: string;
  silhouetteId: string;
}

type Mode = "photo" | "silhouette";
type Layout = "portrait" | "wide";

interface Preset {
  file: string;
  mode: Mode;
  layout: Layout;
}

/**
 * Las tres vistas que hacen falta para juzgar. La vertical en color es la
 * principal: es lo que se ve en movil y lo que deja reconocer a quien es cada
 * uno. La mascara blanca comprueba el recorte. La ancha es como se ve en
 * escritorio, donde el cutout es 115% y el right 8% en vez de 6%.
 */
const PRESETS: Preset[] = [
  { file: "index.html", mode: "photo", layout: "portrait" },
  { file: "siluetas.html", mode: "silhouette", layout: "portrait" },
  { file: "escritorio.html", mode: "photo", layout: "wide" },
];

const OUT_DIR = "contact-sheets";

/** Escapa para interpolar en el HTML. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

const ONLY_FLAGGED = !process.argv.includes("--all");
const OVERRIDE_COLUMNS = arg("columns") ? Number(arg("columns")) : undefined;

/**
 * Reproblemas que la auditoria marca, explicados en una frase. La hoja ordena
 * por gravedad: primero lo que no se puede arreglar con un recorte.
 */
const WORDS: { test: RegExp; note: string; bad: boolean }[] = [
  { test: /misma URL/, note: "misma foto que otro jugador", bad: true },
  { test: /PNG identico/, note: "PNG duplicado", bad: true },
  { test: /no describe un cuerpo/, note: "no es un cuerpo: segmento equivocado", bad: true },
  { test: /no existe el PNG/, note: "sin foto", bad: true },
  { test: /masa solida/, note: "masa solida", bad: true },
  { test: /mas ancho que alto/, note: "encuadre de grupo", bad: true },
  { test: /px de ancho/, note: "desborda el ancho", bad: false },
  { test: /solo ocupa el/, note: "margen vertical", bad: false },
];

interface Row {
  player: Player;
  measurement: Measures | null;
  missing: boolean;
  notes: string[];
  bad: boolean;
}

async function build(): Promise<void> {
  const players = JSON.parse(readFileSync("data/players.json", "utf8")) as Player[];
  const report = await auditSilhouettes();

  const rows: Row[] = [];
  for (const player of players) {
    const problems = report.problems.filter((p) => p.id === player.silhouetteId);
    const notes = [
      ...new Set(
        problems
          .map((p) => WORDS.find((w) => w.test.test(p.reason))?.note)
          .filter((n): n is string => Boolean(n)),
      ),
    ];
    const bad = problems.some((p) => WORDS.some((w) => w.bad && w.test.test(p.reason)));

    const silhouettePath = `data/silhouettes/${player.silhouetteId}.png`;
    const missing = !existsSync(silhouettePath);
    const measurement = missing ? null : await measureSilhouette(readFileSync(silhouettePath));
    rows.push({ player, measurement, missing, notes, bad });
  }

  const shown = ONLY_FLAGGED ? rows.filter((r) => r.notes.length > 0) : rows;
  // Lo grave arriba: lo que hay que re-curar, no lo que solo se recorta.
  shown.sort(
    (a, b) => Number(b.bad) - Number(a.bad) || a.player.name.localeCompare(b.player.name),
  );

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  for (const preset of PRESETS) {
    const page = renderPage(shown, {
      t: LIMITS,
      mode: preset.mode,
      layout: preset.layout,
      columns: OVERRIDE_COLUMNS ?? (preset.layout === "wide" ? 2 : 5),
      total: rows.length,
    });
    writeFileSync(`${OUT_DIR}/${preset.file}`, page);
  }

  // La hoja de candidatos: una seccion por jugador con sus alternativas de
  // Commons, la foto que tiene ahora al lado para comparar y un campo donde
  // apuntar el numero de la elegida.
  const candidatesPath = `${OUT_DIR}/candidates.json`;
  if (existsSync(candidatesPath)) {
    const candidates = JSON.parse(readFileSync(candidatesPath, "utf8")) as Record<
      string,
      Array<{
        file: string;
        url: string;
        thumb: string;
        author: string;
        license: string;
        sourcePage: string;
        year: number | null;
        width: number;
        height: number;
        verified: boolean;
        category: string;
        otherNames?: string[];
        sameEra?: boolean;
        rightTeam?: boolean;
      }>
    >;
    // Todas las cartas con candidatos, no solo las marcadas: una carta puede
    // no fallar en la auditoria y aun asi haberse pedido cambio a mano.
    writeFileSync(
      `${OUT_DIR}/candidatos.html`,
      renderCandidatesPage(rows, candidates),
    );
    const total = Object.values(candidates).reduce((n, c) => n + c.length, 0);
    const local = Object.values(candidates)
      .flat()
      .filter((c) => existsSync(`${OUT_DIR}/thumbs/${thumbName(c.file)}`)).length;
    console.log(`  ${OUT_DIR}/candidatos.html  (${total} candidatos, ${local} con miniatura local)`);
    if (local < total) {
      console.log(
        `    faltan ${total - local}: ejecuta "pnpm silhouettes:thumbs" cuando Commons no devuelva 429`,
      );
    }
  }

  const reCurar = rows.filter((r) => r.bad && !r.missing).length;
  const sinFoto = rows.filter((r) => r.missing).length;
  console.log(`${OUT_DIR}/  ->  ${PRESETS.map((p) => p.file).join(", ")}`);
  console.log(`  ${shown.length} cartas en la hoja  (${rows.length} en el dataset)`);
  console.log(`  ${reCurar} con foto que hay que re-curar, ${sinFoto} sin foto`);
  console.log(`  ${report.problems.length} problemas en total`);
}

function renderPage(
  rows: Row[],
  opts: {
    t: typeof LIMITS;
    mode: Mode;
    layout: Layout;
    columns: number;
    total: number;
  },
): string {
  const { t, mode, layout, columns, total } = opts;

  const cards = rows.map((row) => renderCard(row, mode)).join("\n");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Siluetas - hoja de contactos</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  /* Colores y recorte copiados de packages/client/src/index.css y del
     .panel de AuctionCard. Si cambias la carta, cambias esto. */
  :root {
    --ink: #12100f;
    --green: #16c64f;
    --lime: #c6f833;
    --deep: #0b3d2e;
    --clip-panel: polygon(0 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%);
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    background: var(--deep);
    color: #fff;
    font-family: Barlow, system-ui, sans-serif;
    padding: 20px 24px 60px;
  }
  header { max-width: 1400px; margin: 0 auto 22px; }
  h1 { font-family: "Barlow Condensed", sans-serif; text-transform: uppercase; font-weight: 900; font-size: 30px; letter-spacing: -.02em; }
  .legend { color: #a8b3ad; font-size: 14px; margin-top: 4px; }
  .legend b { color: var(--lime); }

  .grid {
    max-width: 1400px; margin: 0 auto;
    display: grid; gap: 26px 18px;
    grid-template-columns: repeat(${columns}, minmax(0, 1fr));
  }
  .cell { min-width: 0; }
  .cell.bad .card { outline: 3px solid #ff4d3d; outline-offset: 0; }
  .cell.warn .card { outline: 3px solid var(--lime); outline-offset: 0; }

  /* ---- La carta real ---- */
  .card {
    position: relative; isolation: isolate;
    ${layout === "portrait" ? "aspect-ratio: 3/4;" : "aspect-ratio: 16/6;"}
    width: 100%; overflow: hidden; background: var(--green);
    container-type: inline-size;
  }
  /* Cuña diagonal: cruza por detras de la silueta y sale del encuadre. */
  .wedge {
    position: absolute; top: 0; height: 100%; width: 40%;
    right: ${layout === "portrait" ? "-6rem" : "-6rem"};
    background: var(--lime); transform: skewX(-18deg);
  }
  .band { position: absolute; inset-inline: 0; bottom: 0; height: 25%; background: var(--deep); }

  .cut {
    position: absolute; top: -1.5rem;
    right: ${layout === "portrait" ? "6%" : "8%"};
    height: ${layout === "portrait" ? "112%" : "115%"};
    width: auto; object-fit: contain; object-position: bottom; z-index: 10;
    ${mode === "silhouette" ? "filter: brightness(0) invert(1);" : ""}
  }
  .panel {
    position: absolute; left: 0; top: ${layout === "portrait" ? "8%" : "10%"};
    z-index: 20; max-width: ${layout === "portrait" ? "70%" : "58%"};
    background: var(--ink); padding: 1rem 2.5rem 1rem 1.25rem;
    clip-path: var(--clip-panel);
    font-family: "Barlow Condensed", sans-serif;
  }
  .p-first { font-weight: 800; line-height: .85; letter-spacing: -.025em; color: var(--green); font-size: ${layout === "portrait" ? "8.75cqw" : "6cqw"}; }
  .p-last  { font-weight: 900; text-transform: uppercase; line-height: .85; letter-spacing: -.025em; color: #fff; font-size: ${layout === "portrait" ? "10cqw" : "7.5cqw"}; }
  .p-season {
    margin-top: .75rem; display: inline-block; background: #fff; color: var(--ink);
    padding: .25rem .5rem; font-weight: 800; font-variant-numeric: tabular-nums;
    font-size: ${layout === "portrait" ? "5.6cqw" : "2.25cqw"};
  }
  .empty {
    position: absolute; inset: 0; display: grid; place-items: center;
    font-family: "Barlow Condensed", sans-serif; font-weight: 800;
    text-transform: uppercase; color: #0a5c33; font-size: 20px; letter-spacing: .1em;
  }

  /* ---- Notas de la auditoria ---- */
  .meta { margin-top: 7px; font-size: 12px; line-height: 1.45; }
  .id { font-weight: 700; color: var(--lime); font-family: ui-monospace, SFMono-Regular, Menospace; font-size: 11px; }
  .nums { color: #a8b3ad; font-variant-numeric: tabular-nums; }
  .notes { margin-top: 3px; display: flex; flex-wrap: wrap; gap: 4px; }
  .note {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; font-weight: 700;
    padding: 2px 6px; border-radius: 2px; background: #ffffff1a; color: #d8e2dc;
  }
  .note.bad { background: #ff4d3d; color: #fff; }
</style>
</head>
<body>
<header>
  <h1>Hoja de contactos &middot; siluetas</h1>
  <p class="legend">
    ${total} cartas en el dataset &middot; <b>${rows.length}</b> en esta hoja &middot;
    modo: <b>${mode === "photo" ? "foto en color" : "mascara blanca"}</b> &middot;
    layout <b>${layout}</b> tal cual lo monta AuctionCard.
    Contorno <b style="color:#ff4d3d">rojo</b> = hay que re-curar la foto &middot;
    <b style="color:#c6f833">lima</b> = solo es encuadre.
    Umbrales: aspecto &le;${t.maxAspect}, ancho &le;${t.maxWidth}, alto &ge;${Math.round(
      t.minSubjectHeight * 100,
    )}%, masa ${Math.round(t.minFill * 100)}&ndash;${Math.round(t.maxFill * 100)}%.
  </p>
</header>
<div class="grid">
${cards}
</div>
</body>
</html>
`;
}

/**
 * Hoja de candidatos: una seccion por jugador, con su foto actual a la
 * izquierda y las alternativas de Commons a la derecha.
 *
 * Las alternativas se muestran CRUDAS, sin recortar, sobre el fondo verde de
 * la carta. Es deliberado: el recorte al silhouette lo hace sharp despues, y
 * enseñar un recorte simulado seria mentir sobre lo que se esta eligiendo. Lo
 * que se decide aqui es "este es el jugador y sale solo", que es justo lo que
 * la foto actual falla.
 */
function renderCandidatesPage(
  rows: Row[],
  candidates: Record<
    string,
    Array<{
      file: string;
      url: string;
      thumb: string;
      author: string;
      license: string;
      sourcePage: string;
      year: number | null;
      width: number;
      height: number;
      verified: boolean;
      category: string;
      otherNames?: string[];
      sameEra?: boolean;
      rightTeam?: boolean;
    }>
  >,
): string {
  const sections = rows
    .filter((row) => (candidates[row.player.silhouetteId] ?? []).length > 0)
    .map((row) => {
      const id = row.player.silhouetteId;
      const list = candidates[id]!;
      const current = row.missing
        ? `<div class="current-missing">sin foto ahora</div>`
        : `<img class="current" src="../data/photos/${id}.png" alt="">
           <div class="nums">la que hay ahora &middot; ${row.measurement ? `${row.measurement.width}x512` : ""}</div>`;

      const options = list
        .map((c, i) => {
          const height = c.height > 0 ? c.width / c.height : 0;
          const portrait = height <= 0.95;
          // La miniatura en local si esta descargada; si no, la de Commons.
          // upload.wikimedia.org devuelve 429 en rafagas, y sin el fallback
          // la hoja se queda con huecos justo cuando se esta mirando.
          const local = `thumbs/${thumbName(c.file)}`;
          const src = existsSync(`${OUT_DIR}/${local}`) ? local : c.thumb;
          return `<label class="opt">
            <input type="radio" name="${esc(id)}" value="${i + 1}">
            <span class="num">${i + 1}</span>
            <img class="raw" src="${esc(src)}" alt="" loading="lazy">
            <span class="file">${esc(c.file.replace(/^File:/, ""))}</span>
            <span class="credit">
              ${c.year ? `<b>${c.year}</b> &middot; ` : ""}${c.width}x${c.height}
              &middot; ${esc(c.license)} &middot; ${esc(c.author)}
            </span>
            <span class="tags">
              ${c.rightTeam ? '<span class="tag good">ese equipo</span>' : ""}
              ${c.sameEra ? `<span class="tag good">de ${c.year}</span>` : ""}
              ${portrait ? '<span class="tag good">vertical</span>' : '<span class="tag warn">apaisada</span>'}
              ${(c.otherNames ?? []).length ? `<span class="tag warn">y ${esc(c.otherNames.slice(0, 2).join(", "))}</span>` : ""}
              ${c.verified ? "" : '<span class="tag bad">sin verificar</span>'}
            </span>
          </label>`;
        })
        .join("\n");

      return `<section class="player">
  <header class="phead">
    <h2>${esc(row.player.name)} <span class="yr">${row.player.season}</span></h2>
    <div class="id">${esc(id)}</div>
    <div class="notes">${row.notes.map((n) => `<span class="note ${row.bad ? "bad" : ""}">${esc(n)}</span>`).join("")}</div>
  </header>
  <div class="cmp">
    <div class="current-col"><div class="card small"><div class="wedge"></div><div class="band"></div>${current}</div></div>
    <div class="opts">${options}</div>
  </div>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Candidatos de foto &middot; Puja el Once</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink:#12100f; --green:#16c64f; --lime:#c6f833; --deep:#0b3d2e; --danger:#ff4d3d;
    --mute:#a8b3ad;
  }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--deep); color:#fff; font-family:Barlow, system-ui, sans-serif; padding:20px 24px 80px; }
  h1 { font-family:"Barlow Condensed",sans-serif; text-transform:uppercase; font-weight:900; font-size:32px; letter-spacing:-.02em; }
  .intro { color:var(--mute); font-size:14px; max-width:70ch; margin:8px 0 26px; line-height:1.55; }
  .intro b { color:var(--lime); }

  .player { border-top:1px solid #ffffff26; padding:20px 0 26px; }
  .phead { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
  .phead h2 { font-family:"Barlow Condensed",sans-serif; text-transform:uppercase; font-weight:800; font-size:23px; letter-spacing:-.01em; }
  .yr { color:var(--green); }
  .id { font-family:ui-monospace,Menlo,monospace; font-size:11px; color:var(--lime); }
  .notes { display:flex; gap:4px; flex-wrap:wrap; }
  .note { font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; font-weight:700; padding:2px 6px; background:#ffffff1a; color:#d8e2dc; }
  .note.bad { background:var(--danger); color:#fff; }

  .cmp { display:grid; grid-template-columns:190px minmax(0,1fr); gap:20px; align-items:start; }

  /* La carta, a la izquierda: mismo marco que en index.html. */
  .card { position:relative; aspect-ratio:3/4; width:100%; overflow:hidden; background:var(--green); container-type:inline-size; }
  .wedge { position:absolute; top:0; height:100%; width:40%; right:-6rem; background:var(--lime); transform:skewX(-18deg); }
  .band { position:absolute; inset-inline:0; bottom:0; height:25%; background:var(--deep); }
  .current { position:absolute; top:-1.5rem; right:6%; height:112%; width:auto; object-fit:contain; object-position:bottom; }
  .current-missing { position:absolute; inset:0; display:grid; place-items:center; font-family:"Barlow Condensed",sans-serif; text-transform:uppercase; font-weight:800; color:#0a5c33; font-size:17px; text-align:center; padding:0 10px; }
  .nums { color:var(--mute); font-size:11px; margin-top:5px; }

  /* Los candidatos, CRUDOS. Sin recorte, a proposito. */
  .opts { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
  .opt { position:relative; display:flex; flex-direction:column; gap:5px; padding:9px; background:#ffffff0d;
         border:2px solid transparent; cursor:pointer; }
  .opt:hover { background:#ffffff1a; }
  .opt:has(input:checked) { border-color:var(--lime); background:#c6f83314; }
  .opt input { position:absolute; top:9px; left:9px; accent-color:var(--lime); width:17px; height:17px; }
  .num { position:absolute; top:8px; right:8px; font-family:"Barlow Condensed",sans-serif; font-weight:900;
         font-size:19px; color:var(--lime); background:#000000a6; padding:0 8px; line-height:1.35; }
  .raw { width:100%; height:170px; object-fit:contain; background:#0f2a20; }
  .file { font-size:11.5px; line-height:1.3; color:#fff; word-break:break-word; }
  .credit { font-size:10.5px; line-height:1.35; color:var(--mute); overflow-wrap:anywhere; }
  .credit b { color:var(--green); }
  .tags { display:flex; gap:4px; flex-wrap:wrap; margin-top:auto; }
  .tag { font-size:9.5px; text-transform:uppercase; font-weight:700; letter-spacing:.05em; padding:2px 6px; }
  .tag.good { background:#16c64f2e; color:#7ff0a8; }
  .tag.warn { background:#c6f83326; color:var(--lime); }
  .tag.bad  { background:var(--danger); color:#fff; }
  .opt:has(input:checked) .raw { outline:2px solid var(--lime); }
</style>
</head>
<body>
<h1>Candidatos de foto</h1>
<p class="intro">
  Una seccion por jugador con la foto que tiene <b>ahora</b> a la izquierda. A la derecha,
  las alternativas que devuelve Wikimedia Commons para el mismo jugador, <b>sin recortar</b>:
  el recorte al silhouette lo hace el pipeline despues, y ensenar aqui un recorte ya
  simulado seria mentir sobre lo que se elige. Lo que hay que decidir es
  <b>"este es el jugador y sale solo"</b>.
  <br>Marca la casilla de la que quieras y el numero es lo que hay que decirme.
  <b>Vertical</b> encaja mejor en la carta; <b>apaisada</b> suele ser foto de grupo.
</p>
${sections}
</body>
</html>
`;
}

function renderCard(row: Row, mode: Mode): string {
  const { player, measurement, missing, notes, bad } = row;
  const cls = bad ? "bad" : notes.length > 0 ? "warn" : "";

  // Sin foto no hay ni silueta ni foto en color: se muestra el hueco, que es
  // justo lo que vera el jugador en la web.
  const img = missing
    ? `<div class="empty">sin foto</div>`
    : `<img class="cut" src="../data/${mode === "photo" ? "photos" : "silhouettes"}/${player.silhouetteId}.png" alt="">`;

  const numbers = measurement
    ? `<span class="nums">${measurement.width}x512 &middot; aspecto ${measurement.aspect.toFixed(
        2,
      )} &middot; alto ${Math.round(measurement.subjectHeight * 100)}% &middot; masa ${(
        measurement.fill * 100
      ).toFixed(0)}%</span>`
    : `<span class="nums">&mdash;</span>`;

  return `  <div class="cell ${cls}">
    <figure class="card">
      <div class="wedge"></div>
      <div class="band"></div>
      ${img}
      <figcaption class="panel">
        <p class="p-first">${esc(player.name.split(" ")[0])}</p>
        <p class="p-last">${esc(player.name.split(" ").slice(1).join(" ") || player.name)}</p>
        <p class="p-season">${player.season}</p>
      </figcaption>
    </figure>
    <div class="meta">
      <div class="id">${esc(player.silhouetteId)}</div>
      ${numbers}
      ${notes.length ? `<div class="notes">${notes.map((n) => `<span class="note ${bad ? "bad" : ""}">${esc(n)}</span>`).join("")}</div>` : ""}
    </div>
  </div>`;
}

await build();
