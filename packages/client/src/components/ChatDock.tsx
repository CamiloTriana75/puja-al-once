import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, SendHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CHAT_MAX_LENGTH, type ChatMessage } from "../net/chat.js";

interface Props {
  messages: ChatMessage[];
  myId: string;
  /** Sube cada vez que el servidor rechaza un mensaje por ir demasiado rapido. */
  rejectedSeq: number;
  onSend: (text: string) => void;
  /** Subir el boton para no tapar la barra de "Última hora" de la subasta. */
  lifted?: boolean;
}

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Chat de texto de la sala: boton flotante con contador de no leidos y panel
 * que se abre sobre cualquier pantalla (sala de espera, subasta, mercado,
 * resultados). z-60: por encima de la ceremonia final (z-50) y del banner de
 * conexion, por debajo de los modales (90) y de la venta/arranque (100).
 */
export function ChatDock({ messages, myId, rejectedSeq, onSend, lifted = false }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [seenCount, setSeenCount] = useState(0);
  const [slowDown, setSlowDown] = useState(false);
  const titleId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);

  // No leidos: lo ajeno que llego mientras el panel estaba cerrado.
  const unread = open ? 0 : messages.slice(seenCount).filter((m) => m.playerId !== myId).length;

  useEffect(() => {
    if (open) setSeenCount(messages.length);
  }, [open, messages.length]);

  // Al abrir, o al llegar un mensaje, baja al final salvo que la persona haya subido a releer.
  useEffect(() => {
    const list = listRef.current;
    if (open && list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [open, messages.length]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (rejectedSeq === 0) return;
    setSlowDown(true);
    const timer = window.setTimeout(() => setSlowDown(false), 2500);
    return () => window.clearTimeout(timer);
  }, [rejectedSeq]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
    stickToBottom.current = true;
  };

  const remaining = CHAT_MAX_LENGTH - draft.length;

  return (
    <div className={`pointer-events-none fixed right-4 z-[60] flex flex-col items-end gap-3 sm:right-6 ${lifted ? "bottom-[4.25rem]" : "bottom-4"}`}>
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-auto fixed inset-x-0 bottom-0 flex h-[min(72dvh,34rem)] flex-col overflow-hidden rounded-t-[1.75rem] border border-line bg-white shadow-[0_-18px_48px_-20px_rgba(12,36,28,.55)] sm:static sm:h-[30rem] sm:w-[23rem] sm:rounded-[1.75rem] sm:shadow-[0_24px_60px_-24px_rgba(12,36,28,.6)]"
          >
            <header className="flex items-center justify-between gap-3 border-b border-line bg-canvas px-5 py-3.5">
              <h2 id={titleId} className="font-headline text-[1rem] font-semibold tracking-[-0.02em] text-forest">
                Chat de la sala
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar el chat"
                className="grid h-11 w-11 -mr-2 cursor-pointer place-items-center rounded-full text-forest/70 transition-colors hover:bg-forest/5 hover:text-forest"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <ol
              ref={listRef}
              role="log"
              aria-live="polite"
              aria-label="Mensajes"
              onScroll={(event) => {
                const el = event.currentTarget;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
              }}
              className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
            >
              {messages.length === 0 && (
                <li className="grid h-full place-items-center px-6 text-center font-copy text-[1.05rem] leading-[1.5] text-slate">
                  Aquí charlas con tu sala. Rompe el hielo antes de la primera puja.
                </li>
              )}
              {messages.map((message) => {
                const mine = message.playerId === myId;
                return (
                  <li key={message.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <span className="mb-1 px-1 font-copy text-[0.85rem] text-slate">
                      <span className="font-semibold text-forest">{mine ? "Tú" : message.name}</span>
                      <span aria-hidden="true"> · </span>
                      <time dateTime={new Date(message.at).toISOString()}>{timeOf(message.at)}</time>
                    </span>
                    <p
                      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 font-copy text-[1.05rem] leading-[1.4] ${
                        mine ? "rounded-br-md bg-pitch text-white" : "rounded-bl-md bg-canvas text-forest ring-1 ring-line"
                      }`}
                    >
                      {message.text}
                    </p>
                  </li>
                );
              })}
            </ol>

            <form onSubmit={submit} className="border-t border-line bg-white p-3">
              <p role="status" className="min-h-5 px-2 pb-1 font-copy text-[0.9rem] text-alert">
                {slowDown ? "Más despacio, que te pasas de rápido." : ""}
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={CHAT_MAX_LENGTH}
                  autoComplete="off"
                  enterKeyHint="send"
                  aria-label="Escribe un mensaje"
                  placeholder="Escribe un mensaje…"
                  className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-canvas px-5 font-copy text-[1.05rem] text-forest outline-none transition-colors placeholder:text-slate/70 focus:border-pitch"
                />
                <button
                  type="submit"
                  disabled={draft.trim() === ""}
                  aria-label="Enviar mensaje"
                  className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full bg-pitch text-white transition-colors hover:bg-[#106E3D] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SendHorizontal className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              {remaining <= 40 && (
                <p className="px-2 pt-1.5 text-right font-copy text-[0.85rem] text-slate tnum" aria-live="off">
                  {remaining} caracteres
                </p>
              )}
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          type="button"
          onClick={() => setOpen(true)}
          whileTap={{ scale: 0.96 }}
          aria-label={unread > 0 ? `Abrir el chat, ${unread} mensajes sin leer` : "Abrir el chat"}
          className="pointer-events-auto relative flex min-h-12 cursor-pointer items-center gap-2.5 rounded-full bg-forest pl-4 pr-5 font-copy text-[1rem] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(12,36,28,.8)] transition-colors hover:bg-[#163A2D]"
        >
          <MessageCircle className="h-5 w-5 text-gold" aria-hidden="true" />
          Chat
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-gold px-1.5 text-[0.8rem] font-bold text-forest tnum"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </motion.button>
      )}
    </div>
  );
}
