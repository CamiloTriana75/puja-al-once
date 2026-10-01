import { Construction, ImageOff, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { openFeedback } from "../net/feedback.js";
import { Modal } from "./Modal.js";

const STORAGE_KEY = "futbolera:aviso-fase-temprana";

function alreadyAccepted(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Aviso de que el juego esta en fase temprana, antes de empezar una partida.
 * Sale una vez por sesion del navegador, al entrar a la sala de espera (tanto
 * al crearla como al unirse), y se cierra con el boton, Esc o un clic fuera.
 */
export function EarlyAccessNotice() {
  const [open, setOpen] = useState(() => !alreadyAccepted());

  const accept = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Sin almacenamiento: el aviso saldra otra vez al recargar, no pasa nada.
    }
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={accept} title="Juego en fase temprana de desarrollo">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gold text-forest">
            <Construction className="size-7" aria-hidden="true" />
          </span>
          <h3 className="font-headline text-[1.55rem] font-bold leading-tight tracking-[-0.04em] text-forest">Antes de empezar</h3>
        </div>

        <p className="font-copy text-[1.1rem] leading-[1.55] text-forest">
          Futbolera está en <strong className="font-semibold">fase temprana de desarrollo</strong>. Puedes jugar con normalidad, pero conviene saber esto:
        </p>

        <ul className="flex flex-col gap-3">
          <li className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
            <ImageOff className="mt-0.5 size-5 shrink-0 text-gold-ink" aria-hidden="true" />
            <span className="font-copy text-[1.02rem] leading-snug text-forest">
              <strong className="font-semibold">Algunas fotos de jugadores no se ven o salen mal.</strong> Las estamos corrigiendo y se arreglarán más adelante.
            </span>
          </li>
          <li className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
            <Construction className="mt-0.5 size-5 shrink-0 text-gold-ink" aria-hidden="true" />
            <span className="font-copy text-[1.02rem] leading-snug text-forest">
              <strong className="font-semibold">Pueden aparecer errores.</strong> Si algo falla, cuéntanoslo: es la mejor ayuda que nos puedes dar.
            </span>
          </li>
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            data-autofocus
            onClick={accept}
            className="h-14 flex-1 cursor-pointer rounded-full bg-pitch px-7 font-copy text-[1.08rem] font-semibold text-white transition-colors duration-200 hover:bg-[#106E3D]"
          >
            Entendido, a jugar
          </button>
          <button
            type="button"
            onClick={() => {
              accept();
              openFeedback();
            }}
            className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 font-copy text-[1.02rem] font-semibold text-forest ring-1 ring-line transition-colors duration-200 hover:ring-forest"
          >
            <MessageSquarePlus className="size-5" aria-hidden="true" />
            Enviar comentarios
          </button>
        </div>
      </div>
    </Modal>
  );
}
