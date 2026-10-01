import { Radio } from "lucide-react";

export interface TickerItem {
  key: string;
  text: string;
  /** "hot" para la noticia que manda (última puja, último fichaje). */
  tone?: "hot" | "plain";
}

/**
 * Cinta de última hora: pujas de la carta en juego y fichajes cerrados. La
 * lista real va una vez para lectores de pantalla; la copia que hace el bucle
 * es decorativa. Con movimiento reducido no se mueve y se desplaza a mano.
 */
export function LiveTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  const row = (hidden: boolean) => (
    <ol aria-hidden={hidden || undefined} aria-label={hidden ? undefined : "Últimas noticias de la subasta"} className="flex shrink-0 items-center">
      {items.map((item) => (
        <li key={`${hidden ? "copy-" : ""}${item.key}`} className="flex items-center gap-4 whitespace-nowrap pr-8 font-copy text-[1rem]">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
          <span className={item.tone === "hot" ? "font-semibold text-gold" : "text-white/85"}>{item.text}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="on-dark fixed inset-x-0 bottom-0 z-30 flex h-12 items-center overflow-hidden border-t border-white/10 bg-forest text-white">
      <p className="relative z-10 flex h-full shrink-0 items-center gap-2 bg-gold px-4 font-copy text-[0.98rem] font-semibold text-forest">
        <Radio className="h-4 w-4" aria-hidden="true" />
        Última hora
      </p>
      <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
        <div className="ticker-track flex w-max pl-6">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}
