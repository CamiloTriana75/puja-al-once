import { readFile, writeFile } from "node:fs/promises";

interface NeedCard {
  cardId: string;
  name: string;
  season: number;
}

interface ImageCandidate {
  title: string;
  url: string;
  sourcePage: string;
  width: number;
  height: number;
  dateStr: string;
  year: number | null;
  yearDiff: number | null;
  artist: string;
  license: string;
  description: string;
}

interface CardSearchResult {
  cardId: string;
  name: string;
  season: number;
  candidates: ImageCandidate[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, " ").trim();
}

function parseYear(str: string): number | null {
  if (!str) return null;
  const match = str.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  return match ? parseInt(match[1]!, 10) : null;
}

async function searchCommons(name: string, season: number): Promise<ImageCandidate[]> {
  // Query with player name and season
  const queries = [
    `"${name}" ${season}`,
    `"${name}"`,
    `${name} ${season}`,
    name,
  ];

  let titles: string[] = [];

  for (const q of queries) {
    const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("list", "search");
    searchUrl.searchParams.set("srsearch", `${q} -statue -státua -estátua -statua -autograph -signature -logo -diagram -flag -kit`);
    searchUrl.searchParams.set("srnamespace", "6");
    searchUrl.searchParams.set("srlimit", "12");
    searchUrl.searchParams.set("format", "json");

    try {
      const res = await fetch(searchUrl.toString(), {
        headers: { "User-Agent": "fut-subasta/0.1 (dataset research tool; personal project)" },
      });
      if (res.ok) {
        const data = await res.json();
        const searchHits = data.query?.search || [];
        for (const hit of searchHits) {
          if (!titles.includes(hit.title)) {
            titles.push(hit.title);
          }
        }
      }
    } catch (err) {
      console.error(`Search error for ${q}:`, err);
    }

    if (titles.length >= 8) break;
    await sleep(200);
  }

  if (titles.length === 0) return [];

  // Filter titles
  titles = titles.filter(t => {
    const lower = t.toLowerCase();
    return (
      (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp")) &&
      !lower.includes("signature") &&
      !lower.includes("autograph") &&
      !lower.includes("statue") &&
      !lower.includes("státua") &&
      !lower.includes("monument") &&
      !lower.includes("logo") &&
      !lower.includes("diagram") &&
      !lower.includes("kit_") &&
      !lower.includes("jersey")
    );
  }).slice(0, 15);

  if (titles.length === 0) return [];

  // Query imageinfo in batch
  const infoUrl = new URL("https://commons.wikimedia.org/w/api.php");
  infoUrl.searchParams.set("action", "query");
  infoUrl.searchParams.set("titles", titles.join("|"));
  infoUrl.searchParams.set("prop", "imageinfo");
  infoUrl.searchParams.set("iiprop", "url|size|extmetadata");
  infoUrl.searchParams.set("format", "json");

  let infoData: any;
  try {
    const res = await fetch(infoUrl.toString(), {
      headers: { "User-Agent": "fut-subasta/0.1 (dataset research tool; personal project)" },
    });
    if (res.ok) {
      infoData = await res.json();
    }
  } catch (err) {
    console.error(`Imageinfo error:`, err);
    return [];
  }

  const pages = infoData?.query?.pages || {};
  const candidates: ImageCandidate[] = [];

  for (const page of Object.values(pages) as any[]) {
    const info = page.imageinfo?.[0];
    if (!info) continue;

    let fileUrl: string = info.url || "";
    // Strip query parameters
    fileUrl = fileUrl.split("?")[0]!;

    const width = info.width || 0;
    const height = info.height || 0;
    if (width < 250 || height < 300) continue;

    const meta = info.extmetadata || {};
    const dateOriginal = meta.DateTimeOriginal?.value || "";
    const dateGeneral = meta.DateTime?.value || "";
    const dateStr = dateOriginal || dateGeneral || "";

    const year = parseYear(dateOriginal) || parseYear(dateGeneral) || parseYear(page.title) || parseYear(fileUrl);
    const artist = cleanHtml(meta.Artist?.value || meta.Credit?.value || "Wikimedia Commons");
    const license = cleanHtml(meta.LicenseShortName?.value || "CC BY-SA");
    const desc = cleanHtml(meta.ImageDescription?.value || "");

    const yearDiff = year !== null ? Math.abs(year - season) : 999;

    candidates.push({
      title: page.title,
      url: fileUrl,
      sourcePage: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      width,
      height,
      dateStr,
      year,
      yearDiff: yearDiff === 999 ? null : yearDiff,
      artist: artist.slice(0, 100),
      license: license.slice(0, 50),
      description: desc.slice(0, 150),
    });
  }

  // Sort candidates
  candidates.sort((a, b) => {
    if (a.yearDiff !== null && b.yearDiff !== null) {
      if (a.yearDiff !== b.yearDiff) return a.yearDiff - b.yearDiff;
    } else if (a.yearDiff !== null) {
      return -1;
    } else if (b.yearDiff !== null) {
      return 1;
    }
    return (b.width * b.height) - (a.width * a.height);
  });

  return candidates;
}

async function main() {
  const needsCards: NeedCard[] = JSON.parse(await readFile("data/needs-photo.json", "utf8"));
  console.log(`Buscando candidatos en Commons para ${needsCards.length} cartas...\n`);

  const results: CardSearchResult[] = [];

  for (let i = 0; i < needsCards.length; i++) {
    const card = needsCards[i]!;
    console.log(`[${i + 1}/${needsCards.length}] ${card.name} (${card.season}) - ${card.cardId}...`);
    try {
      const candidates = await searchCommons(card.name, card.season);
      const top = candidates[0];
      console.log(`  Encontrados: ${candidates.length} candidatos (mejor: ${top?.year ? `año ${top.year} (dif ${top.yearDiff})` : "sin año"} - "${top?.title ?? "ninguno"}")`);
      results.push({
        cardId: card.cardId,
        name: card.name,
        season: card.season,
        candidates,
      });
    } catch (err) {
      console.error(`  Error:`, err);
      results.push({
        cardId: card.cardId,
        name: card.name,
        season: card.season,
        candidates: [],
      });
    }

    await sleep(500);
  }

  await writeFile("data/commons-candidates.json", JSON.stringify(results, null, 2) + "\n");
  console.log(`\n✅ Candidatos guardados en data/commons-candidates.json`);
}

main().catch(console.error);
