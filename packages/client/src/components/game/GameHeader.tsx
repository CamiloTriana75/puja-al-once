import { Globe, Lock, MessageSquarePlus, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";
import { openFeedback } from "../../net/feedback.js";
import { setMuted, useMuted } from "../../net/sound.js";
import { Wordmark } from "../Brand.js";

/** Cabecera de partida: la misma barra que la portada, con el estado de la sala al centro. */
export function GameHeader({
  roomCode,
  visibility,
  children,
}: {
  roomCode: string;
  visibility?: "private" | "public";
  children?: ReactNode;
}) {
  const muted = useMuted();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[90rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Wordmark className="shrink-0 text-[1.3rem]" />
        <div className="min-w-0 flex-1">{children}</div>
        <button
          type="button"
          onClick={openFeedback}
          aria-label="Enviar comentarios"
          title="Enviar comentarios o avisar de un error"
          className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-3 font-copy text-[0.95rem] font-medium text-forest ring-1 ring-line transition-colors duration-200 hover:ring-forest"
        >
          <MessageSquarePlus className="size-5" aria-hidden="true" />
          <span className="hidden lg:inline">Comentarios</span>
        </button>
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          aria-pressed={muted}
          aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
          title={muted ? "Activar sonido" : "Silenciar sonido"}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-white text-forest ring-1 ring-line transition-colors duration-200 hover:ring-forest"
        >
          {muted ? <VolumeX className="size-5" aria-hidden="true" /> : <Volume2 className="size-5" aria-hidden="true" />}
        </button>
        <p className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3.5 py-1.5 font-copy text-[0.95rem] text-slate ring-1 ring-line">
          {visibility === "public" ? <Globe className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden sm:inline">Sala</span>
          <span className="tnum font-headline text-[0.9rem] font-semibold tracking-[0.12em] text-forest">{roomCode}</span>
        </p>
      </div>
    </header>
  );
}
