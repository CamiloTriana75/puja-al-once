import { Lock, Globe } from "lucide-react";
import type { ReactNode } from "react";
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
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[90rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Wordmark className="shrink-0 text-[1.3rem]" />
        <div className="min-w-0 flex-1">{children}</div>
        <p className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3.5 py-1.5 font-copy text-[0.95rem] text-slate ring-1 ring-line">
          {visibility === "public" ? <Globe className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden sm:inline">Sala</span>
          <span className="tnum font-headline text-[0.9rem] font-semibold tracking-[0.12em] text-forest">{roomCode}</span>
        </p>
      </div>
    </header>
  );
}
