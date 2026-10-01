/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Enlace de PayPal para donaciones (https://www.paypal.me/usuario). Opcional. */
  readonly VITE_DONATE_URL?: string;
}
