import { ButtonStyle, ChannelType, PermissionFlagsBits as P } from "discord.js";

/** Tipo de canal de la config -> tipo de Discord. */
export const CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
  voice: ChannelType.GuildVoice,
};

/** Los que exigen que el servidor ya sea de Comunidad: se crean despues de activarla. */
export const NEEDS_COMMUNITY = new Set(["announcement", "forum"]);

/** "💡 Idea" -> { name: "Idea", emoji: { id: null, name: "💡" } }. */
export function parseTag(label) {
  const match = label.match(/^(\p{Extended_Pictographic}️?)\s+(.+)$/u);
  if (!match) return { name: label };
  return { name: match[2], emoji: { id: null, name: match[1] } };
}

/**
 * Etiquetas de un foro ya existente + las que faltan. Las existentes conservan su
 * id: si se mandaran sin id, Discord las borraria y las publicaciones perderian su etiqueta.
 */
export function mergeTags(existing, desired) {
  const known = new Set(existing.map((tag) => tag.name));
  return [...existing, ...desired.map(parseTag).filter((tag) => !known.has(tag.name))];
}

const THREAD_WRITE = [P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads];

/**
 * Permisos por canal. `ids` = { everyone, fundador, moderador, tester } (Snowflakes).
 * - staff: oculto para todos salvo Fundador y Moderador.
 * - testers: oculto salvo Tester y staff.
 * - readonly: todos leen, solo el staff escribe.
 */
export function buildOverwrites(spec, ids, categoryIsStaff = false) {
  const staffAllow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.Connect, P.Speak, P.ManageMessages];
  const out = [];

  if (spec.staff || categoryIsStaff) {
    out.push({ id: ids.everyone, deny: [P.ViewChannel] });
    out.push({ id: ids.moderador, allow: staffAllow });
    return out;
  }
  if (spec.testers) {
    out.push({ id: ids.everyone, deny: [P.ViewChannel] });
    out.push({ id: ids.tester, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] });
    out.push({ id: ids.moderador, allow: staffAllow });
    return out;
  }
  if (spec.readonly) {
    out.push({ id: ids.everyone, deny: [P.SendMessages, ...THREAD_WRITE] });
    out.push({ id: ids.moderador, allow: [P.SendMessages, ...THREAD_WRITE, P.ManageMessages] });
    return out;
  }
  return out;
}

/** Overwrites de una categoria privada (la categoria "STAFF"). */
export function categoryOverwrites(spec, ids) {
  return spec.staff ? [{ id: ids.everyone, deny: [P.ViewChannel] }, { id: ids.moderador, allow: [P.ViewChannel] }] : [];
}

export function embedData(embed, ctx, imageName) {
  const data = {
    color: embed.color,
    title: embed.title,
    description: embed.description ? ctx.render(embed.description) : undefined,
    fields: (embed.fields ?? []).map((f) => ({ name: f.name, value: ctx.render(f.value) })),
  };
  if (embed.footer) data.footer = { text: embed.footer };
  if (imageName) data.image = { url: `attachment://${imageName}` };
  return data;
}

export function buttonRow(buttons, ctx) {
  return {
    type: 1,
    components: buttons.map((b) => ({ type: 2, style: ButtonStyle.Link, label: b.label, url: ctx.render(b.url) })),
  };
}
