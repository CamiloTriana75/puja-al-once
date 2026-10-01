import { Bug, CircleCheck, Lightbulb, MessageSquare, Send, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  CONTACT_MAX,
  MESSAGE_MAX,
  MESSAGE_MIN,
  closeFeedback,
  sendFeedback,
  useFeedbackOpen,
  type FeedbackKind,
} from "../net/feedback.js";
import { Modal } from "./Modal.js";

const KINDS: { id: FeedbackKind; label: string; hint: string; Icon: typeof Bug }[] = [
  { id: "bug", label: "Un error", hint: "Algo no funciona o se ve mal: una foto, un botón, la conexión…", Icon: Bug },
  { id: "sugerencia", label: "Una idea", hint: "Jugadores que faltan, reglas, mejoras, lo que te gustaría ver.", Icon: Lightbulb },
  { id: "otro", label: "Otra cosa", hint: "Cualquier comentario sobre el juego.", Icon: MessageSquare },
];

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  // Tras el "gracias", el dialogo se cierra solo.
  useEffect(() => {
    if (status !== "sent") return;
    const id = window.setTimeout(onClose, 2200);
    return () => window.clearTimeout(id);
  }, [status, onClose]);

  const tooShort = message.trim().length < MESSAGE_MIN;
  const hint = KINDS.find((item) => item.id === kind)?.hint;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (tooShort) {
      setError("Cuéntanos un poco más (al menos 5 caracteres).");
      return;
    }
    setStatus("sending");
    setError(null);
    const result = await sendFeedback({ kind, message, contact, website });
    if (result.ok) setStatus("sent");
    else {
      setStatus("idle");
      setError(result.message);
    }
  };

  if (status === "sent") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-pitch text-white">
          <CircleCheck className="size-8" aria-hidden="true" />
        </span>
        <p className="font-headline text-[1.6rem] font-bold tracking-[-0.04em] text-forest">¡Gracias!</p>
        <p className="font-copy text-[1.05rem] text-slate">Lo hemos recibido. Lo leeremos para mejorar el juego.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-headline text-[1.6rem] font-bold leading-tight tracking-[-0.04em] text-forest">Cuéntanos qué pasa</h3>
          <p className="mt-1 font-copy text-[1.02rem] text-slate">Errores, ideas o lo que quieras. Nos ayuda mucho en esta fase.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-slate transition-colors duration-200 hover:bg-white hover:text-forest"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <fieldset>
        <legend className="mb-2 font-copy text-[0.98rem] font-medium text-forest">¿Qué quieres contarnos?</legend>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
              className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 font-copy text-[0.95rem] font-semibold transition-colors duration-200 sm:flex-row sm:gap-2 ${
                kind === id ? "bg-forest text-white" : "bg-white text-forest ring-1 ring-line hover:ring-forest"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 font-copy text-[0.95rem] text-slate">{hint}</p>
      </fieldset>

      <div>
        <label htmlFor="feedback-message" className="mb-2 block font-copy text-[0.98rem] font-medium text-forest">
          Tu mensaje
        </label>
        <textarea
          id="feedback-message"
          data-autofocus
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            if (error) setError(null);
          }}
          rows={5}
          maxLength={MESSAGE_MAX}
          placeholder={kind === "bug" ? "Qué hacías, qué pasó y en qué pantalla…" : "Escribe aquí…"}
          className="w-full resize-y rounded-2xl border-2 border-line bg-white px-4 py-3 font-copy text-[1.05rem] text-forest placeholder:text-slate/70 focus:border-pine"
        />
        <p className="tnum mt-1 text-right font-copy text-[0.88rem] text-slate">
          {message.length}/{MESSAGE_MAX}
        </p>
      </div>

      <div>
        <label htmlFor="feedback-contact" className="mb-2 block font-copy text-[0.98rem] font-medium text-forest">
          Cómo contactarte <span className="font-normal text-slate">(opcional)</span>
        </label>
        <input
          id="feedback-contact"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          maxLength={CONTACT_MAX}
          autoComplete="off"
          placeholder="Un correo o usuario, si quieres que te respondamos"
          className="h-12 w-full rounded-2xl border-2 border-line bg-white px-4 font-copy text-[1.02rem] text-forest placeholder:text-slate/70 focus:border-pine"
        />
      </div>

      {/* Campo trampa: invisible para personas, lo rellenan los bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          No rellenar
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-alert/10 px-4 py-3 font-copy text-[1rem] font-medium text-alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        aria-busy={status === "sending"}
        className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-pitch font-copy text-[1.08rem] font-semibold text-white transition-colors duration-200 hover:bg-[#106E3D] disabled:cursor-wait disabled:opacity-70"
      >
        <Send className="size-5" aria-hidden="true" />
        {status === "sending" ? "Enviando…" : "Enviar comentario"}
      </button>
      <p className="font-copy text-[0.9rem] leading-snug text-slate">
        Guardamos tu mensaje para revisarlo. No incluyas datos personales sensibles: el contacto es solo si quieres respuesta.
      </p>
    </form>
  );
}

/** Dialogo de comentarios, montado una sola vez en App. Se abre con `openFeedback()`. */
export function FeedbackHost() {
  const open = useFeedbackOpen();
  return (
    <Modal open={open} onClose={closeFeedback} title="Enviar comentarios" size="lg">
      {open && <FeedbackForm onClose={closeFeedback} />}
    </Modal>
  );
}
