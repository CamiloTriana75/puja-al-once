import { motion } from "framer-motion";
import { Heart, Server, Wrench } from "lucide-react";
import { DONATE_URL } from "../../config/donate.js";
import { DONORS, type Donor } from "../../data/donors.js";
import { CONTAINER, EASE_OUT } from "./ui.js";

const USES = [
  { icon: Server, text: "Pagar el servidor para que las salas no se duerman ni se caigan con más gente." },
  { icon: Wrench, text: "Seguir mejorando el juego: fotos de jugadores, cartas nuevas y más modos." },
];

/** Apartado de apoyo voluntario. No se pinta si no hay enlace de PayPal configurado. */
export function Support({ url = DONATE_URL, donors = DONORS }: { url?: string | null; donors?: readonly Donor[] }) {
  if (!url) return null;
  return (
    <section id="apoyar" aria-labelledby="apoyar-title" className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className={`${CONTAINER} !px-0`}
      >
        <div className="grid items-center gap-10 rounded-[2rem] bg-pitch-soft px-6 py-12 ring-1 ring-line sm:px-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16 lg:px-16 lg:py-14">
          <div>
            <p className="inline-flex items-center gap-2 font-copy text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-pine">
              <Heart className="size-4" aria-hidden="true" />
              Apoya el proyecto
            </p>
            <h2
              id="apoyar-title"
              className="mt-4 max-w-xl text-balance font-headline text-[clamp(1.7rem,3.2vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-forest"
            >
              Gratis para ti, y con tu ayuda sigue así
            </h2>
            <p className="mt-5 max-w-lg font-copy text-[1.15rem] leading-[1.6] text-slate">
              Puja el Once es un proyecto independiente, sin anuncios ni cuentas. Si lo disfrutas con tus amigos, puedes dejar una
              aportación voluntaria. No desbloquea nada en el juego, que es igual para todos, pero sí tendrás un hueco en los créditos si quieres.
            </p>
            <div className="mt-8">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-14 cursor-pointer items-center gap-3 rounded-full bg-forest px-7 font-copy text-[1.075rem] font-semibold text-white transition-colors duration-200 hover:bg-[#163A2D]"
              >
                <Heart className="size-5 text-gold" aria-hidden="true" />
                Donar con PayPal
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            </div>
          </div>
          <div>
            <h3 className="font-headline text-[1.05rem] font-semibold tracking-[-0.02em] text-forest">A qué se dedica</h3>
            <ul className="mt-4 space-y-4">
              {USES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-4">
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-pitch ring-1 ring-line">
                    <Icon className="size-5" />
                  </span>
                  <span className="pt-1.5 font-copy text-[1.1rem] leading-[1.5] text-forest">{text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-line">
              <h3 className="font-headline text-[1.05rem] font-semibold tracking-[-0.02em] text-forest">Gracias a quienes ya apoyan</h3>
              {donors.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {donors.map((donor) => (
                    <li key={donor.name} className="rounded-full bg-pitch-soft px-4 py-1.5 font-copy text-[1.02rem] font-medium text-forest">
                      {donor.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 font-copy text-[1.02rem] leading-[1.5] text-slate">Aquí saldrá el nombre de quien apoye el proyecto. Puedes ser el primero.</p>
              )}
              <p className="mt-3 font-copy text-[0.95rem] leading-[1.5] text-slate">
                ¿Quieres aparecer? Tras donar, <a href="/legal/contacto.html" className="font-semibold text-pine underline underline-offset-2">escríbenos</a> con el nombre que prefieras. Solo se publica si tú lo pides.
              </p>
            </div>
            <p className="mt-6 font-copy text-[0.95rem] leading-[1.5] text-slate">
              Es una aportación personal para costear y desarrollar el juego: no es una entidad benéfica ni la donación es deducible. El pago lo gestiona
              PayPal; nosotros no vemos tus datos de pago.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
