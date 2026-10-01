import { motion, useReducedMotion } from "framer-motion";
import { Coffee, Heart, Trophy, Users, type LucideIcon } from "lucide-react";
import { donateAmountUrl, DONATE_URL } from "../../config/donate.js";
import { DONORS, type Donor } from "../../data/donors.js";
import { CONTAINER, EASE_OUT } from "./ui.js";

/** Cantidades sugeridas, en dolares (paypal.me/usuario/5USD). La ultima opcion deja elegir libremente. */
const TIERS: { amount: number; title: string; note: string; icon: LucideIcon }[] = [
  { amount: 3, title: "Un café", note: "Para el servidor de esta semana", icon: Coffee },
  { amount: 5, title: "Una ronda", note: "Para toda la sala de amigos", icon: Users },
  { amount: 10, title: "Un fichaje", note: "Para cartas y fotos nuevas", icon: Trophy },
];

/** Balón dorado que cae y rebota al entrar en pantalla: es el remate de la sección. */
function BouncingBall({ reduced }: { reduced: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="size-24 drop-shadow-[0_18px_22px_rgba(0,0,0,.35)] sm:size-28"
      initial={reduced ? false : { y: -120, rotate: -140, opacity: 0 }}
      whileInView={{ y: [-120, 0, -28, 0, -9, 0], rotate: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-20% 0px" }}
      transition={{ duration: 1.5, times: [0, 0.4, 0.62, 0.8, 0.92, 1], ease: "easeOut" }}
    >
      <circle cx="16" cy="16" r="14.5" fill="var(--color-gold)" />
      <path d="M16 10.2 21.52 14.21 19.41 20.69H12.59L10.48 14.21Z" fill="var(--color-forest)" />
      <path
        d="M16 10.2V3.4M21.52 14.21l6.6-2.14M19.41 20.69l4.08 5.62M12.59 20.69l-4.08 5.62M10.48 14.21l-6.6-2.14"
        stroke="var(--color-forest)"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </motion.svg>
  );
}

/** Apartado de apoyo voluntario. No se pinta si no hay enlace de PayPal configurado. */
export function Support({ url = DONATE_URL, donors = DONORS }: { url?: string | null; donors?: readonly Donor[] }) {
  const reduced = useReducedMotion() ?? false;
  if (!url) return null;

  const tiers = TIERS.flatMap((tier) => {
    const href = donateAmountUrl(url, tier.amount);
    return href ? [{ ...tier, href }] : [];
  });

  return (
    <section id="apoyar" aria-labelledby="apoyar-title" className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className={`${CONTAINER} !px-0`}
      >
        <div className="on-dark pitch-stripes relative overflow-hidden rounded-[2rem] px-6 py-12 text-white sm:px-12 lg:px-16 lg:py-16">
          {/* Círculo central del campo: de fondo, solo adorno. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 400 400"
            className="pointer-events-none absolute -right-24 -top-28 size-[26rem] text-white/[0.07] sm:size-[32rem]"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
          >
            <circle cx="200" cy="200" r="150" />
            <circle cx="200" cy="200" r="10" fill="currentColor" />
            <path d="M200 50v300" />
          </svg>

          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <BouncingBall reduced={reduced} />
              <p className="mt-6 inline-flex items-center gap-2 font-copy text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-gold">
                <Heart className="size-4" aria-hidden="true" />
                Apoya el proyecto
              </p>
              <h2
                id="apoyar-title"
                className="mt-3 max-w-md text-balance font-headline text-[clamp(1.85rem,3.6vw,2.9rem)] font-semibold leading-[1.1] tracking-[-0.035em]"
              >
                Esta vez, puja por el juego
              </h2>
              <p className="mt-4 max-w-md font-copy text-[1.15rem] leading-[1.55] text-white/85">
                Gratis y sin anuncios, hecho por una sola persona. Tu aportación lo mantiene en pie.
              </p>
            </div>

            <div>
              {tiers.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-3" aria-label="Cantidades sugeridas">
                  {tiers.map(({ amount, title, note, icon: Icon, href }, index) => (
                    <motion.li
                      key={amount}
                      initial={reduced ? false : { opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-10% 0px" }}
                      transition={{ duration: 0.55, ease: EASE_OUT, delay: 0.1 + index * 0.1 }}
                    >
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex h-full cursor-pointer flex-row items-center gap-4 rounded-[1.4rem] bg-canvas p-4 text-forest ring-2 ring-transparent transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_22px_34px_-18px_rgba(0,0,0,.55)] hover:ring-gold focus-visible:ring-gold sm:min-h-[10rem] sm:flex-col sm:items-start sm:gap-0 sm:p-5"
                      >
                        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-gold">
                          <Icon className="size-5" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col sm:mt-4 sm:flex-none">
                          <span className="font-headline text-[1.7rem] font-bold leading-none tracking-[-0.04em] tnum">
                            {amount}
                            <span className="ml-1 text-[0.9rem] font-semibold tracking-normal text-slate">USD</span>
                          </span>
                          <span className="mt-1.5 font-copy text-[1.1rem] font-semibold leading-tight">{title}</span>
                          <span className="font-copy text-[0.95rem] leading-[1.3] text-slate sm:mt-0.5">{note}</span>
                        </span>
                        <span className="sr-only">(se abre PayPal en una pestaña nueva)</span>
                      </a>
                    </motion.li>
                  ))}
                </ul>
              )}

              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${tiers.length > 0 ? "mt-3" : ""} inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-gold px-7 font-copy text-[1.075rem] font-semibold text-forest transition-colors duration-200 hover:bg-[#F5C65C]`}
              >
                <Heart className="size-5" aria-hidden="true" />
                {tiers.length > 0 ? "Otra cantidad con PayPal" : "Donar con PayPal"}
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <h3 className="font-headline text-[0.95rem] font-semibold tracking-[-0.02em] text-gold">La hinchada</h3>
                {donors.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {donors.map((donor) => (
                      <li key={donor.name} className="rounded-full bg-gold px-3.5 py-1 font-copy text-[1rem] font-semibold text-forest">
                        {donor.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-copy text-[1rem] text-white/80">Aquí saldrá tu nombre si quieres.</p>
                )}
              </div>
              <p className="mt-2 font-copy text-[0.95rem] leading-[1.5] text-white/75">
                Tras donar,{" "}
                <a href="/legal/contacto.html" className="font-semibold text-gold underline underline-offset-2">
                  escríbenos
                </a>{" "}
                y sales en la hinchada. Solo si tú lo pides.
              </p>
            </div>
          </div>

          <p className="relative mt-8 border-t border-white/15 pt-5 font-copy text-[0.88rem] leading-[1.5] text-white/65">
            Aportación voluntaria y personal: no da ventajas, no es una entidad benéfica ni es deducible. El pago lo gestiona PayPal.
          </p>
        </div>
      </motion.div>
    </section>
  );
}
