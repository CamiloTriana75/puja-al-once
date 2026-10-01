import { motion, useReducedMotion } from "framer-motion";
import { Gavel } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  minimumBid: number;
  disabled: boolean;
  /** Saldo del jugador: un importe por encima ni se ofrece. */
  budget?: number;
  /** Motivo del ultimo rechazo, o null. Se pinta junto al campo. */
  error: string | null;
  /**
   * Cuenta de rechazos recibidos del servidor -- ver bidErrorSeq en useRoom.
   * Se usa (en vez de `error`) para saber cuando el servidor acaba de
   * contestar de verdad: dos rechazos con el mismo texto no re-renderizan, y
   * `pending` se quedaria bloqueado para siempre si dependiera de `error`.
   */
  errorSeq: number;
  onBid: (amount: number) => void;
}

const REASON: Record<string, string> = {
  BID_TOO_LOW: "Esa puja no llega al mínimo.",
  OVER_BUDGET: "No puedes: te dejaría sin dinero para llenar el resto del once.",
  SLOT_ALREADY_FILLED: "Ya fichaste para este puesto.",
  NOT_ALLOWED_TO_BID: "No pudiste pujar por esta carta: no votaste a tiempo o votaste saltarla.",
  AUCTION_CLOSED: "La subasta ya se cerró.",
  WRONG_PHASE: "Ahora mismo no se puede pujar.",
  DISCONNECTED: "Te desconectaste.",
  REJOIN_PENDING: "Te reconectaste: entras a partir de la próxima ronda.",
  UNKNOWN_PLAYER: "No estás en esta partida.",
};

export function BidControls({ minimumBid, disabled, budget, error, errorSeq, onBid }: Props) {
  const [amount, setAmount] = useState(minimumBid);
  const [pending, setPending] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;

  // Si el minimo sube por encima de lo escrito, el campo sube con el.
  useEffect(() => { setAmount((current) => (current < minimumBid ? minimumBid : current)); }, [minimumBid]);

  // El servidor contesto: llega un minimo nuevo (puja aceptada) o un rechazo.
  useEffect(() => { setPending(false); }, [minimumBid, errorSeq]);

  const submit = (value: number) => {
    if (disabled || pending) return;
    setPending(true);
    onBid(value);
  };

  const quick = [
    { amount: minimumBid, label: `Mínimo ${minimumBid} M` },
    { amount: minimumBid + 10, label: `${minimumBid + 10} M` },
    { amount: minimumBid + 30, label: `${minimumBid + 30} M` },
  ];
  const tap = (blocked: boolean) => (reducedMotion || blocked ? undefined : { scale: 0.96 });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Pujas rápidas">
        {quick.map((option, index) => {
          const blocked = disabled || pending || (budget !== undefined && option.amount > budget);
          return (
            <motion.button
              key={option.label}
              type="button"
              disabled={blocked}
              whileTap={tap(blocked)}
              transition={{ duration: 0.1 }}
              onClick={() => { setAmount(option.amount); submit(option.amount); }}
              className={`tnum h-14 cursor-pointer rounded-2xl px-2 font-headline text-[0.95rem] font-semibold tracking-[-0.02em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                index === 0 ? "bg-pitch text-white hover:bg-[#106E3D]" : "bg-white text-forest ring-1 ring-line hover:ring-pitch"
              }`}
            >
              {option.label}
            </motion.button>
          );
        })}
      </div>

      <form
        className="flex gap-2"
        noValidate
        onSubmit={(event) => { event.preventDefault(); submit(amount); }}
      >
        <label className="sr-only" htmlFor="bid-amount">Importe de tu puja en millones</label>
        <div className="relative flex-1">
          <input
            id="bid-amount"
            type="number"
            className="tnum h-14 w-full rounded-2xl border-2 border-line bg-white pl-4 pr-10 font-headline text-[1.15rem] font-semibold text-forest transition-colors focus:border-pine"
            min={minimumBid}
            step={10}
            value={amount}
            aria-invalid={error !== null}
            aria-describedby={error ? "bid-error" : undefined}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
          <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-copy text-slate">M</span>
        </div>
        <motion.button
          type="submit"
          disabled={disabled || pending}
          whileTap={tap(disabled || pending)}
          transition={{ duration: 0.1 }}
          className="flex h-14 min-w-[44px] cursor-pointer items-center gap-2 rounded-2xl bg-forest px-6 font-copy text-[1.05rem] font-semibold text-white transition-colors duration-200 hover:bg-[#163A2D] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Gavel className="h-5 w-5" aria-hidden="true" />
          {pending ? "Enviando…" : "Pujar"}
        </motion.button>
      </form>

      {error && (
        <p id="bid-error" role="alert" className="rounded-xl bg-alert/10 px-3 py-2 font-copy text-[0.98rem] font-medium text-alert">
          {REASON[error] ?? error}
        </p>
      )}
    </div>
  );
}
