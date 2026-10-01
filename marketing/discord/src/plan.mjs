import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND } from "../config/brand.mjs";
import { MESSAGES, FORUM_POSTS } from "../config/content.mjs";
import { AUTOMOD, CATEGORIES, EMOJIS, EVENTS, ONBOARDING, ROLES, SERVER, WELCOME_SCREEN } from "../config/server.mjs";

import { parseTag } from "./helpers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ASSETS = resolve(HERE, "../assets");

/** Limites de Discord (documentacion oficial); validarlos aqui evita que el script falle a mitad. */
export const LIMITS = {
  roles: 250,
  channels: 500,
  channelsPerCategory: 50,
  name: 100,
  topic: 1024,
  forumTopic: 4096,
  forumTags: 20,
  tagName: 20,
  embedTitle: 256,
  embedDescription: 4096,
  embedFields: 25,
  fieldName: 256,
  fieldValue: 1024,
  embedFooter: 2048,
  embedsPerMessage: 10,
  messageTotal: 6000,
  buttonsPerRow: 5,
  buttonLabel: 80,
  emojiName: [2, 32],
  onboardingOptionTitle: 50,
  onboardingOptionDescription: 100,
  onboardingPromptTitle: 100,
  welcomeChannels: 5,
  welcomeDescription: 140,
  welcomeChannelDescription: 50,
  automodRules: 6, // por tipo de disparador de palabras clave
};

const channelKeys = () => CATEGORIES.flatMap((c) => c.channels.map((ch) => ch.key));
const roleKeys = () => ROLES.map((r) => r.key);

/** Normaliza un nombre de canal como lo hace Discord (minusculas, espacios -> guiones en los de texto). */
export function normalizeChannelName(name, type) {
  const lower = name.toLowerCase();
  return type === "voice" ? name : lower.replace(/\s+/g, "-");
}

/** Sustituye {#canal}, {@rol}, {game} y {channel:clave} (este ultimo solo en botones). */
export function render(text, ctx) {
  return text
    .replaceAll("{game}", ctx.gameUrl)
    .replace(/\{#([\w-]+)\}/g, (_, key) => (ctx.channelId(key) ? `<#${ctx.channelId(key)}>` : `#${key}`))
    .replace(/\{:(\w+)\}/g, (_, name) => (ctx.emoji ? ctx.emoji(name) : ""))
    .replace(/\{@([\w-]+)\}/g, (_, key) => (ctx.roleId(key) ? `<@&${ctx.roleId(key)}>` : `@${key}`))
    .replace(/\{channel:([\w-]+)\}/g, (_, key) => (ctx.guildId && ctx.channelId(key) ? `https://discord.com/channels/${ctx.guildId}/${ctx.channelId(key)}` : `{channel:${key}}`));
}

/** Largo de un embed tal como lo cuenta Discord (titulo + descripcion + campos + pie). */
export function embedLength(embed) {
  return (
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.footer?.length ?? 0) +
    (embed.fields ?? []).reduce((sum, f) => sum + f.name.length + f.value.length, 0)
  );
}

/** Devuelve una lista de problemas; vacia = el plan es valido. */
export function validate() {
  const problems = [];
  const fail = (message) => problems.push(message);

  const dup = (list, label) => {
    const seen = new Set();
    for (const item of list) {
      if (seen.has(item)) fail(`${label} repetido: ${item}`);
      seen.add(item);
    }
  };
  dup(roleKeys(), "Rol (key)");
  dup(ROLES.map((r) => r.name), "Rol (nombre)");
  dup(channelKeys(), "Canal (key)");
  dup(CATEGORIES.map((c) => c.key), "Categoria (key)");
  dup(CATEGORIES.flatMap((c) => c.channels.map((ch) => normalizeChannelName(ch.name, ch.type))), "Canal (nombre)");

  if (ROLES.length > LIMITS.roles) fail(`Demasiados roles: ${ROLES.length}`);
  const total = CATEGORIES.length + channelKeys().length;
  if (total > LIMITS.channels) fail(`Demasiados canales: ${total}`);

  for (const role of ROLES) {
    if (role.name.length > LIMITS.name) fail(`Rol demasiado largo: ${role.name}`);
  }

  for (const cat of CATEGORIES) {
    if (cat.name.length > LIMITS.name) fail(`Categoria demasiado larga: ${cat.name}`);
    if (cat.channels.length > LIMITS.channelsPerCategory) fail(`Categoria con demasiados canales: ${cat.name}`);
    for (const ch of cat.channels) {
      if (ch.name.length > LIMITS.name) fail(`Canal demasiado largo: ${ch.name}`);
      if (!["text", "announcement", "forum", "voice"].includes(ch.type)) fail(`Tipo de canal desconocido: ${ch.key} (${ch.type})`);
      if (ch.topic && ch.topic.length > (ch.type === "forum" ? LIMITS.forumTopic : LIMITS.topic)) fail(`Descripcion demasiado larga: ${ch.key}`);
      if (ch.slowmode !== undefined && (ch.slowmode < 0 || ch.slowmode > 21600)) fail(`Modo lento fuera de rango: ${ch.key}`);
      if (ch.userLimit !== undefined && (ch.userLimit < 0 || ch.userLimit > 99)) fail(`Limite de usuarios fuera de rango: ${ch.key}`);
      if (ch.tags) {
        if (ch.tags.length > LIMITS.forumTags) fail(`Demasiadas etiquetas en ${ch.key}`);
        for (const tag of ch.tags) if (parseTag(tag).name.length > LIMITS.tagName) fail(`Etiqueta demasiado larga en ${ch.key}: ${tag}`);
      }
    }
  }

  // AutoMod
  const keywordRules = AUTOMOD.filter((r) => r.kind === "preset" || r.kind === "regex").length;
  if (keywordRules > LIMITS.automodRules) fail(`Demasiadas reglas de AutoMod de palabras clave: ${keywordRules}`);
  for (const rule of AUTOMOD) {
    for (const key of rule.exemptRoles ?? []) if (!roleKeys().includes(key)) fail(`AutoMod ${rule.key}: rol desconocido ${key}`);
    for (const pattern of rule.patterns ?? []) {
      if (pattern.length > 260) fail(`AutoMod ${rule.key}: patron demasiado largo`);
      try {
        new RegExp(pattern);
      } catch {
        fail(`AutoMod ${rule.key}: expresion regular invalida`);
      }
    }
  }

  // Emojis
  for (const name of EMOJIS) {
    const [min, max] = LIMITS.emojiName;
    if (name.length < min || name.length > max || !/^\w+$/.test(name)) fail(`Nombre de emoji invalido: ${name}`);
    if (!existsSync(resolve(ASSETS, `emoji-${name}.png`))) fail(`Falta assets/emoji-${name}.png (ejecuta npm run assets)`);
  }
  for (const file of ["icon.png", "banner.png", "splash.png", "welcome.png", "rules.png", "howto.png"]) {
    if (!existsSync(resolve(ASSETS, file))) fail(`Falta assets/${file} (ejecuta npm run assets)`);
  }

  // Onboarding
  for (const key of ONBOARDING.defaultChannels) if (!channelKeys().includes(key)) fail(`Onboarding: canal por defecto desconocido ${key}`);
  const writable = ONBOARDING.defaultChannels.filter((key) => {
    const ch = CATEGORIES.flatMap((c) => c.channels).find((c) => c.key === key);
    return ch && !ch.readonly && ch.type === "text";
  });
  if (ONBOARDING.defaultChannels.length < 7) fail("Onboarding: Discord exige al menos 7 canales por defecto");
  if (writable.length < 5) fail(`Onboarding: Discord exige 5 canales por defecto donde se pueda escribir (hay ${writable.length})`);
  for (const prompt of ONBOARDING.prompts) {
    if (prompt.title.length > LIMITS.onboardingPromptTitle) fail(`Onboarding: titulo largo: ${prompt.title}`);
    for (const opt of prompt.options) {
      if (opt.title.length > LIMITS.onboardingOptionTitle) fail(`Onboarding: opcion larga: ${opt.title}`);
      if ((opt.description ?? "").length > LIMITS.onboardingOptionDescription) fail(`Onboarding: descripcion larga: ${opt.title}`);
      if (opt.role && !roleKeys().includes(opt.role)) fail(`Onboarding: rol desconocido ${opt.role}`);
      for (const key of opt.channels ?? []) if (!channelKeys().includes(key)) fail(`Onboarding: canal desconocido ${key}`);
      if (!opt.role && !(opt.channels ?? []).length) fail(`Onboarding: la opcion "${opt.title}" necesita un rol o un canal`);
    }
  }

  // Pantalla de bienvenida
  if (WELCOME_SCREEN.description.length > LIMITS.welcomeDescription) fail("Pantalla de bienvenida: descripcion demasiado larga");
  if (WELCOME_SCREEN.channels.length > LIMITS.welcomeChannels) fail("Pantalla de bienvenida: maximo 5 canales");
  for (const entry of WELCOME_SCREEN.channels) {
    if (!channelKeys().includes(entry.channel)) fail(`Pantalla de bienvenida: canal desconocido ${entry.channel}`);
    if (entry.description.length > LIMITS.welcomeChannelDescription) fail(`Pantalla de bienvenida: descripcion larga: ${entry.channel}`);
  }

  if (SERVER.description.length > 120) fail(`La descripcion del servidor tiene ${SERVER.description.length} caracteres (maximo 120)`);
  for (const event of EVENTS) {
    const ch = CATEGORIES.flatMap((c) => c.channels).find((c) => c.key === event.voice);
    if (!ch || ch.type !== "voice") fail(`Evento ${event.name}: ${event.voice} no es un canal de voz`);
    if (event.name.length > 100 || event.description.length > 1000) fail(`Evento ${event.name}: texto demasiado largo`);
    if (event.image && !existsSync(resolve(ASSETS, event.image))) fail(`Evento ${event.name}: falta assets/${event.image}`);
  }
  for (const key of [SERVER.systemChannel, SERVER.rulesChannel, SERVER.publicUpdatesChannel]) {
    if (!channelKeys().includes(key)) fail(`Ajustes del servidor: canal desconocido ${key}`);
  }

  // Mensajes
  const refs = (text) => ({
    channels: [...text.matchAll(/\{#([\w-]+)\}/g)].map((m) => m[1]).concat([...text.matchAll(/\{channel:([\w-]+)\}/g)].map((m) => m[1])),
    roles: [...text.matchAll(/\{@([\w-]+)\}/g)].map((m) => m[1]),
    emojis: [...text.matchAll(/\{:(\w+)\}/g)].map((m) => m[1]),
  });
  const checkRefs = (where, text) => {
    const { channels, roles, emojis } = refs(text);
    for (const name of emojis) if (!EMOJIS.includes(name)) fail(`${where}: emoji desconocido {:${name}}`);
    for (const key of channels) if (!channelKeys().includes(key)) fail(`${where}: canal desconocido {${key}}`);
    for (const key of roles) if (!roleKeys().includes(key)) fail(`${where}: rol desconocido {${key}}`);
  };

  const titles = new Set();
  for (const msg of MESSAGES) {
    const where = `Mensaje ${msg.channel}/${msg.embeds?.[0]?.title ?? "?"}`;
    if (!channelKeys().includes(msg.channel)) fail(`${where}: canal desconocido`);
    if (!msg.embeds?.length) fail(`${where}: sin embeds`);
    if (msg.embeds.length > LIMITS.embedsPerMessage) fail(`${where}: demasiados embeds`);
    if (msg.image && !existsSync(resolve(ASSETS, msg.image))) fail(`${where}: falta assets/${msg.image}`);
    if (msg.thumbnail && !existsSync(resolve(ASSETS, msg.thumbnail))) fail(`${where}: falta assets/${msg.thumbnail}`);
    const idKey = `${msg.channel}:${msg.embeds[0].title}`;
    if (titles.has(idKey)) fail(`${where}: titulo repetido en el mismo canal (se usa para reconocer el mensaje)`);
    titles.add(idKey);

    let sum = 0;
    for (const embed of msg.embeds) {
      sum += embedLength(embed);
      if (!embed.title || embed.title.length > LIMITS.embedTitle) fail(`${where}: titulo ausente o largo`);
      if ((embed.description ?? "").length > LIMITS.embedDescription) fail(`${where}: descripcion larga`);
      if ((embed.fields ?? []).length > LIMITS.embedFields) fail(`${where}: demasiados campos`);
      if ((embed.footer ?? "").length > LIMITS.embedFooter) fail(`${where}: pie largo`);
      for (const f of embed.fields ?? []) {
        if (f.name.length > LIMITS.fieldName) fail(`${where}: nombre de campo largo: ${f.name}`);
        if (f.value.length > LIMITS.fieldValue) fail(`${where}: valor de campo largo (${f.value.length}): ${f.name}`);
        checkRefs(where, f.value);
      }
      checkRefs(where, embed.description ?? "");
    }
    // Las menciones se expanden a ~22 caracteres: se deja margen.
    if (sum > LIMITS.messageTotal - 600) fail(`${where}: ${sum} caracteres, cerca del limite de ${LIMITS.messageTotal}`);

    if ((msg.buttons ?? []).length > LIMITS.buttonsPerRow) fail(`${where}: demasiados botones`);
    for (const b of msg.buttons ?? []) {
      if (b.label.length > LIMITS.buttonLabel) fail(`${where}: boton largo: ${b.label}`);
      checkRefs(where, b.url);
    }
  }

  for (const post of FORUM_POSTS) {
    const ch = CATEGORIES.flatMap((c) => c.channels).find((c) => c.key === post.channel);
    if (!ch || ch.type !== "forum") fail(`Publicacion de foro: ${post.channel} no es un foro`);
    if (post.title.length > LIMITS.name) fail(`Publicacion de foro: titulo largo: ${post.title}`);
    if (post.body.length > 2000) fail(`Publicacion de foro: ${post.title} supera 2000 caracteres`);
  }

  return problems;
}

/** Resumen legible del plan, para --dry y para el final del README. */
export function summary() {
  const lines = [];
  lines.push(`Servidor: ${SERVER.name} (${BRAND.gameUrl})`);
  lines.push(`Roles (${ROLES.length}): ${ROLES.map((r) => r.name).join(" · ")}`);
  for (const cat of CATEGORIES) {
    lines.push(`\n${cat.name}${cat.staff ? "  [privada]" : ""}`);
    for (const ch of cat.channels) {
      const tags = [ch.type !== "text" ? ch.type : null, ch.readonly ? "solo lectura" : null, ch.staff ? "staff" : null, ch.testers ? "testers" : null, ch.slowmode ? `${ch.slowmode}s` : null].filter(Boolean);
      lines.push(`  ${ch.name}${tags.length ? `  (${tags.join(", ")})` : ""}`);
    }
  }
  lines.push(`\nMensajes fijos: ${MESSAGES.length} · publicaciones de foro: ${FORUM_POSTS.length}`);
  lines.push(`AutoMod: ${AUTOMOD.map((r) => r.name).join(" · ")}`);
  lines.push(`Emojis: ${EMOJIS.join(", ")}`);
  lines.push(`Canales y roles (onboarding): ${ONBOARDING.prompts.map((p) => p.title).join(" · ")}`);
  return lines.join("\n");
}
