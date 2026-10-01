import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export const CONTAINER = "mx-auto w-full max-w-[76rem] px-4 sm:px-6 lg:px-8";

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Tone = "pitch" | "forest" | "gold";

const TONES: Record<Tone, { body: string; knob: string }> = {
  pitch: { body: "bg-pitch text-white hover:bg-[#106E3D]", knob: "bg-white text-pitch" },
  forest: { body: "bg-forest text-white hover:bg-[#163A2D]", knob: "bg-gold text-forest" },
  gold: { body: "bg-gold text-forest hover:bg-[#F5C65C]", knob: "bg-forest text-gold" },
};

/** Botón píldora de la portada: la flecha en círculo es el remate de marca. */
export function PillButton({
  children,
  onClick,
  type = "button",
  tone = "pitch",
  size = "lg",
  disabled,
  busy,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: Tone;
  size?: "sm" | "lg";
  disabled?: boolean;
  busy?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const palette = TONES[tone];
  const sizing = size === "lg" ? "min-h-14 gap-4 pl-7 pr-2 text-[1.075rem]" : "min-h-11 gap-3 pl-5 pr-1.5 text-[0.98rem]";
  const knob = size === "lg" ? "h-10 w-10" : "h-8 w-8";
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      whileTap={reduced || disabled ? undefined : { scale: 0.97 }}
      className={`group inline-flex cursor-pointer items-center justify-between rounded-full font-copy font-semibold transition-colors duration-200 disabled:cursor-wait disabled:opacity-70 ${sizing} ${palette.body} ${className}`}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5 ${knob} ${palette.knob}`}
      >
        <ArrowRight className="h-[48%] w-[48%]" strokeWidth={2.4} />
      </span>
    </motion.button>
  );
}

export function SectionTitle({
  id,
  children,
  align = "center",
  tone = "dark",
  className = "",
}: {
  id?: string;
  children: ReactNode;
  align?: "center" | "start";
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={`text-balance font-headline text-[clamp(1.85rem,3.4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.035em] ${tone === "light" ? "text-white" : "text-forest"} ${align === "center" ? "text-center" : ""} ${className}`}
    >
      {children}
    </h2>
  );
}
