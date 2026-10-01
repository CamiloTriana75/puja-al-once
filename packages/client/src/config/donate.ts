/**
 * Enlace de donaciones (PayPal). Se fija al compilar con VITE_DONATE_URL: sin
 * el, el apartado de apoyo y su enlace del pie no se pintan, asi que nunca sale
 * un boton muerto ni una cuenta inventada.
 *
 * Solo se acepta HTTPS hacia PayPal (paypal.me y paypal.com): si la variable
 * trae otra cosa, se ignora en vez de enlazar a un sitio que no es.
 */
const PAYPAL_HOSTS = new Set(["paypal.me", "www.paypal.me", "paypal.com", "www.paypal.com"]);
const PAYPAL_ME_HOSTS = new Set(["paypal.me", "www.paypal.me"]);

export function parseDonateUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" && PAYPAL_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Enlace con la cantidad ya puesta (paypal.me/usuario/5USD). Solo existe para
 * enlaces paypal.me de perfil: un boton de donacion de paypal.com no admite el
 * importe en la ruta, asi que ahi devuelve null y quien llama oculta las cantidades.
 */
export function donateAmountUrl(base: string, amountUsd: number): string | null {
  if (!Number.isInteger(amountUsd) || amountUsd <= 0) return null;
  try {
    const url = new URL(base);
    if (!PAYPAL_ME_HOSTS.has(url.hostname)) return null;
    const user = url.pathname.split("/").filter(Boolean)[0];
    return user ? `${url.origin}/${user}/${amountUsd}USD` : null;
  } catch {
    return null;
  }
}

export const DONATE_URL: string | null = parseDonateUrl(import.meta.env.VITE_DONATE_URL);
