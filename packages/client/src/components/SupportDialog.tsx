import { Coffee, Heart, Trophy, Users, X, type LucideIcon } from "lucide-react";
import { donateAmountUrl, DONATE_URL } from "../config/donate.js";
import { DONORS, type Donor } from "../data/donors.js";
import { closeSupport, useSupportOpen } from "../net/support.js";
import { Modal } from "./Modal.js";

/** Cantidades sugeridas, en dolares (paypal.me/usuario/5USD). */
const TIERS: { amount: number; title: string; icon: LucideIcon }[] = [
  { amount: 3, title: "Un café", icon: Coffee },
  { amount: 5, title: "Una ronda", icon: Users },
  { amount: 10, title: "Un fichaje", icon: Trophy },
];

/** Contenido del dialogo de apoyo. Separado de `SupportHost` para poder probarlo sin el portal. */
export function SupportContent({
  url,
  donors = DONORS,
  onClose,
}: {
  url: string;
  donors?: readonly Donor[];
  onClose: () => void;
}) {
  const tiers = TIERS.flatMap((tier) => {
    const href = donateAmountUrl(url, tier.amount);
    return href ? [{ ...tier, href }] : [];
  });

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 font-copy text-[0.85rem] font-semibold uppercase tracking-[0.14em] text-pine">
            <Heart className="size-4" aria-hidden="true" />
            Opcional
          </p>
          <h2 className="mt-1 font-headline text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.035em] text-forest">Apoya el proyecto</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="-mr-2 -mt-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-forest/70 transition-colors hover:bg-forest/5 hover:text-forest"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 font-copy text-[1.1rem] leading-[1.5] text-slate">Puja el Once es gratis y lo hace una sola persona. Si te gusta, esto lo mantiene en pie.</p>

      {tiers.length > 0 && (
        <ul className="mt-5 grid grid-cols-3 gap-2.5" aria-label="Cantidades sugeridas">
          {tiers.map(({ amount, title, icon: Icon, href }) => (
            <li key={amount}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full cursor-pointer flex-col items-center rounded-2xl bg-white px-2 py-3.5 text-center text-forest ring-1 ring-line transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:ring-2 hover:ring-pitch"
              >
                <Icon className="size-5 text-pitch" aria-hidden="true" />
                <span className="mt-2 font-headline text-[1.3rem] font-bold leading-none tracking-[-0.04em] tnum">
                  {amount}
                  <span className="ml-0.5 text-[0.75rem] font-semibold tracking-normal text-slate">USD</span>
                </span>
                <span className="mt-1 font-copy text-[0.98rem] font-semibold leading-tight">{title}</span>
                <span className="sr-only">(se abre PayPal en una pestaña nueva)</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${tiers.length > 0 ? "mt-3" : "mt-5"} inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-forest px-6 font-copy text-[1.05rem] font-semibold text-white transition-colors duration-200 hover:bg-[#163A2D]`}
      >
        <Heart className="size-5 text-gold" aria-hidden="true" />
        {tiers.length > 0 ? "Otra cantidad con PayPal" : "Donar con PayPal"}
        <span className="sr-only">(se abre en una pestaña nueva)</span>
      </a>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="font-headline text-[0.9rem] font-semibold tracking-[-0.02em] text-pine">La hinchada</h3>
        {donors.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {donors.map((donor) => (
              <li key={donor.name} className="rounded-full bg-gold px-3 py-1 font-copy text-[0.98rem] font-semibold text-forest">
                {donor.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-copy text-[1rem] text-slate">Aquí saldrá tu nombre si quieres.</p>
        )}
      </div>
      <p className="mt-1.5 font-copy text-[0.95rem] leading-[1.45] text-slate">
        Tras donar,{" "}
        <a href="/legal/contacto.html" className="font-semibold text-pine underline underline-offset-2">
          escríbenos
        </a>{" "}
        y sales en la hinchada. Solo si tú lo pides.
      </p>

      <p className="mt-4 border-t border-line pt-3 font-copy text-[0.85rem] leading-[1.45] text-slate">
        Aportación voluntaria y personal: no da ventajas, no es una entidad benéfica ni es deducible. El pago lo gestiona PayPal.
      </p>
    </div>
  );
}

/** Dialogo de apoyo, montado una vez en la portada. Se abre con `openSupport()`; sin enlace de PayPal no hace nada. */
export function SupportHost() {
  const open = useSupportOpen();
  if (!DONATE_URL) return null;
  return (
    <Modal open={open} onClose={closeSupport} title="Apoya el proyecto">
      {open && <SupportContent url={DONATE_URL} onClose={closeSupport} />}
    </Modal>
  );
}
