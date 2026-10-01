import { BRAND } from "./brand.mjs";

const C = BRAND.colors;

/**
 * Mensajes fijos del servidor. Placeholders que se resuelven al publicar:
 *   {#clave} -> mencion del canal    {@clave} -> mencion del rol    {game} -> URL del juego
 * Cada mensaje se identifica por el titulo de su primer embed: al repetir el
 * script se EDITA en vez de duplicarse (no cambies el titulo si no quieres uno nuevo).
 * `image`: cabecera de assets/ adjunta al publicar (scripts/make-images.py).
 */

export const MESSAGES = [
  {
    channel: "bienvenida",
    pin: true,
    image: "welcome.png",
    embeds: [
      {
        color: C.gold,
        title: "Bienvenido al vestuario de Puja el Once",
        description: [
          "Aquí se **puja a ciegas** por futbolistas, se revela quién era y se **arma el once** más caro del grupo.",
          "",
          "**Cómo empezar**",
          "1️⃣ Lee las {#reglas}",
          "2️⃣ Elige tus roles en **Canales y roles** (arriba a la izquierda)",
          "3️⃣ Mira {#como-se-juega} y entra a {#salas-abiertas}",
          "",
          "Se juega **gratis en el navegador**, de 2 a 4 amigos, sin cuentas ni descargas. También se instala como app en el móvil.",
        ].join("\n"),
        footer: "Puja a ciegas. Arma tu once.",
      },
    ],
    buttons: [
      { label: "Jugar ahora", url: "{game}" },
      { label: "Cómo se juega", url: "{channel:como-se-juega}" },
      { label: "Reglas", url: "{channel:reglas}" },
    ],
  },
  {
    channel: "reglas",
    pin: true,
    image: "rules.png",
    embeds: [
      {
        color: C.pitch,
        title: "Reglas del vestuario",
        description: "Pujar fuerte está permitido. Faltar al respeto, no.",
        fields: [
          { name: "1 · Buen rollo", value: "Pica a tus amigos, no los insultes. Nada de acoso, amenazas ni humillar a nadie por cómo puja." },
          { name: "2 · Respeto al fútbol de todos", value: "Rivalidad sí, odio no. Sin insultos a futbolistas, aficiones, países ni razas." },
          { name: "3 · Sin spam ni publicidad", value: "Nada de enlaces a otros servidores, ventas ni autopromoción sin permiso del staff." },
          { name: "4 · Contenido apto", value: "Prohibido el contenido sexual, violento, ilegal o que dé asco. Esto incluye nombres y fotos de perfil." },
          { name: "5 · Cada canal a lo suyo", value: "Salas en {#salas-abiertas}, fallos en {#bugs}, ideas en {#sugerencias}. Lo demás, en {#general}." },
          { name: "6 · Cuida tus datos", value: "No compartas contraseñas ni datos personales. El staff **nunca** te pedirá tu contraseña." },
          { name: "7 · Si algo va mal, avisa", value: "Escribe a un {@moderador} en vez de hacer justicia por tu cuenta." },
          { name: "8 · Las normas de Discord también cuentan", value: "Aplican los [Términos](https://discord.com/terms) y las [Normas de la comunidad](https://discord.com/guidelines) de Discord." },
          { name: "Sanciones", value: "Aviso → silencio temporal → expulsión → baneo. Lo grave salta directo al baneo. Se puede apelar por mensaje directo al {@fundador}." },
        ],
        footer: "Al participar aceptas estas reglas.",
      },
    ],
  },
  {
    channel: "como-se-juega",
    pin: true,
    image: "howto.png",
    embeds: [
      {
        color: C.gold,
        title: "Cómo se juega, en un minuto",
        description: "Cada ronda cubre **un puesto del once**, de portero a extremo. Sale la silueta de un futbolista y los jugadores pujan sin saber quién es.",
        fields: [
          { name: "🧩 Solo ves pistas", value: "Altura, pie, origen y década. El nombre, el club y el nivel **siguen ocultos** hasta que se cierra la puja." },
          { name: "💰 1.000 M para todo el once", value: "Cada jugador empieza con 1.000 M. Se puja de 10 en 10, y el dinero que necesitas para completar los puestos vacíos **no se puede gastar**: nadie se queda sin equipo." },
          { name: "⏱️ El reloj manda", value: "Hay 25 segundos para abrir la puja, y cada puja nueva da 10 más. Si nadie puja, la carta se puede saltar votando." },
          { name: "🔨 ¡Vendido!", value: "Cae el martillo, se revela quién era y la carta va al puesto de quien más pagó." },
          { name: "🔄 Dos mercados de traspasos", value: "Uno al cerrar la defensa y otro al cerrar el mediocampo. Cambias un jugador por otro **de la misma posición**, con dinero opcional." },
          { name: "🏆 Gana el mejor once", value: "Se compara puesto por puesto: el mejor nivel de cada puesto suma un punto. Desempata la suma de niveles y luego el saldo." },
        ],
        footer: "Se juega de 2 a 4 personas · gratis · sin cuentas",
      },
      {
        color: C.pitch,
        title: "Para jugar con tus amigos",
        description: [
          "**1.** Abre el juego y escribe tu nombre.",
          "**2.** Crea una **sala privada** y copia el enlace con un clic, o entra a una **pública**.",
          "**3.** Mándales el enlace. Cuando haya 2 o más jugadores, todos pulsan **Listo**.",
          "",
          "¿Sin grupo ahora mismo? Pega tu sala en {#salas-abiertas} y pide un {@avisos} si hace falta.",
          "Hay **chat de texto** dentro de cada sala, reacciones y puedes **expulsar** a alguien en la sala de espera.",
        ].join("\n"),
        footer: "El juego está en fase temprana: si algo falla, cuéntalo en #reporte-de-bugs",
      },
    ],
    buttons: [{ label: "Abrir el juego", url: "{game}" }],
  },
  {
    channel: "salas-abiertas",
    pin: true,
    embeds: [
      {
        color: C.pitch,
        title: "Cómo usar este canal",
        description: [
          "**Una sala por mensaje**, con el formato:",
          "```🎮 Sala ABCDE · faltan 2 · https://…/sala/ABCDE```",
          "",
          "• Bórralo cuando la sala se llene o empiece.",
          "• Menciona a {@avisos} **solo si de verdad faltan jugadores**; no más de una vez por sala.",
          "• Las salas **públicas** también salen en la portada del juego, en el vestuario abierto.",
          "• ¿Quieres chatear mientras juegas? Entra a una de las salas de voz de 4 plazas.",
        ].join("\n"),
      },
    ],
  },
  {
    channel: "anuncios",
    embeds: [
      {
        color: C.gold,
        title: "¡Abrimos el vestuario!",
        description: [
          "Puja el Once ya está abierto para jugar con tus amigos y este servidor es su casa.",
          "",
          "**Qué hay ahora mismo**",
          "• Subasta a ciegas con martillazo, revelación y ceremonia final.",
          "• Dos mercados de traspasos por partida.",
          "• Chat de texto en cada sala y reacciones.",
          "• App instalable en el móvil.",
          "",
          "**Ojo:** el juego está en **fase temprana**. Algunas fotos de jugadores fallan y se corregirán. Si te topas con algo raro, cuéntalo en {#bugs}: ayuda muchísimo.",
          "",
          "Gracias por ser de los primeros. ⚽",
        ].join("\n"),
        footer: "Equipo de Puja el Once",
      },
    ],
    buttons: [{ label: "Jugar ahora", url: "{game}" }],
    crosspost: false,
  },
  {
    channel: "novedades",
    embeds: [
      {
        color: C.pitch,
        title: "Octubre 2026 · Nuevo nombre, mazo y chat",
        description: [
          "• El juego pasa a llamarse **Puja el Once**.",
          "• Venta con **martillazo**, \"¡Vendido!\" y pase del balón al puesto.",
          "• **Dos mercados** de traspasos: tras la defensa y tras el mediocampo.",
          "• **Chat de texto** dentro de cada sala.",
          "• **App instalable** desde el móvil o el escritorio.",
          "• Formulario de comentarios dentro del juego (llegan a {#comentarios}).",
          "",
          "Historial completo: {game}/actualizaciones.html",
        ].join("\n"),
        footer: "v1 · Octubre 2026",
      },
    ],
  },
  {
    channel: "staff",
    pin: true,
    embeds: [
      {
        color: C.gold,
        title: "Manual rápido de moderación",
        description: [
          "**Principio:** primero se habla, luego se sanciona. Casi todo se arregla con un mensaje amable.",
          "",
          "**Escalera:** aviso → silencio (10 min / 1 h / 1 día) → expulsión → baneo. Acoso, odio y contenido ilegal: baneo directo.",
          "**AutoMod** ya bloquea insultos, spam y menciones masivas; las palabrotas solo avisan en {#logs}.",
          "**Siempre:** deja el motivo en {#logs} (quién, qué, qué hiciste).",
          "",
          "**Para reportes del juego:** los comentarios llegan a {#comentarios}; si es un fallo real, ábrelo en {#bugs}.",
          "**Nuevos moderadores:** solo por invitación del {@fundador}. Nadie recibe permisos a cambio de dinero.",
        ].join("\n"),
      },
    ],
  },
];

/** Publicaciones fijas de los foros (una por foro). */
export const FORUM_POSTS = [
  {
    channel: "bugs",
    title: "📌 Cómo reportar un bug",
    pin: true,
    body: [
      "Para arreglarlo rápido necesito poder repetirlo. Cuéntame:",
      "",
      "1. **Qué pasó** y qué esperabas que pasara.",
      "2. **Pasos** para repetirlo (¿en qué pantalla estabas?).",
      "3. **Dispositivo y navegador** (ej.: iPhone, Safari / Android, Chrome / PC, Edge).",
      "4. **Código de la sala** si fue en una partida.",
      "5. Una **captura o vídeo**, si puedes.",
      "",
      "Una publicación por fallo, y ponle la etiqueta que corresponda. Gracias por ayudar a mejorarlo.",
    ].join("\n"),
  },
  {
    channel: "sugerencias",
    title: "📌 Cómo proponer ideas",
    pin: true,
    body: [
      "Las mejores ideas explican el **problema**, no solo la solución.",
      "",
      "1. **Busca antes** si ya la propusieron y vota con 👍.",
      "2. **Una idea por publicación.**",
      "3. Cuenta **qué quieres lograr** y cómo lo imaginas.",
      "4. Pon la etiqueta que corresponda.",
      "",
      "No prometo hacerlo todo, pero leo todo. Las ideas aceptadas pasan a ⏳ Planeado y luego a ✅ Hecho.",
    ].join("\n"),
  },
];
