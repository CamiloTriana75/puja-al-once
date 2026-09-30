/**
 * Candidatos de Wikimedia Commons para las cartas cuya foto actual esta mal.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE SCRIPT Y NO find-all-photos.ts
 * ---------------------------------------------------------------------------
 * Aquel devuelve UN resultado, el mejor de un scoring, y en su evaluatePage()
 * los titulos de foto de grupo solo se PENALIZAN con +20 en vez de EXCLUIRSE.
 * "DJ DX DJ Madden Bulls 365.jpg" queda a 20 puntos de un "' vs '" y por tanto
 * gana. Luego busca texto suelto en el namespace de ficheros cuando la categoria
 * "Nombre_in_1998" no existe --que es casi siempre-- y ahi es donde se cuelan
 * memes de ronda, portadas de album y gradas. Aqui el scoring decide el ORDEN,
 * nunca la seleccion, y la seleccion la hace una persona.
 *
 * ---------------------------------------------------------------------------
 * POR QUE HAY QUE VERIFICAR LA CATEGORIA CONTRA WIKIDATA
 * ---------------------------------------------------------------------------
 * Comparar por nombre NO es seguro, y hay tres formas distintas de que falle:
 *
 *  1. Homonimos. Buscar "Socrates" devuelve al FILOSOFO: sus 12 ficheros son
 *     cuadros de Rafael y un busto de bronce. Buscar "Rivaldo" devuelve a
 *     Rivaldo Coetzee y a Todd Rivaldo Ferre, que ademas son, los dos,
 *     "association football player" en Wikidata. La ocupacion NO los separa.
 *  2. La tilde. El futbolista brasileno es "Socrates" (Q102331) y el
 *     filosofo "Socrates" (Q8758601). Comparar sin acentos los funde en uno.
 *  3. Ocupaciones ausentes. "Category:Sandro" (Q528780) no declara P106 y es
 *     un futbolista dePrimera. "Sin ocupacion" es INCONCLUYENTE, nunca
 *     "no es futbolista", asi que no puede usarse para descartar.
 *
 * La regla que si funciona es comparar el Q-id EXACTO: se resuelve la categoria
 * del jugador y despues solo se listan ficheros de categorias con ese mismo
 * Q-id. Para eso la categoria se elige buscando la de nombre mas corto entre
 * las que tienen ocupacion futbolistica, que en los tres casos de arriba es la
 * correcta.
 *
 * No escribe nada en data/. Los candidatos quedan en contact-sheets/, que esta
 * en .gitignore, hasta que alguien elija. Una busqueda fallida no rompe nada.
 *
 *   npx tsx scripts/candidate-sheet.ts                 # los marcados
 *   npx tsx scripts/candidate-sheet.ts --only-new      # solo los nuevos
 *   npx tsx scripts/candidate-sheet.ts --id=keane-1999 # uno suelto
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditSilhouettes } from "./audit-silhouettes.js";

const UA =
  "FutboleraDatasetBot/1.0 (https://github.com/CamiloTriana75/subasta-futbolera; dataset-curator)";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA = "https://www.wikidata.org/w/api.php";
const DELAY_MS = 1100;
/** Wikidata aguanta peor que Commons. Limite aparte y mas conservador. */
const WD_DELAY_MS = 2500;
const THUMB_WIDTH = 420;
const CACHE = "contact-sheets/wikidata-cache.json";

/**
 * Ocupacion que cuenta como "es Jugador de futbol". Se decide por la ETIQUETA,
 * no por el Q-id, porque hay varias (jugador, entrenador, director) y tenerlas
 * todas escritas aqui seria otra cosa que se queda vieja.
 */
const FOOTBALL = /association football|footballer|football player|football coach|football manager|soccer/i;

/**
 * Palabras que descartan un fichero. Se EXCLUYEN en duro, no se penalizan: es
 * exactamente el error que hace que find-all-photos.ts elija "Andate
 * Passarella! Sos igual a Aguilar!" para Passarella.
 *
 * Solo van aqui las que delatan un LUGAR u OBJETO (escultura, cromo, graffiti,
 * mitin politico) o VARIAS PERSONAS. Deliberadamente NO van las que describen
 * un ACAECIMIENTO --"match", "award", "ceremony", "final", "goal"--
 * porque en un titulo asi cabe un retrato individual legitimo y se perdia:
 * "25th Laureus World Sports Awards - Red Carpet - Marcel Desailly" es
 * Desailly solo y de cuerpo entero, y "Marcel Desailly 1Goal" es un
 * individual. Los ficheros de partido que si sobran los saca el filtro de
 * nombre, porque el titulo no suele llevar el apellido del jugador.
 */
const REJECT = [
  "team", "celebration", "stadium", "fans", "crowd", "supporters",
  "podium", "bench", "wallpaper", "poster", "cover", "album", "single",
  "dvd", "disc", "portada", "el grafico", "grafico", "book", "panini",
  "sticker", "card_", "meme", "joke", "comic", "cartoon", "montage",
  "collage", "panorama", "aerial", "wide", "group", "lineup", "squad",
  "eleven", "team_", "training", "session", "shirtless", "nude", "statue",
  "monument", "plaque", "autograph", "signature", "stamp", "coin", "kit_",
  "shirt", "jersey", "number", "logo", "flag", "banner", "painting",
  "bust", "statuary", "drawing", "engraving", "fresco", "sculpture",
  "memorial", "panel", "graffiti", "wall", "relief", "coffin", "tomb",
  "grave", "hunedoara", "placa", "huellas", "footprint", "olymp", "rally",
  "protest", "huelga", "politico", "militante", "panfleto", "cartel",
  "acto", "moving", "manifest",
  // "Yaya Toure pictured with a fan in 2018": hay jugador, pero no sale solo.
  "pictured with", "with a fan", "with fans", "con un fan", "fan in",
  "selfie", "caricature",
  // Autores homonimos: "Self Portrait by Andrew Robertson" y "Andrew Robertson,
  // vers 1866" son el pintor escoces del XIX, no el futbolista del Liverpool.
  // "vers 18" caza "vers 1866"; "self portrait" caza cualquier autorretrato.
  "self portrait", "vers 18",
  // Mas homonimos: el pintor Andrew Robertson (1763-1845) deja sus retratos
  // colgados en museos ("Mrs", "Lady", "Portrait of", Yale, Smithsonian,
  // Nationalmuseum) y su bota firmada sale como "Nike Phantom...". El apellido
  // es el mismo, el jugador no.
  "portrait of", "mrs", "lady ", "museum", "gallery", "nationalmuseum", "yale",
  "smithsonian", "boot", "phantom", "firm ground",
  // Autografo y cromo de coleccion: hay jugador escrito, no hay jugador.
  "unterschrift", "autogramm", "400pcs", "pcs-",
  // "Austria vs. Germany": con punto no lo cazaba " vs ".
  " vs.", " vs ", " v ",
];

/**
 * Palabras en MAYUSCULAS que NO son un segundo nombre de persona: son
 * vocabulario de evento. Sirven para que el filtro de "hay otro jugador en el
 * titulo" no se lleve por delante "Red Carpet", "Press Conferences" o
 * "Sports Awards", que son sitios donde el jugador sale solo.
 */
const NOT_A_NAME = new Set([
  "red", "carpet", "press", "conference", "conferences", "introductory",
  "awards", "award", "world", "sports", "sport", "cup", "league", "final",
  "game", "match", "friendly", "frendly", "qualification", "qualifying",
  "the", "of", "in", "at", "on", "with", "and", "de", "la", "el", "del",
  "for", "during", "after", "before", "official", "premier", "champions",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december", "fc", "afc", "sc", "utc",
  "club", "united", "city", "deportivo", "real", "olympique", "bayern",
  // Palabras de plantilla de Commons, no nombres.
  "cropped", "thumb", "version", "full", "original", "square",
]);

/** Nombres por los que Commons puede conocer al jugador. Primero el bueno. */
const NAMES: Record<string, string[]> = {
  "baggio-1994": ["Roberto Baggio"],
  "batistuta-1998": ["Gabriel Batistuta"],
  "benzema-2022": ["Karim Benzema"],
  "best-1968": ["George Best"],
  "bergomi-1982": ["Giuseppe Bergomi"],
  "bobby-moore-1966": ["Bobby Moore footballer", "Bobby Moore"],
  "buffon-2003": ["Gianluigi Buffon"],
  "busquets-2015": ["Sergio Busquets"],
  "cancelo-2021": ["João Cancelo", "Joao Cancelo"],
  "cristiano-2008": ["Cristiano Ronaldo"],
  "de-bruyne-2020": ["Kevin De Bruyne"],
  "desailly-1998": ["Marcel Desailly"],
  "di-maria-2014": ["Ángel Di María", "Ángel Di Maria", "Angel Di Maria"],
  "dida-2005": ["Dida footballer", "Dida"],
  "dzajic-1968": ["Dragan Džajić", "Dragan Dzajic"],
  "essien-2007": ["Michael Essien"],
  "eusebio-1966": ["Eusebio"],
  "fabregas-2010": ["Cesc Fàbregas", "Cesc Fabregas"],
  "facchetti-1968": ["Giacinto Facchetti footballer", "Giacinto Facchetti"],
  "garrincha-1962": ["Garrincha"],
  "gento-1960": ["Paco Gento", "Francisco Gento"],
  "godin-2014": ["Diego Godín", "Diego Godin"],
  "hagi-1994": ["Gheorghe Hagi"],
  "hazard-2021": ["Eden Hazard"],
  "iniesta-2012": ["Andrés Iniesta", "Andres Iniesta"],
  "jairzinho-1970": ["Jairzinho"],
  "jordi-alba-2015": ["Jordi Alba"],
  "kante-2018": ["N'Golo Kanté", "NGolo Kante"],
  "keane-1999": ["Roy Keane"],
  "koeman-1990": ["Ronald Koeman"],
  "kroos-2018": ["Toni Kroos"],
  "lizarazu-2001": ["Bixente Lizarazu"],
  "maicon-2010": ["Maicon Sisenando", "Maicon Douglas"],
  "mane-2019": ["Sadio Mané", "Sadio Mane"],
  "mascherano-2014": ["Javier Mascherano"],
  "matthaus-1990": ["Lothar Matthäus", "Lothar Matthaus"],
  "messi-2015": ["Lionel Messi"],
  "navas-2016": ["Keylor Navas footballer", "Keylor Navas"],
  "nilton-santos-1962": ["Nílton Santos", "Nilton Santos"],
  "passarella-1978": ["Daniel Passarella"],
  "pirlo-2015": ["Andrea Pirlo"],
  "platini-1984": ["Michel Platini"],
  "rivaldo-2008": ["Rivaldo"],
  "robertson-2019": ["Andrew Robertson"],
  "roberto-carlos-2007": ["Roberto Carlos"],
  "ronaldo-nazario-1997": ["Ronaldo Nazário", "Ronaldo Luís Nazário"],
  "scirea-1982": ["Gaetano Scirea"],
  "seedorf-2003": ["Clarence Seedorf"],
  "son-2021": ["Son Heung-min", "Son Heungmin"],
  "stoichkov-1994": ["Hristo Stoichkov"],
  "theo-hernandez-2021": ["Theo Hernández", "Theo Hernandez"],
  "thuram-1998": ["Lilian Thuram"],
  "trent-2019": ["Trent Alexander-Arnold"],
  "van-basten-1989": ["Marco van Basten"],
  "van-der-sar-2008": ["Edwin van der Sar"],
  "vandijk-2019": ["Virgil van Dijk"],
  "vidic-2011": ["Nemanja Vidic footballer", "Nemanja Vidic"],
  "walker-2025": ["Kyle Walker"],
  "walter-samuel-2010": ["Walter Samuel"],
  "xavi-2010": ["Xavi Hernández", "Xavi"],
  "yashin-1963": ["Lev Yashin"],
  "yaya-toure-2018": ["Yaya Touré", "Yaya Toure"],
};

/**
 * Lo que la carta pide de MAS, cuando la season no basta.
 *
 * Solo se rellena donde se dijo "de ese año" o "de ese equipo": para
 * busquets-2015 lo pedido es el Barça de 2015, y para cristiano-2008 el
 * United de 2008. En el resto la ventana de años sale de la propia season, con
 * un margen de uno, asi que no hace falta escribirla aqui.
 */
const TEAMS: Record<string, string[]> = {
  "busquets-2015": ["barcelona", "barça", "barca", "fcb"],
  "cristiano-2008": ["manchester united", "man united", "united", "utd"],
};

interface Candidate {
  silhouetteId: string;
  file: string;
  url: string;
  thumb: string;
  author: string;
  license: string;
  sourcePage: string;
  year: number | null;
  width: number;
  height: number;
  aspect: number;
  category: string;
  /** La categoria se resolvio contra Wikidata; false = candidatos sin verificar. */
  verified: boolean;
  /** Otros nombres propios del titulo: aviso, no descarte. */
  otherNames: string[];
  /** El año declarado cae en la season de la carta (+/- 1). */
  sameEra: boolean;
  /** El titulo o la categoria nombran al equipo pedido para esa carta. */
  rightTeam: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Sin acentos y en minusculas, para comparar nombres sin depender de tildes.
 *
 * Ademas quita apostrofos: a Commons "Kante" y "Kante" le dan igual, pero a
 * la comparacion de cadenas no, y "N'Golo Kante" sino no casaba nunca con la
 * variante "ngolo kante" porque entre las dos palabras se colaba la coma.
 * El guion NO se toca aqui, porque en "Walker-Peters" es informacion (es otro
 * jugador) y en "Walker-2023" es decorativo; se mira en mentionsPlayer. */
function strip(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\u2018\u2019]/g, "")
    .toLowerCase();
}

/**
 * Si el titulo habla del jugador.
 *
 * La variante se casa como SECUENCIA de palabras, no como substring: con
 * substring, el titulo "Kyle Walker-Peters 2207" pasaba porque contiene
 * "Kyle Walker", pero Walker-Peters es OTRO jugador (Southampton).
 *
 * Los apellidos compuestos con guion son exactamente esa trampa, y el corte
 * es el guion + letra: "Walker-Peters" se rechaza porque tras "walker" viene
 * "-p", pero "Walker-2023" se acepta porque tras "walker" viene "-2". Un guion
 * delante de un numero es decorativo de fichero; un guion delante de letra es
 * un apellido de mas.
 */
function mentionsPlayer(file: string, variants: string[]): boolean {
  const hay = strip(file);
  // El guion se vuelve espacio para la secuencia, y despues se revisa aparte.
  const variantsNorm = variants.map((v) => v.replace(/[^a-z0-9]+/g, " "));
  const window = ` ${hay.replace(/[^a-z0-9]+/g, " ")} `;

  for (let i = 0; i < variants.length; i++) {
    if (!window.includes(` ${variantsNorm[i]} `)) continue;
    const lastWord = variants[i].split(" ").pop()!;
    // Apellido compuesto con guion + letra: no es el jugador.
    if (new RegExp(`\\b${lastWord}-(?=[a-z])`).test(hay)) return false;
    return true;
  }
  return false;
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseYear(value: string): number | null {
  const m = value.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Formas en las que puede aparecer el nombre del jugador en un titulo.
 *
 * El corte de 4 caracteres descarta "sar" y "son", demasiado genericos. Los
 * apellidos con particula vienen partidos --"van der sar", "de bruyne", "roberto
 * carlos"--, asi que se anaden las ultimas 2 y 3 palabras y no solo la ultima.
 *
 * El corte es de longitud del TROZO, no de numero de palabras: con "> take",
 * "Marcel Desailly" se quedaba sin variante de dos palabras y se perdia
 * "MarcelDesailly.JPG", que es justo el unico retrato suelto que hay de el en
 * Commons (todo lo demas es la foto de equipo del 98 compartida con Lizarazu).
 */
function nameVariants(name: string): string[] {
  const tokens = strip(name).split(/[^a-z0-9]+/).filter(Boolean);
  const out = new Set<string>();
  if (tokens.join(" ").length >= 4) out.add(tokens.join(" "));
  for (const take of [2, 3]) {
    const tail = tokens.slice(-take).join(" ");
    if (tokens.length >= take && tail.length >= 4) out.add(tail);
  }
  return [...out];
}

/** Extensiones que son foto o dibujo. Un .webm de una entrevista no lo es. */
const IMAGE_EXT = /\.(jpg|jpeg|png|tif|tiff|webp)$/i;

/**
 * Nombres propios ajenos al jugador que aparecen en el titulo.
 *
 * NO descarta el fichero, lo MARCA. Con el recorte se pierde el contexto, asi
 * que "Eden Hazard na Copa do Mundo de 2018" puede ser un retrato entero y
 * util, y "Weimann Drogba Yaya Toure" es claramente tres personas. Distinguir
 * uno de otro a ojo de titulo no es fiable, asi que la decision es de quien
 * mira: se ensena todo y se avisa.
 *
 * Dos detalles que importan y que salen mal si se olvidan: el prefijo "File:"
 * no es una palabra del titulo, y hay que partir POR LETRAS CON TILDE, porque
 * "Matthaus" partido con [^a-z0-9] sale "Matth" + "us" y contaba como un
 * segundo jugador.
 */
export function otherNamesInTitle(file: string, variants: string[]): string[] {
  const variantWords = new Set(variants.flatMap((v) => v.split(/[^a-z0-9]+/)));
  return file
    .replace(/^File:/i, "")
    .replace(/_/g, " ")
    .split(/[^A-Za-z0-9\u00C0-\u024F]+/)
    .filter(Boolean)
    .filter(
      (word) =>
        word.length >= 3 &&
        /[A-Z]/.test(word) &&
        !NOT_A_NAME.has(strip(word)) &&
        !variantWords.has(strip(word)),
    );
}

function rejectReason(
  file: string,
  width: number,
  height: number,
  variants: string[],
): string | null {
  if (!IMAGE_EXT.test(file)) return "no es una imagen";
  const lower = ` ${strip(file).replace(/_/g, " ")} `;
  for (const word of REJECT) {
    if (lower.includes(word)) return `titulo con "${word.trim()}"`;
  }
  // En Commons "Nombre A and Nombre B" es la convencion para dos personas en
  // el mismo fichero. Salieron 11 de estos ("Roy Keane and Chris Hughton"),
  // que es justo la clase de foto que hay que evitar: entra el que se busca,
  // pero el recorte deja medio cuerpo de otro. El " e " es el conector
  // portugues: "Rivaldo e Juninho Pernambucano".
  if (/\band\b|\by\b|&| e | und | et /.test(lower)) return "titulo con dos personas";
  if (width < 250 || height < 300) return "demasiado pequena";
  return null;
}

// ---------------------------------------------------------------------------
// Wikidata, con cache en disco. Sin cache, re-resolver las mismas 21 cartas
// vuelve a pedir las mismas 60 entidades y choca con el rate limit de Wikidata.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;
let cache: Json = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
let dirty = false;

function cacheGet<T>(key: string): T | undefined {
  return cache[key] as T | undefined;
}

function cacheSet(key: string, value: unknown): void {
  cache[key] = value;
  dirty = true;
}

function saveCache(): void {
  if (!dirty) return;
  const dir = resolve("contact-sheets");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache, null, 2) + "\n");
}

async function getJson(url: URL): Promise<any> {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 || res.status >= 500) {
      await sleep((attempt + 1) * 5000);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // Wikidata contesta con texto plano "You are making too many requests"
    // en vez de un 429 cuando te pasa por alto. Si no empieza por "{", no es JSON.
    if (!text.trim().startsWith("{")) throw new Error(`respuesta no JSON: ${text.slice(0, 60)}`);
    return JSON.parse(text);
  }
  throw new Error("sin respuesta tras 4 intentos");
}

async function commonsApi(params: Record<string, string>): Promise<any> {
  const url = new URL(COMMONS);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("format", "json");
  return getJson(url);
}

async function wikidataEntities(ids: string[]): Promise<Record<string, any>> {
  const missing = ids.filter((id) => cacheGet(`wd:${id}`) === undefined);
  if (missing.length > 0) {
    const url = new URL(WIKIDATA);
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("props", "claims|labels");
    url.searchParams.set("languages", "en");
    url.searchParams.set("format", "json");
    url.searchParams.set("ids", missing.join("|"));
    await sleep(WD_DELAY_MS);
    const data = await getJson(url);
    for (const id of missing) {
      cacheSet(`wd:${id}`, data.entities?.[id] ?? null);
    }
  }
  const out: Record<string, any> = {};
  for (const id of ids) out[id] = cacheGet(`wd:${id}`) ?? null;
  return out;
}

/** Q-id de Wikidata de una categoria de Commons, o null si no tiene. */
async function categoryQid(category: string): Promise<string | null> {
  const key = `cat:${category}`;
  const hit = cacheGet<string | null>(key);
  if (hit !== undefined) return hit;
  const data = await commonsApi({
    action: "query",
    prop: "pageprops",
    ppprop: "wikibase_item",
    titles: `Category:${category}`,
  });
  const page = Object.values(data.query?.pages ?? {})[0] as any;
  const qid = page?.pageprops?.wikibase_item ?? null;
  cacheSet(key, qid);
  return qid;
}

/**
 * Ocupaciones (P106) de un conjunto de entidades, ya resueltas a etiqueta.
 *
 * NO lee solo de la cache: las entidades que aun no se han pedido se piden
 * antes. Leer sin pedir primero devolviaOccupaciones vacias para todo, con lo
 * que ninguna categoria pasaba el filtro de futbol y todo salia "sin verificar".
 */
async function occupationsOf(qids: string[]): Promise<Record<string, string[]>> {
  const unique = [...new Set(qids)];
  const entities = await wikidataEntities(unique);

  const occupationIds = new Set<string>();
  for (const q of unique) {
    for (const claim of entities[q]?.claims?.P106 ?? []) {
      const v = claim.mainsnak?.datavalue?.value?.id;
      if (v) occupationIds.add(v);
    }
  }

  const labels = occupationIds.size > 0 ? await wikidataEntities([...occupationIds]) : {};
  const out: Record<string, string[]> = {};
  for (const q of unique) {
    out[q] = (entities[q]?.claims?.P106 ?? [])
      .map((c: any) => c.mainsnak?.datavalue?.value?.id as string)
      .filter(Boolean)
      .map((id: string) => labels[id]?.labels?.en?.value ?? id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Resolucion de la categoria correcta del jugador
// ---------------------------------------------------------------------------

/**
 * De un item de CATEGORIA, al jugador del que trata.
 *
 * En Commons no todas las categorias apuntan al jugador. "Category:Socrates"
 * va directa a Socrates (Q8758601) y se puede leer su ocupacion ahi. Pero
 * "Category:Cristiano Ronaldo" apunta a Q34037960, que es el item de la
 * PROPIA CATEGORIA, y ese no tiene ninguna P106: sin este salto, Cristiano
 * salia como "sin verificar" porque no habia occupation que leer.
 *
 * El item de la categoria declara de quien trata con P301 ("main topic") o
 * P1424 ("topic's main category"). Con un salto basta; no hace falta seguir
 * mas, y a mas saltos mas riesgo de aterrizar en el homonimo equivocado.
 */
async function mainTopicOf(qids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(qids)];
  const entities = await wikidataEntities(unique);

  const hop = new Map<string, string>();
  for (const q of unique) {
    const claims = [
      ...(entities[q]?.claims?.P301 ?? []),
      ...(entities[q]?.claims?.P1424 ?? []),
    ];
    const target = claims
      .map((c: any) => c.mainsnak?.datavalue?.value?.id as string)
      .find((id) => Boolean(id) && id !== q);
    hop.set(q, target ?? q);
  }

  const targets = [...new Set([...hop.values()])].filter((t) => !unique.includes(t));
  if (targets.length === 0) return Object.fromEntries(hop);

  const targetEntities = await wikidataEntities(targets);
  const out: Record<string, string> = {};
  for (const [q, t] of hop) {
    // Si el destino no existe en Wikidata, el item de la categoria es el
    // jugador (caso normal) y se queda como estaba.
    out[q] = t === q || targetEntities[t]?.id === undefined ? q : t;
  }
  return out;
}

interface Resolved {
  category: string;
  qid: string | null;
  /** Q-id del JUGADOR, que puede ser el del item de la categoria o el de P301. */
  topic: string | null;
  verified: boolean;
}

/**
 * Busca la categoria que SI es del jugador entre las que devuelve la busqueda.
 *
 * Descarta primero las que tienen ocupacion declarada y ninguna es futbol
 * (asi fuera el filosofo y "Roberto Carlos Cortes"), y entre las que quedan
 * elige la de nombre mas corto (asi fuera a "Rivaldo Coetzee" y a
 * "Todd Rivaldo Ferre", que son futbolista pero no NUESTRO futbolista").
 */
async function resolveCategory(name: string): Promise<Resolved | null> {
  const data = await commonsApi({
    action: "query",
    list: "search",
    srsearch: name,
    srnamespace: "14",
    srlimit: "20",
  });
  const titles = ((data.query?.search ?? []) as any[]).map((h) =>
    String(h.title).replace(/^Category:/, ""),
  );

  const withQid: Array<{ title: string; qid: string }> = [];
  for (const title of titles) {
    const qid = await categoryQid(title);
    if (qid) withQid.push({ title, qid });
  }
  if (withQid.length === 0) return null;

  // Las ocupaciones se leen del JUGADOR, no del item de la categoria: se
  // indexan por el Q-id al que salta P301, que no siempre es el de la categoria.
  const topic = await mainTopicOf(withQid.map((c) => c.qid));
  const occupations = await occupationsOf(Object.values(topic));
  const football = withQid.filter((c) =>
    (occupations[topic[c.qid] ?? c.qid] ?? []).some((label) => FOOTBALL.test(label)),
  );

  // Sin ocupacion futbolistica declarada no se puede asegurar nada: mejor no
  // verificar que verificar mal. "Sandro" (Q528780) entra por aqui.
  if (football.length === 0) return null;

  // Exacto primero, y si no, el mas corto. Para "Roberto Carlos" gana
  // "Roberto Carlos" sobre "Roberto Carlos Cortes"; para "Socrates", "Socrates"
  // sobre "Jose Socrates".
  const canonical = strip(name);
  football.sort((a, b) => {
    const exact = (c: { title: string }) => (strip(c.title) === canonical ? 0 : 1);
    return exact(a) - exact(b) || a.title.length - b.title.length;
  });
  return {
    category: football[0]!.title,
    qid: football[0]!.qid,
    topic: topic[football[0]!.qid] ?? null,
    verified: true,
  };
}

async function categoryFiles(category: string): Promise<string[]> {
  const data = await commonsApi({
    action: "query",
    list: "categorymembers",
    cmtitle: `Category:${category}`,
    cmtype: "file",
    cmlimit: "50",
  });
  return ((data.query?.categorymembers ?? []) as any[]).map((m) => m.title as string);
}

async function subCategories(category: string): Promise<string[]> {
  const data = await commonsApi({
    action: "query",
    list: "categorymembers",
    cmtitle: `Category:${category}`,
    cmtype: "subcat",
    cmlimit: "30",
  });
  return ((data.query?.categorymembers ?? []) as any[]).map((m) =>
    String(m.title).replace(/^Category:/, ""),
  );
}

async function imageInfo(titles: string[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < titles.length; i += 20) {
    const data = await commonsApi({
      action: "query",
      titles: titles.slice(i, i + 20).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiurlwidth: String(THUMB_WIDTH),
    });
    out.push(...(Object.values(data.query?.pages ?? {}) as any[]));
    if (i + 20 < titles.length) await sleep(DELAY_MS);
  }
  return out;
}

/**
 * Candidatos de una carta.
 *
 * Si la categoria se pudo verificar contra Wikidata, solo se listan ficheros de
 * categorias con ESE Q-id (la suya y sus subcategorias, que son las de partido
 * o de templates y siguen siendo del mismo jugador). Si no se pudo verificar,
 * se cae a la busqueda por texto y los candidatos salen marcados como NO
 * verificados, para que quien mire no se fie de ellos.
 */
async function candidatesFor(id: string, name: string, season: number): Promise<Candidate[]> {
  // Las alternativas de NAMES se usan para CASAR ficheros ("Maicon Douglas
  // Sisenando - Inter Mailand.jpg" no contiene "Maicon Sisenando" seguido,
  // pero el fichero es suyo igual) y para BUSCAR ("Maicon Douglas" trae mas
  // que "Maicon Sisenando"). La categoria se resuelve solo con el principal,
  // que es el nombre completo y el menos ambiguo.
  const altNames = NAMES[id] ?? [name];
  const variants = [...new Set(altNames.flatMap(nameVariants))];
  const found = new Map<string, string>();
  let verified = false;

  const resolved = await resolveCategory(name);
  await sleep(DELAY_MS);

  if (resolved) {
    verified = true;
    const queue = [resolved.category];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const cat = queue.shift()!;
      if (seen.has(cat)) continue;
      seen.add(cat);

      // Las subcarpetas que colgaban de la categoria verificada ("Buffon by
      // year", "Godo by year") son del mismo jugador aunque no tengan Q-id
      // propio: heredan el sujeto de la madre. Descartarlas ahi fue lo que
      // dejaba a Buffon con un Canaletto y a Godin con dos fotos de 300px.
      // Lo que NO se admiten son las subcarpetas con Q-id DISTINTO, que son
      // las trampas de homonimo ("Socrates" el filosofo cuelga de su propia
      // raiz, y ahi su Q-id no coincide).
      //
      // Se aceptan tanto el Q-id de la categoria como el del JUGADOR: en
      // Commons las dos cosas existen y depende del jugador de quien enlace
      // cada una ("Category:Cristiano Ronaldo" va al item de la categoria,
      // Q34037960, y el jugador es Q11571).
      const qid = await categoryQid(cat);
      if (qid !== null && qid !== resolved.qid && qid !== resolved.topic) continue;

      for (const f of await categoryFiles(cat)) if (!found.has(f)) found.set(f, cat);
      await sleep(DELAY_MS);

      const catCap = process.argv.includes("--fast") ? 3 : 24;
      if (seen.size < catCap && found.size < 40) {
        for (const sub of await subCategories(cat)) queue.push(sub);
        await sleep(DELAY_MS);
      }
    }
  }

  // La categoria puede estar llena de fotos de partido SIN nombre ("N'Golo
  // Kanté" la categoria son "Chelsea v Swansea", y sus retratos con nombre no
  // cuelgan de ella), asi que la busqueda se casa con ella en cualquier caso.
  // Sin categoria (homonimo suelto) la busqueda es la unica via y sale sin
  // verificar. El tope es propio: si no, 50 fotos de partido llenan el cupo y
  // los retratos con nombre se quedan fuera.
  let additions = 0;
  // Una busqueda por cada nombre alternativo, fusionando todo: "Maicon
  // Sisenando" en Commons casi no da ficheros, "Maicon Douglas" da los de
  // Inter. Las alternativas de ortografia ("Diego Godin" vs "Diego Godin")
  // son redundantes, pero los duplicados se caen solos al fusionar.
  for (const seek of altNames.slice(0, 3)) {
    if (additions >= 25) break;
    const search = await commonsApi({
      action: "query",
      list: "search",
      srsearch: seek,
      srnamespace: "6",
      srlimit: "30",
    });
    for (const hit of (search.query?.search ?? []) as any[]) {
      const title = String(hit.title);
      if (found.has(title)) continue;
      if (!mentionsPlayer(title, variants)) continue;
      found.set(title, verified ? "busqueda" : "busqueda sin verificar");
      if (++additions >= 25) break;
    }
    await sleep(DELAY_MS);
  }

  const pages = await imageInfo([...found.keys()]);
  const out: Candidate[] = [];
  const teams = (TEAMS[id] ?? []).map(strip);

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const file = String(page.title ?? "");
    const width = info.width ?? 0;
    const height = info.height ?? 0;
    const whyReject = rejectReason(file, width, height, variants);
    if (whyReject) continue;
    if (!mentionsPlayer(file, variants)) continue;

    const meta = info.extmetadata ?? {};
    const date = clean(meta.DateTimeOriginal?.value) || clean(meta.DateTime?.value) || file;
    const year = parseYear(date);
    // La ventana es de +/- 1 porque la foto de "el 2015" suele llevar 2014 o
    // 2016 en la fecha, y porque la season de la carta no es un anio exacto.
    const sameEra = year !== null && Math.abs(year - season) <= 1;
    // El equipo se mira en el titulo Y en la categoria, porque hay carpetas
    // enteras por equipo: "Cristiano Ronaldo in 2008" no lo dice en el nombre
    // del fichero, lo dice en la carpeta de la que sale.
    const haystack = strip(`${file} ${found.get(file) ?? ""}`);
    const rightTeam = teams.some((t) => haystack.includes(t));

    out.push({
      silhouetteId: id,
      file,
      url: String(info.url ?? "").split("?")[0],
      // Special:FilePath?width= en vez de info.thumburl: cuando el original es
      // mas pequeno que el ancho pedido, la API devuelve el original entero
      // marcado como "thumbnail_unscaled", y en la hoja algunas salian sin
      // cargar. FilePath devuelve siempre una miniatura real del ancho pedido.
      thumb: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
        file,
      )}?width=${THUMB_WIDTH}`,
      author: (clean(meta.Artist?.value) || "Wikimedia Commons").slice(0, 90),
      license: (clean(meta.LicenseShortName?.value) || "?").slice(0, 40),
      sourcePage: String(info.descriptionurl ?? ""),
      year,
      width,
      height,
      aspect: height > 0 ? width / height : 0,
      category: found.get(file) ?? "",
      verified,
      otherNames: otherNamesInTitle(file, variants).slice(0, 3),
      sameEra,
      rightTeam,
    });
  }

  // Lo que la carta pidio primero: el equipo pedido, luego la season, luego
  // verticales, luego los que declaran anio, luego los mas grandes. El orden es
  // una sugerencia, no una seleccion: el orden ordena, la persona elige.
  out.sort(
    (a, b) =>
      Number(b.rightTeam) - Number(a.rightTeam) ||
      Number(b.sameEra) - Number(a.sameEra) ||
      a.aspect - b.aspect ||
      Number(a.year === null) - Number(b.year === null) ||
      b.width - a.width,
  );
  return out.slice(0, 12);
}

/** Las siluetas sin seguimiento en git son las nuevas de esta tanda. */
function newIds(): Set<string> {
  try {
    const untracked = execSync("git ls-files --others --exclude-standard data/silhouettes", {
      encoding: "utf8",
    });
    return new Set(
      untracked
        .split(/\r?\n/)
        .filter(Boolean)
        .map((p) => p.replace(/^.*\//, "").replace(/\.png$/, "")),
    );
  } catch {
    // Sin git no se puede saber cuales son nuevas. No es motivo para no buscar.
    return new Set();
  }
}

async function main(): Promise<void> {
  const report = await auditSilhouettes();
  const bad = new Set(
    report.problems
      .filter((p) =>
        /misma URL|PNG identico|no describe un cuerpo|mas ancho que alto/.test(p.reason),
      )
      .map((p) => p.id),
  );

  const onlyNew = process.argv.includes("--only-new");
  const single = process.argv.find((a) => a.startsWith("--id="))?.slice(5);
  const idsArg = process.argv.find((a) => a.startsWith("--ids="))?.slice(6);

  let targets = [...bad].filter((id) => NAMES[id]).sort();
  if (idsArg) targets = idsArg.split(",").map((s) => s.trim()).filter(Boolean);
  else if (single) targets = [single];
  else if (onlyNew) {
    const fresh = newIds();
    targets = targets.filter((id) => fresh.has(id));
  }

  const players = JSON.parse(readFileSync("data/players.json", "utf8")) as Array<{
    silhouetteId: string;
    name: string;
    season: number;
  }>;
  const who = new Map(players.map((p) => [p.silhouetteId, p]));

  // Una carta pedida a mano puede no estar marcada por la auditoria y aun asi
  // querer cambiarse. Se avisa, para que se sepa que el cambio entra por
  // peticion y no porque el PNGiese.
  const fueraDeLaAuditoria = targets.filter((id) => !bad.has(id));
  if (fueraDeLaAuditoria.length) {
    console.log(
      `pedidas a mano, la auditoria no las marca: ${fueraDeLaAuditoria.join(", ")}\n`,
    );
  }

  console.log(`${targets.length} cartas\n`);

  const results: Record<string, Candidate[]> = {};
  for (const [index, id] of targets.entries()) {
    const player = who.get(id);
    const name = NAMES[id]?.[0] ?? player?.name ?? id;
    const season = player?.season ?? Number(id.match(/(\d{4})/)?.[1] ?? 0);
    process.stdout.write(`[${index + 1}/${targets.length}] ${name} (${id})... `);
    try {
      const cands = await candidatesFor(id, name, season);
      results[id] = cands;
      const cats = [...new Set(cands.map((c) => c.category.split("/")[0]!))].slice(0, 2);
      console.log(
        cands.length === 0
          ? "SIN CANDIDATOS"
          : `${cands.length}${cands.every((c) => c.verified) ? "" : " (sin verificar)"} de [${cats.join(", ")}]`,
      );
    } catch (err) {
      console.log(`error: ${(err as Error).message}`);
      results[id] = [];
    }
  }
  saveCache();

  const dir = resolve("contact-sheets");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const outPath = `${dir}/candidates.json`;

  // Una corrida de una sola carta no puede pisar las otras veinte: se fusiona
  // con lo que ya habia. Sin esto, "--id=..." dejaba el JSON con una unica
  // entrada y la hoja de candidatos se vaciaba entera.
  const merged = (single || idsArg) && existsSync(outPath)
    ? (JSON.parse(readFileSync(outPath, "utf8")) as Record<string, Candidate[]>)
    : {};
  for (const [id, cands] of Object.entries(results)) merged[id] = cands;
  writeFileSync(outPath, JSON.stringify(merged, null, 2) + "\n");

  const empty = Object.entries(results).filter(([, c]) => c.length === 0).map(([id]) => id);
  const unverified = Object.entries(results)
    .filter(([, c]) => c.length > 0 && c.some((x) => !x.verified))
    .map(([id]) => id);
  console.log(`\n${Object.values(results).reduce((n, c) => n + c.length, 0)} candidatos.`);
  if (unverified.length) console.log(`sin verificar: ${unverified.join(", ")}`);
  console.log(`sin ninguno: ${empty.join(", ") || "ninguna"}`);
}

await main();
