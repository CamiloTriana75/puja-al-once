import { PermissionFlagsBits as P } from "discord.js";
import { BRAND } from "./brand.mjs";

const C = BRAND.colors;

/**
 * Permisos de @everyone: lo justo para charlar, jugar y compartir. Sin
 * @everyone/@here, sin webhooks y sin gestionar nada.
 */
export const EVERYONE_PERMISSIONS = [
  P.ViewChannel,
  P.SendMessages,
  P.SendMessagesInThreads,
  P.CreatePublicThreads,
  P.EmbedLinks,
  P.AttachFiles,
  P.AddReactions,
  P.UseExternalEmojis,
  P.UseExternalStickers,
  P.ReadMessageHistory,
  P.CreateInstantInvite,
  P.ChangeNickname,
  P.Connect,
  P.Speak,
  P.Stream,
  P.UseVAD,
  P.UseApplicationCommands,
];

/**
 * Roles, de mas arriba a mas abajo (el rol del bot de configuracion queda por
 * encima de todos). `self: true` = se elige desde "Canales y roles" (onboarding).
 */
export const ROLES = [
  { key: "fundador", name: "👑 Fundador", color: C.gold, hoist: true, permissions: [P.Administrator] },
  {
    key: "moderador",
    name: "🛡️ Moderador",
    color: C.pitch,
    hoist: true,
    permissions: [
      P.ManageMessages, P.ManageThreads, P.ModerateMembers, P.KickMembers, P.BanMembers,
      P.ManageNicknames, P.MuteMembers, P.MoveMembers, P.DeafenMembers, P.ViewAuditLog,
      P.MentionEveryone, P.CreateInstantInvite,
    ],
  },
  { key: "creador", name: "🎙️ Creador", color: 0x1c9a57, hoist: true, permissions: [] },
  { key: "tester", name: "🧪 Tester", color: C.sky, hoist: true, permissions: [] },
  { key: "hinchada", name: "⭐ La hinchada", color: C.goldSoft, hoist: true, permissions: [] },
  { key: "avisos", name: "🔔 Avisos de partidas", color: 0, mentionable: true, self: true, permissions: [] },
  { key: "novedades", name: "📰 Novedades", color: 0, self: true, permissions: [] },
  { key: "busco", name: "🎮 Busco partida", color: 0, mentionable: true, self: true, permissions: [] },
  { key: "latam", name: "🌎 Latam", color: 0, self: true, permissions: [] },
  { key: "espana", name: "🇪🇸 España", color: 0, self: true, permissions: [] },
  { key: "mundo", name: "🌍 Resto del mundo", color: 0, self: true, permissions: [] },
];

/**
 * Estructura de canales. `type`: text | announcement | forum | voice.
 * `readonly`: solo el staff escribe. `staff`: oculto salvo para Fundador/Moderador.
 * Los nombres usan "｜" (como casi todos los servidores) y van en minusculas: Discord
 * pasa a minusculas los de texto, asi que asi se reconocen al repetir el script.
 */
export const CATEGORIES = [
  {
    key: "bienvenida",
    name: "📣 BIENVENIDA",
    channels: [
      { key: "bienvenida", name: "👋｜bienvenida", type: "text", readonly: true, topic: "Empieza por aquí: qué es Puja el Once y cómo entrar al vestuario." },
      { key: "reglas", name: "📜｜reglas", type: "text", readonly: true, topic: "Cómo convivimos. Léelas antes de escribir." },
      { key: "como-se-juega", name: "❓｜cómo-se-juega", type: "text", readonly: true, topic: "Las reglas del juego explicadas en un minuto." },
      { key: "anuncios", name: "📢｜anuncios", type: "announcement", readonly: true, topic: "Noticias importantes del juego y de la comunidad." },
      { key: "novedades", name: "🆕｜novedades", type: "text", readonly: true, topic: "Cada actualización del juego, con lo que cambia." },
    ],
  },
  {
    key: "jugar",
    name: "⚽ A JUGAR",
    channels: [
      {
        key: "salas-abiertas",
        name: "🔔｜salas-abiertas",
        type: "text",
        slowmode: 20,
        topic: "Pega aquí el enlace de tu sala si faltan jugadores. Una sala por mensaje; bórralo cuando se llene o empiece.",
      },
      { key: "busco-partida", name: "🎮｜busco-partida", type: "text", slowmode: 10, topic: "¿Sin grupo? Pregunta aquí quién se anima a una partida." },
      { key: "mejores-onces", name: "🏆｜mejores-onces", type: "text", slowmode: 30, topic: "Muestra tu once final y cuánto gastaste. Capturas de la ceremonia, por favor." },
      { key: "fichajes-locos", name: "💸｜fichajes-locos", type: "text", slowmode: 15, topic: "Pujas absurdas, ofertas imposibles y fichajes que salieron fatal." },
      { key: "clips", name: "🎬｜clips", type: "text", slowmode: 30, topic: "Vídeos y capturas de tus mejores momentos: el martillazo, el robo de última hora…" },
    ],
  },
  {
    key: "comunidad",
    name: "💬 COMUNIDAD",
    channels: [
      { key: "general", name: "💬｜general", type: "text", slowmode: 2, topic: "Charla libre. Buen rollo siempre." },
      { key: "debate", name: "🧠｜debate-futbolero", type: "text", slowmode: 5, topic: "¿Quién es mejor? Aquí se debate con argumentos y sin faltar al respeto." },
      { key: "presentaciones", name: "🤝｜presentaciones", type: "text", slowmode: 30, topic: "Cuéntanos quién eres, de qué equipo eres y qué posición pujas siempre primero." },
      { key: "off-topic", name: "🎲｜off-topic", type: "text", slowmode: 5, topic: "Todo lo que no sea fútbol ni el juego." },
    ],
  },
  {
    key: "proyecto",
    name: "🛠️ EL PROYECTO",
    channels: [
      {
        key: "sugerencias",
        name: "💡｜sugerencias",
        type: "forum",
        topic: "Una idea por publicación. Busca antes si ya la propusieron y vota con 👍.",
        tags: ["💡 Idea", "🃏 Cartas y jugadores", "🎨 Diseño", "⚙️ Reglas del juego", "🤝 Comunidad", "✅ Hecho", "⏳ Planeado"],
      },
      {
        key: "bugs",
        name: "🐛｜reporte-de-bugs",
        type: "forum",
        topic: "Cuenta qué pasó, qué esperabas y en qué dispositivo. Una publicación por fallo.",
        tags: ["🐛 Bug", "📱 Móvil", "💻 Escritorio", "🎮 Partida", "🖼️ Fotos", "🔎 Investigando", "✅ Resuelto"],
      },
      {
        key: "comentarios",
        name: "📬｜comentarios-del-juego",
        type: "text",
        readonly: true,
        topic: "Los comentarios enviados desde el formulario del juego llegan aquí solos.",
      },
      { key: "testers", name: "🧪｜testers", type: "text", testers: true, topic: "Versiones de prueba y novedades antes de que salgan. Solo testers." },
    ],
  },
  {
    key: "voz",
    name: "🔊 VOZ",
    channels: [
      { key: "voz-1", name: "🎙️ Sala 1", type: "voice", userLimit: 4 },
      { key: "voz-2", name: "🎙️ Sala 2", type: "voice", userLimit: 4 },
      { key: "voz-3", name: "🎙️ Sala 3", type: "voice", userLimit: 4 },
      { key: "voz-4", name: "🎙️ Sala 4", type: "voice", userLimit: 4 },
      { key: "lounge", name: "☕ Lounge", type: "voice", userLimit: 0 },
    ],
  },
  {
    key: "staff",
    name: "🔒 STAFF",
    staff: true,
    channels: [
      { key: "staff", name: "🛡️｜staff", type: "text", staff: true, topic: "Coordinación del equipo. Manual de moderación fijado." },
      { key: "logs", name: "🧾｜logs", type: "text", staff: true, topic: "Alertas automáticas de AutoMod y registro de acciones." },
      { key: "voz-staff", name: "🔒 Staff", type: "voice", staff: true },
    ],
  },
];

/** Reglas de AutoMod. Los canales de alerta y roles exentos se resuelven al aplicar. */
export const AUTOMOD = [
  { key: "odio", name: "Insultos y contenido sexual", kind: "preset", presets: ["Slurs", "SexualContent"], block: true },
  { key: "palabrotas", name: "Palabrotas (solo aviso al staff)", kind: "preset", presets: ["Profanity"], block: false },
  { key: "menciones", name: "Spam de menciones", kind: "mentions", limit: 6, timeoutSeconds: 120 },
  { key: "spam", name: "Spam", kind: "spam" },
  {
    key: "invitaciones",
    name: "Invitaciones a otros servidores",
    kind: "regex",
    patterns: ["(?:discord\\.gg|discord(?:app)?\\.com/invite)/\\S+"],
    exemptRoles: ["moderador", "fundador", "creador"],
  },
];

/** Emojis del servidor (assets/emoji-*.png, generados por scripts/make-images.py). */
export const EMOJIS = ["puja", "mazo", "balon", "vendido", "silueta", "once", "hinchada"];

/** Preguntas de "Canales y roles": cada opcion da un rol y/o muestra canales. */
export const ONBOARDING = {
  defaultChannels: [
    "bienvenida", "reglas", "como-se-juega", "anuncios", "salas-abiertas", "busco-partida",
    "general", "presentaciones", "mejores-onces", "fichajes-locos", "clips",
  ],
  prompts: [
    {
      title: "¿Qué quieres recibir?",
      singleSelect: false,
      required: false,
      options: [
        { title: "Avisos de partidas", description: "Te mencionan cuando alguien abre una sala", role: "avisos", channels: ["salas-abiertas"], emoji: "🔔" },
        { title: "Novedades del juego", description: "Cada actualización, con lo que cambia", role: "novedades", channels: ["novedades"], emoji: "📰" },
        { title: "Busco partida", description: "Para que te propongan jugar", role: "busco", channels: ["busco-partida"], emoji: "🎮" },
      ],
    },
    {
      title: "¿Desde dónde juegas?",
      singleSelect: true,
      required: false,
      options: [
        { title: "Latinoamérica", description: "Para coincidir en horarios", role: "latam", channels: [], emoji: "🌎" },
        { title: "España", description: "Para coincidir en horarios", role: "espana", channels: [], emoji: "🇪🇸" },
        { title: "Otro lugar", description: "Desde cualquier parte del mundo", role: "mundo", channels: [], emoji: "🌍" },
      ],
    },
  ],
};

export const WELCOME_SCREEN = {
  description: "Subastas de fútbol a ciegas con tus amigos. Pasa, que ya empezó la puja.",
  channels: [
    { channel: "como-se-juega", description: "Cómo se juega, en un minuto", emoji: "❓" },
    { channel: "salas-abiertas", description: "Entra a una partida ahora", emoji: "🔔" },
    { channel: "mejores-onces", description: "Presume de tu once", emoji: "🏆" },
    { channel: "sugerencias", description: "Dinos qué mejorar", emoji: "💡" },
    { channel: "general", description: "Charla con la comunidad", emoji: "💬" },
  ],
};

export const SERVER = {
  name: BRAND.name,
  locale: BRAND.locale,
  /** Medio: cuenta con mas de 5 minutos. Frena a los bots sin molestar a quien llega por un enlace. */
  verificationLevel: 2,
  /** Revisar el contenido de todos los miembros. */
  explicitContentFilter: 2,
  /** Notificar solo por menciones: un servidor con mucho chat no debe sonar siempre. */
  defaultMessageNotifications: 1,
  systemChannel: "general",
  rulesChannel: "reglas",
  publicUpdatesChannel: "staff",
};
