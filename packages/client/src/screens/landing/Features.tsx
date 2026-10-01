import { ArrowLeftRight, Camera, Lock, PartyPopper, Trophy, Vote } from "lucide-react";
import { CONTAINER, SectionTitle } from "./ui.js";

const FEATURES = [
  {
    icon: Lock,
    title: "Salas con código",
    body: "Privadas con un código de cinco letras, o públicas para que entre quien quiera.",
  },
  {
    icon: Camera,
    title: "La foto de esa temporada",
    body: "Cuando cae la silueta aparece el jugador tal como era ese año, con su club.",
  },
  {
    icon: PartyPopper,
    title: "Reacciones en vivo",
    body: "Celebra un robo o señala el fichaje ruinoso sin salir de la puja.",
  },
  {
    icon: Vote,
    title: "Paso y voto de salto",
    body: "Si una carta no convence, la mesa puede pasarla. Hace falta unanimidad.",
  },
  {
    icon: ArrowLeftRight,
    title: "Intercambio de cartas",
    body: "Propón un cambio a otro jugador durante la partida; lo acepta o lo rechaza.",
  },
  {
    icon: Trophy,
    title: "Ceremonia final",
    body: "Los ratings se destapan puesto a puesto y se corona al mejor once.",
  },
];

export function Features() {
  return (
    <section aria-labelledby="features-title" className="pitch-stripes">
      <div className={`${CONTAINER} py-20 sm:py-24`}>
        <SectionTitle id="features-title" tone="light">Lo que trae cada partida</SectionTitle>
        <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-5">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-pitch shadow-[0_14px_30px_-18px_rgba(0,0,0,.45)]">
                <Icon className="h-6 w-6" aria-hidden="true" strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="font-headline text-[1.05rem] font-semibold tracking-[-0.02em] text-white">{title}</h3>
                <p className="mt-2 font-copy text-[1.05rem] leading-[1.55] text-white/85">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
