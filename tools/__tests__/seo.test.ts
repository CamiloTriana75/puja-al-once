import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FAQ } from "../../packages/client/src/data/faq.js";

/**
 * Lo que un rastreador ve de este sitio es, casi todo, HTML: el canonical,
 * las etiquetas Open Graph, el title y las respuestas del FAQ. Si eso se
 * rompe (una pagina nueva sin canonical, un %SITE_URL% que se publico
 * literal, un FAQ que el JSON-LD ya no dice igual que la pagina), el sitio
 * sigue funcionando para un humano y deja de indexarse sin que se note.
 * Nada de eso se ve en los tests de la aplicacion, asi que se comprueba
 * aqui, leyendo los ficheros como los lee un bot.
 */
const CLIENT_DIR = resolve(import.meta.dirname, "../../packages/client");

const PUBLIC_PAGES = [
  "actualizaciones.html",
  "legal/terminos.html",
  "legal/privacidad.html",
  "legal/cookies.html",
  "legal/propiedad-intelectual.html",
  "legal/contacto.html",
  "legal/comunidad.html",
  "legal/creditos.html",
] as const;

function readPublicPage(page: string): string {
  return readFileSync(resolve(CLIENT_DIR, "public", page), "utf8");
}

function readIndexHtml(): string {
  return readFileSync(resolve(CLIENT_DIR, "index.html"), "utf8");
}

/** Los bloques JSON-LD sin el <script> que los envuelve. */
function ldJsonBlocks(html: string): string[] {
  return (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? []).map((block) =>
    block.replace(/<script type="application\/ld\+json">|<\/script>/g, ""),
  );
}

describe("SEO de las paginas publicas", () => {
  it.each(PUBLIC_PAGES)("%s tiene title, description, canonical y og:url que cuadran", (page) => {
    const html = readPublicPage(page);
    // El marcador %SITE_URL% lo sustituye el build (resolvePublicHtmlUrls
    // en vite.config.ts); si aparece en el fichero fuente significa que
    // alguien escribio un dominio a mano y se va a desincronizar.
    expect(html).not.toMatch(/href="https?:\/\/subasta-futbolera/);

    const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(70); // mas de 70 y Google recorta

    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? "";
    expect(description.length).toBeGreaterThan(60);
    expect(description.length).toBeLessThanOrEqual(180);

    // Canonical y og:url tienen que ser LA MISMA ruta: si discrepan, el
    // buscador recibe dos señales distintas de cual es la pagina canonica.
    const canonical = html.match(/<link rel="canonical" href="%SITE_URL%\/([^"]+)"/)?.[1];
    const ogUrl = html.match(/<meta property="og:url" content="%SITE_URL%\/([^"]+)"/)?.[1];
    expect(canonical).toBe(page);
    expect(ogUrl).toBe(page);

    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? "";
    const ogDescription = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] ?? "";
    const twitterDescription = html.match(/<meta name="twitter:description" content="([^"]+)"/)?.[1] ?? "";
    // Un mismo contenido con cuatro textos distintos es una fuente de
    // verdad que se contradice sola: el snippet de Google, la tarjeta al
    // compartir y el texto de la pagina dejan de ser lo mismo. Se exige que
    // las tres copias sean la misma cadena.
    expect(ogTitle).toBe(title);
    expect(ogDescription).toBe(description);
    expect(twitterDescription).toBe(description);

    expect(html).toContain('property="og:image" content="%SITE_URL%/og-image.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:title"');
  });

  it.each(PUBLIC_PAGES)("%s declara lang=es y tiene exactamente un h1", (page) => {
    const html = readPublicPage(page);
    expect(html).toContain('<html lang="es">');
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });
});

describe("index.html: datos estructurados y metadatos", () => {
  it("declara VideoGame (sin review inventada) y FAQPage", () => {
    const blocks = ldJsonBlocks(readIndexHtml());
    expect(blocks.some((block) => block.includes('"@type": "VideoGame"'))).toBe(true);
    expect(blocks.some((block) => block.includes('"@type": "FAQPage"'))).toBe(true);
    // aggregateRating/review sin datos reales es motivo de accion manual de
    // Google. Se mira DENTRO del JSON-LD y no en el fichero entero: el
    // comentario de al lado explica justamente por que no estan, asi que un
    // `html.includes` contaria la explicacion como si fuera laReview.
    for (const block of blocks) {
      expect(block).not.toContain("aggregateRating");
      expect(block).not.toContain('"review"');
    }
  });

  it("el JSON-LD del FAQ dice EXACTAMENTE lo que pinta <Faq> en la pagina", () => {
    // Google penaliza el structured data que no coincide con el contenido
    // visible. Las dos copias salen de src/data/faq.ts, pero la del JSON-LD
    // esta escrita a mano en index.html: esto es lo que las mantiene
    // iguales.
    const faqJson = ldJsonBlocks(readIndexHtml()).find((block) => block.includes('"FAQPage"'));
    expect(faqJson).toBeTruthy();

    const parsed = JSON.parse(faqJson!) as {
      mainEntity: { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }[];
    };
    expect(parsed.mainEntity).toHaveLength(FAQ.length);
    parsed.mainEntity.forEach((question, index) => {
      const source = FAQ[index]!;
      expect(question["@type"]).toBe("Question");
      expect(question.name).toBe(source.question);
      expect(question.acceptedAnswer["@type"]).toBe("Answer");
      expect(question.acceptedAnswer.text).toBe(source.answer);
    });
  });

  it("las imagenes del heroe declaran su tamano real (anti-CLS) y alt", () => {
    // El LCP de la portada. Sin width/height el navegador no reserva el hueco
    // y el texto salta al cargar; sin alt la imagen no existe para un
    // rastreador ni para un lector de pantalla.
    const landing = readFileSync(resolve(CLIENT_DIR, "src/screens/Landing.tsx"), "utf8");
    expect(landing).toContain("width={365}");
    expect(landing).toContain("height={512}");
    expect(landing).toContain('fetchPriority="high"');
    expect(landing).toContain('alt="Retrato ilustrativo de Ronaldinho"');
  });

  it("tiene canonical, viewport y theme-color", () => {
    const html = readIndexHtml();
    expect(html).toContain('<link rel="canonical" href="%SITE_URL%/" />');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('name="theme-color"');
  });
});
