import { readFile, writeFile } from "node:fs/promises";

interface NeedCard { cardId: string; name: string; season: number }
interface Source {
  silhouetteId: string;
  url: string;
  author: string;
  license: string;
  sourcePage: string;
  commonsDate?: string;
  verifiedYear?: number | null;
  yearDiff?: number | null;
  curationNote?: string;
}

const DELAY_MS = 1100;
const ALIASES: Record<string, string> = {
  "carlos-alberto-1970": "Carlos Alberto Torres footballer",
  "dida-2005": "Dida footballer",
  "eusebio-1966": "Eusebio footballer",
  "jairzinho-1970": "Jairzinho footballer",
  "maicon-2010": "Maicon Douglas footballer",
  "socrates-1982": "Socrates footballer Brazil",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clean(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function yearOf(value: string): number | null {
  const match = value.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  return match ? Number(match[1]) : null;
}

function isLikelySinglePlayer(title: string, name: string): boolean {
  const lowerTitle = title.toLowerCase();
  const excluded = ["statue", "monument", "team photo", "team", "squad", "versus", " vs ", " v ", "match between", "trophy", "bus", "shirt", "kit", "jersey"];
  if (excluded.some((term) => lowerTitle.includes(term))) return false;
  const tokens = name.toLowerCase().split(/\s+/).filter((token) => token.length >= 4);
  return tokens.some((token) => lowerTitle.includes(token));
}

async function api(params: Record<string, string>): Promise<any> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { "User-Agent": "fut-subasta-source-curator/1.0" } });
  if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
  return response.json();
}

async function search(name: string): Promise<string[]> {
  const data = await api({
    action: "query", list: "search", srsearch: `intitle:${JSON.stringify(name)}`,
    srnamespace: "6", srlimit: "20", format: "json",
  });
  return (data.query?.search ?? []).map((item: { title: string }) => item.title);
}

async function metadata(title: string): Promise<Source | null> {
  const data = await api({ action: "query", titles: title, prop: "imageinfo", iiprop: "url|size|extmetadata", format: "json" });
  const page = Object.values(data.query?.pages ?? {})[0] as any;
  const info = page?.imageinfo?.[0];
  if (!info || info.width < 250 || info.height < 300) return null;
  const meta = info.extmetadata ?? {};
  const date = clean(meta.DateTimeOriginal?.value ?? meta.DateTime?.value ?? "");
  const verifiedYear = yearOf(date) ?? yearOf(title);
  const author = clean(meta.Artist?.value ?? meta.Credit?.value ?? "");
  const license = clean(meta.LicenseShortName?.value ?? "");
  if (!author || !license || !info.descriptionurl) return null;
  return {
    silhouetteId: "",
    url: String(info.url).split("?")[0],
    author,
    license,
    sourcePage: info.descriptionurl,
    ...(date ? { commonsDate: date } : {}),
    verifiedYear,
  };
}

const cards: NeedCard[] = JSON.parse(await readFile("data/needs-photo.json", "utf8"));
const results: Source[] = [];
for (const [index, card] of cards.entries()) {
  const query = ALIASES[card.cardId] ?? `${card.name} footballer`;
  process.stdout.write(`[${index + 1}/${cards.length}] ${card.name}... `);
  try {
    const titles = await search(query);
    await sleep(DELAY_MS);
    const title = titles.find((candidate) => isLikelySinglePlayer(candidate, card.name));
    if (!title) {
      console.log("sin candidato seguro");
      await sleep(DELAY_MS);
      continue;
    }
    const source = await metadata(title);
    await sleep(DELAY_MS);
    if (!source) {
      console.log(`metadata invalida: ${title}`);
      continue;
    }
    source.silhouetteId = card.cardId;
    source.yearDiff = source.verifiedYear === null || source.verifiedYear === undefined ? null : Math.abs(source.verifiedYear - card.season);
    source.curationNote = `Seleccion manual asistida: titulo de Commons contiene el nombre de ${card.name}; revisar visualmente el recorte antes de publicar.`;
    results.push(source);
    console.log(title);
  } catch (error) {
    console.log(`error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await writeFile("data/new-sources.json", `${JSON.stringify(results, null, 2)}\n`);
console.log(`\n${results.length}/${cards.length} fuentes candidatas guardadas en data/new-sources.json`);