import { readFile, writeFile } from "node:fs/promises";

interface NeedCard {
  cardId: string;
  name: string;
  season: number;
}

interface FoundPhoto {
  silhouetteId: string;
  url: string;
  author: string;
  license: string;
  sourcePage: string;
  verifiedYear: number | null;
  season: number;
  yearDiff: number | null;
  title: string;
}

const USER_AGENT = "FutSubastaCuration/1.0 (https://github.com/example/fut; dataset-curator)";
const DELAY_MS = 1100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.status === 429 || res.status >= 500) {
        const wait = (attempt + 1) * 3000;
        console.warn(`  [HTTP ${res.status}] esperando ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      await sleep(2000);
    }
  }
}

function cleanHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYear(str: string): number | null {
  if (!str) return null;
  const match = str.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  return match ? parseInt(match[1]!, 10) : null;
}

// Special player category names if different from card name
const SPECIAL_COMMONS_NAMES: Record<string, string[]> = {
  "beckenbauer-1977": ["Franz_Beckenbauer", "Franz Beckenbauer"],
  "buffon-2018": ["Gianluigi_Buffon", "Gianluigi Buffon"],
  "busquets-2023": ["Sergio_Busquets", "Sergio Busquets"],
  "cafu-2006": ["Cafu"],
  "cannavaro-2006": ["Fabio_Cannavaro", "Fabio Cannavaro"],
  "casillas-2016": ["Iker_Casillas", "Iker Casillas"],
  "cech-2018": ["Petr_Čech", "Petr Cech"],
  "cristiano-2023": ["Cristiano_Ronaldo", "Cristiano Ronaldo"],
  "cruyff-1979": ["Johan_Cruijff", "Johan Cruyff"],
  "dani-alves-2021": ["Dani_Alves", "Dani Alves"],
  "drogba-2015": ["Didier_Drogba", "Didier Drogba"],
  "figo-2000": ["Luís_Figo", "Luis Figo"],
  "gerrard-2006": ["Steven_Gerrard", "Steven Gerrard"],
  "hazard-2021": ["Eden_Hazard", "Eden Hazard"],
  "henry-2004": ["Thierry_Henry", "Thierry Henry"],
  "iniesta-2018": ["Andrés_Iniesta", "Andres Iniesta"],
  "jordi-alba-2023": ["Jordi_Alba", "Jordi Alba"],
  "maldini-2003": ["Paolo_Maldini", "Paolo Maldini"],
  "messi-2023": ["Lionel_Messi", "Lionel Messi"],
  "modric-2025": ["Luka_Modrić", "Luka Modric"],
  "neymar-2023": ["Neymar", "Neymar Jr"],
  "pirlo-2015": ["Andrea_Pirlo", "Andrea Pirlo"],
  "ramos-2022": ["Sergio_Ramos", "Sergio Ramos"],
  "ribery-2021": ["Franck_Ribéry", "Franck Ribery"],
  "rivaldo-2008": ["Rivaldo"],
  "robben-2018": ["Arjen_Robben", "Arjen Robben"],
  "roberto-carlos-2007": ["Roberto_Carlos_(footballer)", "Roberto Carlos"],
  "ronaldinho-2006": ["Ronaldinho", "Ronaldinho Gaúcho"],
  "ronaldo-nazario-2009": ["Ronaldo_Nazário", "Ronaldo Luís Nazário de Lima", "Ronaldo (Brazilian footballer)"],
  "thiago-silva-2023": ["Thiago_Silva", "Thiago Silva"],
  "trent-2025": ["Trent_Alexander-Arnold", "Trent Alexander-Arnold"],
  "varane-2023": ["Raphaël_Varane", "Raphael Varane"],
  "walker-2019": ["Kyle_Walker", "Kyle Walker"],
  "walter-samuel-2015": ["Walter_Samuel", "Walter Samuel"],
  "xavi-2014": ["Xavi_Hernández", "Xavi Hernandez"],
  "yaya-toure-2018": ["Yaya_Touré", "Yaya Toure"],
};

async function getCategoryMembers(category: string): Promise<string[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "categorymembers");
  url.searchParams.set("cmtitle", `Category:${category}`);
  url.searchParams.set("cmtype", "file");
  url.searchParams.set("cmlimit", "20");
  url.searchParams.set("format", "json");

  try {
    const data = await fetchWithRetry(url.toString());
    const members = data.query?.categorymembers || [];
    return members.map((m: any) => m.title as string);
  } catch {
    return [];
  }
}

async function searchCommonsTitles(query: string): Promise<string[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", `${query} -statue -státua -estátua -statua -autograph -signature -logo -diagram -flag -kit -drawing`);
  url.searchParams.set("srnamespace", "6");
  url.searchParams.set("srlimit", "15");
  url.searchParams.set("format", "json");

  try {
    const data = await fetchWithRetry(url.toString());
    const hits = data.query?.search || [];
    return hits.map((h: any) => h.title as string);
  } catch {
    return [];
  }
}

async function getImagesMetadata(titles: string[]): Promise<any[]> {
  if (titles.length === 0) return [];
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", titles.slice(0, 20).join("|"));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|extmetadata");
  url.searchParams.set("format", "json");

  try {
    const data = await fetchWithRetry(url.toString());
    const pages = data.query?.pages || {};
    return Object.values(pages);
  } catch {
    return [];
  }
}

function evaluatePage(page: any, targetSeason: number): {
  score: number;
  year: number | null;
  diff: number | null;
  url: string;
  author: string;
  license: string;
  sourcePage: string;
  title: string;
} | null {
  const info = page.imageinfo?.[0];
  if (!info) return null;

  const title: string = page.title || "";
  let fileUrl: string = (info.url || "").split("?")[0]!;
  const lowerUrl = fileUrl.toLowerCase();
  const lowerTitle = title.toLowerCase();

  // Valid extensions
  if (!lowerUrl.endsWith(".jpg") && !lowerUrl.endsWith(".jpeg") && !lowerUrl.endsWith(".png") && !lowerUrl.endsWith(".webp")) {
    return null;
  }

  // Filter unwanted media types
  if (
    lowerTitle.includes("signature") ||
    lowerTitle.includes("autograph") ||
    lowerTitle.includes("statue") ||
    lowerTitle.includes("státua") ||
    lowerTitle.includes("monument") ||
    lowerTitle.includes("logo") ||
    lowerTitle.includes("diagram") ||
    lowerTitle.includes("jersey") ||
    lowerTitle.includes("kit_") ||
    lowerTitle.includes("shirt") ||
    lowerTitle.includes("stamp")
  ) {
    return null;
  }

  const width = info.width || 0;
  const height = info.height || 0;
  if (height < 300 || width < 200) return null;

  const meta = info.extmetadata || {};
  const dateOriginal = meta.DateTimeOriginal?.value || "";
  const dateGeneral = meta.DateTime?.value || "";
  const dateStr = dateOriginal || dateGeneral || "";

  const year = parseYear(dateOriginal) || parseYear(dateGeneral) || parseYear(title) || parseYear(fileUrl);
  const diff = year !== null ? Math.abs(year - targetSeason) : 999;

  let author = cleanHtml(meta.Artist?.value || meta.Credit?.value || "Wikimedia Commons");
  if (author.length > 80) author = author.slice(0, 80);
  if (!author) author = "Wikimedia Commons";

  let license = cleanHtml(meta.LicenseShortName?.value || "CC BY-SA");
  if (license.length > 50) license = license.slice(0, 50);

  const sourcePage = info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`;

  // Score computation: lower is better
  // Base score is year difference * 100
  let score = diff * 100;

  // Bonus if title contains "crop" or "portrait" or player name directly
  if (lowerTitle.includes("crop")) score -= 30;
  if (lowerTitle.includes("portrait")) score -= 20;

  // Penalty if title suggests a group photo / match summary
  if (lowerTitle.includes(" vs ") || lowerTitle.includes(" v ")) score += 20;
  if (lowerTitle.includes("team") || lowerTitle.includes("celebration")) score += 20;

  return {
    score,
    year,
    diff: diff === 999 ? null : diff,
    url: fileUrl,
    author,
    license,
    sourcePage,
    title,
  };
}

async function findPhotoForCard(card: NeedCard): Promise<FoundPhoto | null> {
  const aliases = SPECIAL_COMMONS_NAMES[card.cardId] || [card.name];
  const primaryName = aliases[0]!;

  const candidateTitles = new Set<string>();

  // 1. Try Category:<Name>_in_<Year>
  const exactCat = `${primaryName.replace(/ /g, "_")}_in_${card.season}`;
  const catMembers = await getCategoryMembers(exactCat);
  await sleep(DELAY_MS);
  for (const m of catMembers) candidateTitles.add(m);

  // 2. If nothing, try adjacent years if close (season-1, season+1)
  if (candidateTitles.size === 0) {
    const prevCat = `${primaryName.replace(/ /g, "_")}_in_${card.season - 1}`;
    const nextCat = `${primaryName.replace(/ /g, "_")}_in_${card.season + 1}`;
    const prevMembers = await getCategoryMembers(prevCat);
    await sleep(DELAY_MS);
    for (const m of prevMembers) candidateTitles.add(m);

    if (candidateTitles.size === 0) {
      const nextMembers = await getCategoryMembers(nextCat);
      await sleep(DELAY_MS);
      for (const m of nextMembers) candidateTitles.add(m);
    }
  }

  // 3. Search query if still few candidates
  if (candidateTitles.size < 3) {
    const q1 = `"${aliases[aliases.length - 1]}" ${card.season}`;
    const hits = await searchCommonsTitles(q1);
    await sleep(DELAY_MS);
    for (const h of hits) candidateTitles.add(h);
  }

  // 4. Broad search query if still nothing
  if (candidateTitles.size === 0) {
    const q2 = `"${aliases[aliases.length - 1]}"`;
    const hits2 = await searchCommonsTitles(q2);
    await sleep(DELAY_MS);
    for (const h of hits2) candidateTitles.add(h);
  }

  const titlesArray = [...candidateTitles].slice(0, 15);
  if (titlesArray.length === 0) return null;

  const pages = await getImagesMetadata(titlesArray);
  await sleep(DELAY_MS);

  const evaluated = pages
    .map((p) => evaluatePage(p, card.season))
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (evaluated.length === 0) return null;

  evaluated.sort((a, b) => a.score - b.score);
  const best = evaluated[0]!;

  return {
    silhouetteId: card.cardId,
    url: best.url,
    author: best.author,
    license: best.license,
    sourcePage: best.sourcePage,
    verifiedYear: best.year,
    season: card.season,
    yearDiff: best.diff,
    title: best.title,
  };
}

async function main() {
  const needsCards: NeedCard[] = JSON.parse(await readFile("data/needs-photo.json", "utf8"));
  console.log(`Buscando fotos en Wikimedia Commons para ${needsCards.length} cartas...\n`);

  const results: FoundPhoto[] = [];
  const missing: NeedCard[] = [];

  for (let i = 0; i < needsCards.length; i++) {
    const card = needsCards[i]!;
    process.stdout.write(`[${i + 1}/${needsCards.length}] ${card.name} (${card.season}) [${card.cardId}]... `);

    try {
      const found = await findPhotoForCard(card);
      if (found) {
        console.log(`✅ ${found.title.slice(0, 40)} (año ${found.verifiedYear ?? "?"}, dif ${found.yearDiff ?? "?"})`);
        results.push(found);
      } else {
        console.log(`❌ No encontrado`);
        missing.push(card);
      }
    } catch (err: any) {
      console.log(`⚠️ Error: ${err.message}`);
      missing.push(card);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`RESUMEN: ${results.length}/${needsCards.length} fotos encontradas.`);
  if (missing.length > 0) {
    console.log(`Faltaron ${missing.length}:`, missing.map(m => m.cardId).join(", "));
  }
  console.log("=".repeat(60));

  await writeFile("data/found-photos.json", JSON.stringify(results, null, 2) + "\n");
  console.log(`\nGuardado en data/found-photos.json`);
}

main().catch(console.error);
