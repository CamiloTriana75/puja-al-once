/** Identidad del servidor: sale de la web del juego (packages/client/src/index.css). */
export const BRAND = {
  name: "Puja el Once",
  /** Se puede cambiar sin tocar el codigo: GAME_URL=https://tudominio.com npm run setup */
  gameUrl: (process.env.GAME_URL ?? "https://puja-al-once-3u8j.onrender.com").replace(/\/+$/, ""),
  tagline: "Puja a ciegas. Arma tu once.",
  locale: "es-419",
  colors: {
    forest: 0x0c241c,
    pitch: 0x15834a,
    pine: 0x0e5138,
    gold: 0xf0b83d,
    goldSoft: 0xf5c65c,
    canvas: 0xf5f4ec,
    sky: 0x5ea8ff,
    alert: 0xe5483b,
  },
};
