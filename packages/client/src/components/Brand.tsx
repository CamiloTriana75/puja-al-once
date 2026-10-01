/** Balón de marca: ocupa el lugar de la «O» de «Once». */
export function BallMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="var(--color-pitch)" />
      <path d="M16 10.2 21.52 14.21 19.41 20.69H12.59L10.48 14.21Z" fill="var(--color-forest)" />
      <path
        d="M16 10.2V3.4M21.52 14.21l6.6-2.14M19.41 20.69l4.08 5.62M12.59 20.69l-4.08 5.62M10.48 14.21l-6.6-2.14"
        stroke="var(--color-forest)"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={`inline-flex items-center font-headline font-bold tracking-[-0.045em] ${tone === "dark" ? "text-forest" : "text-white"} ${className}`}>
      <span className="sr-only">Puja el Once</span>
      <span aria-hidden="true" className="inline-flex items-center">
        Puja el 
        <BallMark className="mx-[0.03em] h-[0.74em] w-[0.74em] translate-y-[0.04em]" />
        nce
      </span>
    </span>
  );
}
