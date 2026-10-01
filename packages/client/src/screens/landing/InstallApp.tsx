import { motion, useReducedMotion } from "framer-motion";
import { EllipsisVertical, Plus, Share, SquarePlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { promptInstall, useInstallMode, type InstallMode } from "../../pwa/install.js";
import { CONTAINER, EASE_OUT, PillButton } from "./ui.js";

/** Pantalla de inicio de mentira: el icono del juego entre otras apps, para que se entienda qué se instala. */
function HomeScreen() {
  const reduced = useReducedMotion() ?? false;
  const ghost = "aspect-square rounded-[1.1rem] bg-white/10";
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-[15rem] rounded-[2rem] border border-white/15 bg-white/[0.06] p-5">
      <div className="grid grid-cols-3 gap-x-4 gap-y-5">
        <div className={ghost} />
        <div className={ghost} />
        <div className={ghost} />
        <div className={ghost} />
        <motion.div
          initial={reduced ? false : { scale: 0.6, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, margin: "-20% 0px" }}
          transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.25 }}
          className="relative"
        >
          <img
            src="/icons/icon-192.png"
            alt=""
            width={192}
            height={192}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full rounded-[1.1rem] shadow-[0_10px_24px_-8px_rgba(0,0,0,.6)] ring-2 ring-gold"
          />
          <span className="mt-1.5 block text-center font-copy text-[0.7rem] font-semibold leading-none text-white">Puja el Once</span>
        </motion.div>
        <div className={ghost} />
        <div className={ghost} />
        <div className={ghost} />
        <div className={ghost} />
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold font-headline text-[0.85rem] font-semibold text-forest"
      >
        {n}
      </span>
      <span className="pt-0.5 font-copy text-[1.1rem] leading-[1.5] text-white/90">{children}</span>
    </li>
  );
}

const ICON = "mx-0.5 inline h-[1.1em] w-[1.1em] -translate-y-px align-middle text-gold";

function Instructions({ mode }: { mode: Exclude<InstallMode, "installed" | "prompt"> }) {
  if (mode === "ios") {
    return (
      <ol className="space-y-4" aria-label="Cómo instalar en iPhone o iPad">
        <Step n={1}>Abre esta página en Safari.</Step>
        <Step n={2}>
          Toca <strong className="font-semibold text-white">Compartir</strong>
          <Share aria-hidden="true" className={ICON} strokeWidth={2.2} />, en la barra de abajo.
        </Step>
        <Step n={3}>
          Elige <strong className="font-semibold text-white">Añadir a pantalla de inicio</strong>
          <SquarePlus aria-hidden="true" className={ICON} strokeWidth={2.2} /> y confirma.
        </Step>
      </ol>
    );
  }
  return (
    <ol className="space-y-4" aria-label="Cómo instalar desde el navegador">
      <Step n={1}>
        Abre el menú del navegador
        <EllipsisVertical aria-hidden="true" className={ICON} strokeWidth={2.2} />.
      </Step>
      <Step n={2}>
        Pulsa <strong className="font-semibold text-white">Instalar app</strong> o{" "}
        <strong className="font-semibold text-white">Añadir a pantalla de inicio</strong>
        <Plus aria-hidden="true" className={ICON} strokeWidth={2.2} />.
      </Step>
    </ol>
  );
}

/** Apartado de la portada para quien juega (o quiere jugar) desde el móvil: instalar la app sin tiendas. */
export function InstallApp() {
  const mode = useInstallMode();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Ya se está jugando desde la app instalada: no hay nada que ofrecer.
  if (mode === "installed") return null;

  const install = async () => {
    setBusy(true);
    try {
      setDismissed((await promptInstall()) === "dismissed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="movil" aria-labelledby="movil-title" className="px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-32">
      <div className={`${CONTAINER} !px-0`}>
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="grid items-center gap-10 rounded-[2rem] bg-forest px-6 py-12 sm:px-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16 lg:px-16 lg:py-16"
        >
          <div>
            <p className="font-copy text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-gold">Juega desde el móvil</p>
            <h2
              id="movil-title"
              className="mt-4 max-w-xl text-balance font-headline text-[clamp(1.7rem,3.2vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-white"
            >
              Ponlo en tu pantalla de inicio
            </h2>
            <p className="mt-5 max-w-lg font-copy text-[1.15rem] leading-[1.6] text-white/80">
              Sin tiendas ni descargas pesadas: se instala en un toque, abre a pantalla completa y entra a la sala de tu grupo más rápido.
            </p>

            <div className="mt-8">
              {dismissed && (
                <p role="status" className="mb-5 font-copy text-[1.05rem] leading-[1.5] text-white/75">
                  Sin problema. Cuando quieras, también puedes instalarla desde el menú del navegador:
                </p>
              )}
              {mode === "prompt" ? (
                <PillButton tone="gold" onClick={install} busy={busy} disabled={busy}>
                  Instalar la app
                </PillButton>
              ) : (
                <Instructions mode={mode} />
              )}
            </div>
          </div>
          <HomeScreen />
        </motion.div>
      </div>
    </section>
  );
}
