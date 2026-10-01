import { Heart } from "lucide-react";
import { DONATE_URL } from "../../config/donate.js";
import { openSupport } from "../../net/support.js";
import { CONTAINER } from "./ui.js";

/** Franja de una linea sobre el pie: el apoyo es opcional y no merece una seccion entera. Sin enlace de PayPal no se pinta. */
export function SupportStrip({ url = DONATE_URL }: { url?: string | null }) {
  if (!url) return null;
  return (
    <div className="border-t border-line bg-canvas">
      <p className={`${CONTAINER} flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-4 text-center font-copy text-[1.02rem] text-slate`}>
        <Heart className="size-4 shrink-0 text-pitch" aria-hidden="true" />
        <span>Puja el Once es gratis y opcionalmente puedes apoyarlo.</span>
        <button
          type="button"
          onClick={openSupport}
          className="min-h-11 cursor-pointer font-semibold text-pine underline underline-offset-4 transition-colors hover:text-forest"
        >
          Apoyar el proyecto
        </button>
      </p>
    </div>
  );
}
