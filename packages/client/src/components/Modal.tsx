import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DURATION, EASE_OUT } from "../motion/tokens.js";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])';

/**
 * Dialogo modal accesible: va en un portal sobre <body> (un `fixed` dentro de
 * la transicion entre pantallas se posicionaria contra ella), bloquea el
 * scroll de fondo, atrapa el foco, se cierra con Esc o clic fuera y devuelve
 * el foco a lo que lo tenia al abrir.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  dismissible = true,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Falso para avisos que hay que aceptar a proposito (sin Esc ni clic fuera). */
  dismissible?: boolean;
  size?: "md" | "lg";
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    // Foco inicial: el primer campo o boton del dialogo (no la X de cerrar).
    (focusables().find((el) => el.dataset.autofocus !== undefined) ?? focusables()[0])?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, dismissible]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.ui }}
          className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-forest/55 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (dismissible && event.target === event.currentTarget) close.current();
          }}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: DURATION.feedback, ease: EASE_OUT }}
            className={`my-auto w-full ${size === "lg" ? "max-w-xl" : "max-w-lg"} rounded-[2rem] bg-canvas p-6 shadow-[0_50px_90px_-30px_rgba(0,0,0,.7)] ring-1 ring-line sm:p-8`}
          >
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
