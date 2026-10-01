import { ArrowUp } from "lucide-react";
import { Wordmark } from "../../components/Brand.js";
import { CONTAINER } from "./ui.js";

const GROUPS = [
  {
    title: "El juego",
    links: [
      { href: "#como-se-juega", label: "Cómo se juega" },
      { href: "#preguntas", label: "Preguntas frecuentes" },
      { href: "/actualizaciones.html", label: "Actualizaciones" },
      { href: "/legal/creditos.html", label: "Créditos" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terminos.html", label: "Términos" },
      { href: "/legal/privacidad.html", label: "Privacidad" },
      { href: "/legal/cookies.html", label: "Cookies" },
      { href: "/legal/propiedad-intelectual.html", label: "Propiedad intelectual" },
    ],
  },
  {
    title: "Comunidad",
    links: [
      { href: "/legal/comunidad.html", label: "Comunidad" },
      { href: "/legal/contacto.html", label: "Contacto" },
    ],
  },
];

export function SiteFooter({ onTop }: { onTop: () => void }) {
  return (
    <footer className="on-dark bg-forest text-white">
      <div className={`${CONTAINER} grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-20`}>
        <div>
          <Wordmark tone="light" className="text-[1.6rem]" />
          <p className="mt-4 max-w-xs font-copy text-[1.05rem] leading-[1.6] text-white/75">
            Subastas de fútbol a ciegas para grupos de 2 a 4 amigos. Gratis, en el navegador y sin cuentas.
          </p>
        </div>
        {GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="font-headline text-[0.95rem] font-semibold tracking-[-0.01em] text-pitch">{group.title}</h2>
            <ul className="mt-3">
              {group.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex min-h-11 items-center font-copy text-[1.05rem] text-white/80 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className={`${CONTAINER} flex items-center justify-between gap-6 py-5`}>
          <p className="font-copy text-[0.98rem] text-white/70">Para el grupo que nunca se pone de acuerdo.</p>
          <button
            type="button"
            onClick={onTop}
            aria-label="Volver arriba"
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-gold text-forest transition-transform duration-200 hover:-translate-y-0.5"
          >
            <ArrowUp className="h-5 w-5" aria-hidden="true" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </footer>
  );
}
