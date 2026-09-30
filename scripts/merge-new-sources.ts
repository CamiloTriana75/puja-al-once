import { readFile, writeFile } from "node:fs/promises";

interface Source {
  silhouetteId: string;
  url: string;
  author: string;
  license: string;
  sourcePage: string;
  [key: string]: unknown;
}

const existing: Source[] = JSON.parse(await readFile("data/sources.json", "utf8"));
const found: Source[] = JSON.parse(await readFile("data/found-photos.json", "utf8"));
const overrides: Source[] = [
  {
    silhouetteId: "dida-2005",
    url: "https://upload.wikimedia.org/wikipedia/commons/0/0c/Dida-wikipedia_%28cropped_2%29.png",
    author: "NullReason",
    license: "CC BY-SA 3.0",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Dida-wikipedia_(cropped_2).png",
    commonsDate: "10 May 2012",
    verifiedYear: 2012,
    yearDiff: 7,
    curationNote: "Retrato individual de Dida; sustituye un resultado ambiguo de la búsqueda automática.",
  },
  {
    silhouetteId: "bobby-moore-1966",
    url: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Bobby_Moore_en_1966.jpg",
    author: "Panini",
    license: "Public domain",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Bobby_Moore_en_1966.jpg",
    commonsDate: "1966",
    verifiedYear: 1966,
    yearDiff: 0,
    curationNote: "Imagen individual identificada como Bobby Moore en 1966; fuente Panini en dominio público italiano según Commons.",
  },
  {
    silhouetteId: "facchetti-1968",
    url: "https://upload.wikimedia.org/wikipedia/commons/6/67/Giacinto_Facchetti%2C_Italia%2C_Euro_%2768.jpg",
    author: "Unknown author",
    license: "Public domain",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Giacinto_Facchetti,_Italia,_Euro_%2768.jpg",
    commonsDate: "June 1968",
    verifiedYear: 1968,
    yearDiff: 0,
    curationNote: "Facchetti como capitán de Italia en la Euro 1968; página de Commons clasificada como dominio público.",
  },
  {
    silhouetteId: "thuram-1998",
    url: "https://upload.wikimedia.org/wikipedia/commons/2/24/Lilian_Thuram_-_F%C3%A9vrier_2013.jpg",
    author: "Matthieu Riegler / Kyro",
    license: "CC BY 3.0",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Lilian_Thuram_-_F%C3%A9vrier_2013.jpg",
    commonsDate: "1 February 2013",
    verifiedYear: 2013,
    yearDiff: 15,
    curationNote: "Retrato individual de Lilian Thuram; la foto es posterior a la temporada y se usa por disponibilidad de fuente libre.",
  },
];

const byId = new Map(existing.map((source) => [source.silhouetteId, source]));
for (const source of found) byId.set(source.silhouetteId, source);
for (const source of overrides) byId.set(source.silhouetteId, source);

const newIds = JSON.parse(await readFile("data/needs-photo.json", "utf8")) as Array<{ cardId: string }>;
const merged = [...byId.values()].filter((source) => newIds.some((card) => card.cardId === source.silhouetteId));
await writeFile("data/sources.json", `${JSON.stringify([...existing.filter((source) => !newIds.some((card) => card.cardId === source.silhouetteId)), ...merged].sort((a, b) => a.silhouetteId.localeCompare(b.silhouetteId)), null, 2)}\n`);
console.log(`${merged.length}/${newIds.length} fuentes nuevas incorporadas a data/sources.json`);