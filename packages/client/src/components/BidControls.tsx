import { useEffect, useState } from "react";

interface Props {
  minimumBid: number;
  disabled: boolean;
  /** Motivo del ultimo rechazo, o null. Se pinta junto al campo. */
  error: string | null;
  onBid: (amount: number) => void;
}

const REASON: Record<string, string> = {
  BID_TOO_LOW: "Esa puja no llega al mínimo.",
  OVER_BUDGET: "No puedes: te dejaría sin dinero para llenar el resto del once.",
  SLOT_ALREADY_FILLED: "Ya fichaste para este puesto.",
  NOT_ALLOWED_TO_BID: "No puedes pujar por esta carta ahora mismo.",
  AUCTION_CLOSED: "La subasta ya se cerró.",
  WRONG_PHASE: "Ahora mismo no se puede pujar.",
  DISCONNECTED: "Te desconectaste.",
  // Reingreso aparcado: el socket funciona, pero la ronda en curso ya se
  // repartio sin contar contigo -- distinto de DISCONNECTED (ver
  // AuctionRoom.onBid). Decirle "desconectado" a alguien que esta mirando
  // la pantalla en directo es justo el mensaje que rejoinPending existe
  // para evitar.
  REJOIN_PENDING: "Te reconectaste: entras a partir de la próxima ronda.",
  UNKNOWN_PLAYER: "No estás en esta partida.",
};

export function BidControls({ minimumBid, disabled, error, onBid }: Props) {
  const [amount, setAmount] = useState(minimumBid);
  const [pending, setPending] = useState(false);

  // El minimo sube con cada puja ajena: seguirlo mientras no se haya tocado a mano.
  useEffect(() => { setAmount((current) => (current < minimumBid ? minimumBid : current)); }, [minimumBid]);

  // El servidor contesto (aceptando o rechazando): se puede volver a pulsar.
  useEffect(() => { setPending(false); }, [minimumBid, error]);

  const submit = (value: number) => {
    if (disabled || pending) return;
    setPending(true);
    onBid(value);
  };

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap gap-3"
        // noValidate: el atributo `min` del campo es solo una pista visual
        // (bloquea las flechas del spinner por debajo del minimo). Sin esto,
        // la validacion nativa del navegador intercepta el submit ANTES de
        // que onSubmit se dispare cuando alguien teclea un importe por
        // debajo del minimo -- onBid nunca se llama, el servidor nunca
        // contesta BID_TOO_LOW, y el mensaje en castellano de junto al
        // campo (la garantia de MASTER.md S6) no llega a mostrarse nunca.
        noValidate
        onSubmit={(event) => { event.preventDefault(); submit(amount); }}
      >
        <label className="sr-only" htmlFor="bid-amount">Importe de tu puja en millones</label>
        <input
          id="bid-amount"
          type="number"
          className="tnum h-12 w-28 border-2 border-white/20 bg-ink px-3 font-display text-2xl font-extrabold text-white"
          min={minimumBid}
          step={1}
          value={amount}
          aria-invalid={error !== null}
          aria-describedby={error ? "bid-error" : undefined}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
        <button
          type="submit"
          disabled={disabled || pending}
          className="h-12 min-w-[44px] cursor-pointer bg-lime px-6 font-display text-xl font-black uppercase tracking-wide text-ink transition-colors duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Enviando…" : "Pujar"}
        </button>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => { setAmount(minimumBid); submit(minimumBid); }}
          className="tnum h-12 cursor-pointer border-2 border-lime px-4 font-display text-lg font-bold uppercase text-lime transition-colors duration-200 hover:bg-lime hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Mínimo {minimumBid} M
        </button>
      </form>

      {error && (
        <p id="bid-error" role="alert" className="font-body text-sm font-semibold text-danger">
          {REASON[error] ?? error}
        </p>
      )}
    </div>
  );
}
