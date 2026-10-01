/**
 * Monta (y mantiene) el servidor de Discord de Puja el Once.
 *
 *   npm run plan                      -> valida la config y muestra lo que se creara (no toca Discord)
 *   npm run setup                     -> aplica todo (necesita .env con DISCORD_TOKEN y GUILD_ID)
 *   npm run setup -- --only=content   -> solo una parte: roles,channels,settings,content,emojis,automod,onboarding,webhook,invite
 *   npm run setup -- --limpiar        -> ademas borra los canales de plantilla ("general", "Canales de texto"...)
 *   npm run setup -- --yes            -> sin pedir confirmacion
 *
 * Es repetible: lo que ya existe se actualiza y no se duplica.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  AttachmentBuilder,
  ChannelType,
  Client,
  GatewayIntentBits,
  GuildOnboardingMode,
  GuildOnboardingPromptType,
  Locale,
  SortOrderType,
} from "discord.js";
import { BRAND } from "../config/brand.mjs";
import { FORUM_POSTS, MESSAGES } from "../config/content.mjs";
import { AUTOMOD, CATEGORIES, EMOJIS, EVERYONE_PERMISSIONS, ONBOARDING, ROLES, SERVER, WELCOME_SCREEN } from "../config/server.mjs";
import { buildOverwrites, buttonRow, categoryOverwrites, CHANNEL_TYPES, embedData, mergeTags, NEEDS_COMMUNITY, parseTag } from "./helpers.mjs";
import { ASSETS, normalizeChannelName, render, summary, validate } from "./plan.mjs";

const REASON = "Configuración inicial de Puja el Once";

const ok = (msg) => console.log(`  ✓ ${msg}`);
const skip = (msg) => console.log(`  – ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);

function hint(error) {
  const code = error?.code;
  if (code === 50013) return "Faltan permisos: el rol del bot debe ser Administrador y estar ARRIBA de los demás roles (Ajustes > Roles).";
  if (code === 50001) return "El bot no tiene acceso a ese recurso.";
  if (code === 30008 || code === 30001) return "Se llegó al límite de Discord para este servidor.";
  if (code === 50035) return `Discord rechazó un dato: ${JSON.stringify(error.rawError?.errors ?? error.message).slice(0, 400)}`;
  return error?.message ?? String(error);
}


/**
 * Aplica la configuracion a un servidor. `client` y `guild` son los de discord.js
 * (en las pruebas, dobles). Devuelve la lista de secciones que fallaron.
 */
export async function run({ client, guild, only = [], clean = false }) {
  const wants = (section) => only.length === 0 || only.includes(section);
  const CLEAN = clean;
  const failures = [];
  async function step(name, fn) {
    console.log(`
▸ ${name}`);
    try {
      await fn();
    } catch (error) {
      failures.push(name);
      console.log(`  ✗ ${hint(error)}`);
    }
  }

  const roles = new Map(); // clave -> Role
  const channels = new Map(); // clave -> canal
  const categories = new Map(); // clave -> categoria

  const ctx = {
    guildId: guild.id,
    gameUrl: BRAND.gameUrl,
    channelId: (key) => channels.get(key)?.id,
    roleId: (key) => roles.get(key)?.id,
    render: (text) => render(text, ctx),
  };

  const readAsset = (name) => readFileSync(resolve(ASSETS, name));

  async function loadExisting() {
    const [allRoles, allChannels] = await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
    for (const spec of ROLES) {
      const role = allRoles.find((r) => r.name === spec.name && !r.managed);
      if (role) roles.set(spec.key, role);
    }
    for (const cat of CATEGORIES) {
      const category = allChannels.find((c) => c?.type === ChannelType.GuildCategory && c.name === cat.name);
      if (category) categories.set(cat.key, category);
      for (const spec of cat.channels) {
        const wanted = normalizeChannelName(spec.name, spec.type);
        const found = allChannels.find((c) => c && c.type !== ChannelType.GuildCategory && c.name === wanted);
        if (found) channels.set(spec.key, found);
      }
    }
  }

  const everyoneId = () => guild.roles.everyone.id;
  const ids = () => ({ everyone: everyoneId(), fundador: roleId("fundador"), moderador: roleId("moderador"), tester: roleId("tester") });
  const roleId = (key) => {
    const id = roles.get(key)?.id;
    if (!id) throw new Error(`Falta el rol "${key}": ejecuta también la sección roles.`);
    return id;
  };

  await loadExisting();

  // --------------------------------------------------------------------------- roles

  async function ensureRoles() {
    for (const spec of ROLES) {
      const data = {
        name: spec.name,
        color: spec.color,
        hoist: !!spec.hoist,
        mentionable: !!spec.mentionable,
        permissions: spec.permissions,
        reason: REASON,
      };
      const existing = roles.get(spec.key);
      if (existing) {
        await existing.edit(data);
        skip(`rol actualizado: ${spec.name}`);
      } else {
        roles.set(spec.key, await guild.roles.create(data));
        ok(`rol creado: ${spec.name}`);
      }
    }
    await guild.roles.everyone.setPermissions(EVERYONE_PERMISSIONS, REASON);
    ok("permisos de @everyone ajustados (sin @everyone/@here ni gestión)");

    // Orden: Fundador arriba. Solo si el rol del bot esta por encima de los nuestros.
    const me = await guild.members.fetchMe();
    const top = me.roles.highest.position;
    if (top <= ROLES.length) {
      warn("El rol del bot no está arriba del todo: arrástralo al primer puesto en Ajustes > Roles y vuelve a ejecutar --only=roles para ordenarlos.");
    } else {
      const ordered = ROLES.map((spec) => roles.get(spec.key));
      await guild.roles.setPositions(ordered.map((role, i) => ({ role, position: top - 1 - i })));
      ok("roles ordenados");
    }

    // El dueño del servidor recibe el rol de Fundador.
    const owner = await guild.fetchOwner();
    if (!owner.roles.cache.has(roleId("fundador"))) {
      await owner.roles.add(roleId("fundador"), REASON);
      ok(`rol Fundador para ${owner.user.username}`);
    }
  }

  // --------------------------------------------------------------------------- canales

  async function ensureChannels({ deferred, communityEnabled }) {
    for (const cat of CATEGORIES) {
      let category = categories.get(cat.key);
      if (!category && !deferred) {
        category = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: categoryOverwrites(cat, ids()),
          reason: REASON,
        });
        categories.set(cat.key, category);
        ok(`categoría creada: ${cat.name}`);
      }
      if (!category) continue;

      for (const spec of cat.channels) {
        const needsCommunity = NEEDS_COMMUNITY.has(spec.type);
        if (needsCommunity !== deferred) continue;

        let type = spec.type;
        if (needsCommunity && !communityEnabled) {
          type = "text";
          warn(`${spec.name}: el servidor aún no es de Comunidad, se crea como canal de texto normal`);
        }
        const data = {
          name: spec.name,
          type: CHANNEL_TYPES[type],
          parent: category.id,
          permissionOverwrites: buildOverwrites(spec, ids(), !!cat.staff),
          reason: REASON,
        };
        if (spec.topic && type !== "voice") data.topic = spec.topic;
        if (spec.slowmode !== undefined && type !== "voice") data.rateLimitPerUser = spec.slowmode;
        if (type === "voice") data.userLimit = spec.userLimit ?? 0;
        if (type === "forum") {
          data.availableTags = spec.tags.map(parseTag);
          if (spec.key === "sugerencias") data.defaultReactionEmoji = { id: null, name: "👍" };
          data.defaultSortOrder = SortOrderType.CreationDate;
        }

        const existing = channels.get(spec.key);
        if (existing) {
          const { type: _t, parent: _p, ...editData } = data;
          if (type === "forum" && existing.type === ChannelType.GuildForum) editData.availableTags = mergeTags(existing.availableTags ?? [], spec.tags);
          await existing.edit({ ...editData, parent: category.id });
          skip(`canal actualizado: ${spec.name}`);
        } else {
          channels.set(spec.key, await guild.channels.create(data));
          ok(`canal creado: ${spec.name}`);
        }
      }
    }
  }

  async function orderChannels() {
    const positions = [];
    CATEGORIES.forEach((cat, i) => {
      const category = categories.get(cat.key);
      if (category) positions.push({ channel: category.id, position: i });
    });
    for (const cat of CATEGORIES) {
      cat.channels.forEach((spec, i) => {
        const channel = channels.get(spec.key);
        if (channel) positions.push({ channel: channel.id, position: i, parent: categories.get(cat.key)?.id, lockPermissions: false });
      });
    }
    await guild.channels.setPositions(positions);
    ok("canales ordenados");
  }

  async function cleanTemplateChannels() {
    const ours = new Set([...channels.values(), ...categories.values()].map((c) => c.id));
    const templateNames = new Set(["general", "General", "Text Channels", "Voice Channels", "Canales de texto", "Canales de voz"]);
    const all = await guild.channels.fetch();
    for (const channel of all.values()) {
      if (!channel || ours.has(channel.id) || !templateNames.has(channel.name)) continue;
      await channel.delete(REASON);
      ok(`canal de plantilla borrado: ${channel.name}`);
    }
  }

  // --------------------------------------------------------------------------- ajustes

  async function applySettings() {
    const staff = channels.get(SERVER.publicUpdatesChannel);
    const rules = channels.get(SERVER.rulesChannel);
    const system = channels.get(SERVER.systemChannel);
    if (!staff || !rules || !system) throw new Error("Faltan canales (reglas, staff, general): ejecuta también la sección channels.");

    const features = [...new Set([...guild.features, "COMMUNITY"])];
    await guild.edit({
      name: SERVER.name,
      icon: readAsset("icon.png"),
      preferredLocale: Locale.SpanishLATAM,
      verificationLevel: SERVER.verificationLevel,
      explicitContentFilter: SERVER.explicitContentFilter,
      defaultMessageNotifications: SERVER.defaultMessageNotifications,
      systemChannel: system.id,
      rulesChannel: rules.id,
      publicUpdatesChannel: staff.id,
      features,
      reason: REASON,
    });
    ok("nombre, icono, idioma, verificación y modo Comunidad");

    // Banner y fondo de invitacion: requieren niveles de boost, asi que se intentan sin romper nada.
    for (const [label, key, file] of [["banner", "banner", "banner.png"], ["fondo de invitación", "splash", "splash.png"]]) {
      try {
        await guild.edit({ [key]: readAsset(file), reason: REASON });
        ok(`${label} subido`);
      } catch {
        warn(`${label}: Discord lo pide con boosts (nivel 1 para el fondo, 2 para el banner). Está listo en assets/${file} para subirlo luego.`);
      }
    }
  }

  // --------------------------------------------------------------------------- contenido

  async function upsertMessage(spec) {
    const channel = channels.get(spec.channel);
    if (!channel) throw new Error(`Falta el canal ${spec.channel}`);
    const first = spec.embeds[0].title;
    const recent = await channel.messages.fetch({ limit: 50 });
    const existing = recent.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === first);

    const embeds = spec.embeds.map((embed, i) => embedData(embed, ctx, i === 0 ? spec.image : undefined));
    const payload = { embeds, allowedMentions: { parse: [] } };
    if (spec.buttons?.length) payload.components = [buttonRow(spec.buttons, ctx)];

    let message;
    if (existing) {
      message = await existing.edit(payload);
      skip(`mensaje actualizado: ${first}`);
    } else {
      if (spec.image) payload.files = [new AttachmentBuilder(resolve(ASSETS, spec.image), { name: spec.image })];
      message = await channel.send(payload);
      ok(`mensaje publicado en #${channel.name}: ${first}`);
    }
    if (spec.pin && !message.pinned) await message.pin().catch(() => warn(`no se pudo fijar: ${first}`));
  }

  async function upsertForumPost(post) {
    const forum = channels.get(post.channel);
    if (!forum) throw new Error(`Falta el foro ${post.channel}`);
    if (forum.type !== ChannelType.GuildForum) {
      // Sin modo Comunidad el foro es un canal de texto normal.
      const recent = await forum.messages.fetch({ limit: 20 });
      if (recent.some((m) => m.author.id === client.user.id && m.content.startsWith(post.title))) return skip(`ya existe: ${post.title}`);
      const sent = await forum.send({ content: `**${post.title}**\n\n${post.body}`, allowedMentions: { parse: [] } });
      if (post.pin) await sent.pin().catch(() => {});
      return ok(`aviso publicado en #${forum.name}: ${post.title}`);
    }
    const active = await forum.threads.fetchActive();
    const archived = await forum.threads.fetchArchived({ limit: 50 });
    const existing = [...active.threads.values(), ...archived.threads.values()].find((t) => t.name === post.title);
    if (existing) return skip(`publicación ya existe: ${post.title}`);
    const thread = await forum.threads.create({ name: post.title, message: { content: post.body }, reason: REASON });
    if (post.pin) await thread.pin().catch(() => warn(`no se pudo fijar: ${post.title}`));
    ok(`publicación creada en #${forum.name}: ${post.title}`);
  }

  // --------------------------------------------------------------------------- emojis, automod, onboarding

  async function ensureEmojis() {
    const existing = await guild.emojis.fetch();
    for (const name of EMOJIS) {
      if (existing.some((e) => e.name === name)) {
        skip(`emoji ya existe: :${name}:`);
        continue;
      }
      await guild.emojis.create({ attachment: resolve(ASSETS, `emoji-${name}.png`), name, reason: REASON });
      ok(`emoji creado: :${name}:`);
    }
  }

  async function ensureAutomod() {
    const logs = channels.get("logs");
    const staff = channels.get("staff");
    const existing = await guild.autoModerationRules.fetch();
    const exemptChannels = [logs?.id, staff?.id].filter(Boolean);

    for (const spec of AUTOMOD) {
      const actions = [];
      if (spec.kind !== "preset" || spec.block) {
        actions.push({ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Este mensaje no cumple las reglas del vestuario." } });
      }
      if (logs) actions.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channel: logs.id } });
      if (spec.kind === "mentions") actions.push({ type: AutoModerationActionType.Timeout, metadata: { durationSeconds: spec.timeoutSeconds } });

      const common = {
        name: spec.name,
        eventType: AutoModerationRuleEventType.MessageSend,
        actions,
        enabled: true,
        exemptRoles: (spec.exemptRoles ?? ["moderador", "fundador"]).map(roleId),
        exemptChannels,
        reason: REASON,
      };
      let rule;
      if (spec.kind === "preset") {
        rule = { ...common, triggerType: AutoModerationRuleTriggerType.KeywordPreset, triggerMetadata: { presets: spec.presets.map((p) => AutoModerationRuleKeywordPresetType[p]) } };
      } else if (spec.kind === "mentions") {
        rule = { ...common, triggerType: AutoModerationRuleTriggerType.MentionSpam, triggerMetadata: { mentionTotalLimit: spec.limit } };
      } else if (spec.kind === "spam") {
        rule = { ...common, triggerType: AutoModerationRuleTriggerType.Spam };
      } else {
        rule = { ...common, triggerType: AutoModerationRuleTriggerType.Keyword, triggerMetadata: { regexPatterns: spec.patterns } };
      }

      const found = existing.find((r) => r.name === spec.name);
      if (found) {
        const { triggerType: _t, reason: _r, ...edit } = rule;
        await found.edit(edit);
        skip(`AutoMod actualizada: ${spec.name}`);
      } else {
        await guild.autoModerationRules.create(rule);
        ok(`AutoMod creada: ${spec.name}`);
      }
    }
  }

  async function applyOnboarding() {
    const prompts = ONBOARDING.prompts.map((prompt) => ({
      title: prompt.title,
      singleSelect: prompt.singleSelect,
      required: prompt.required,
      inOnboarding: true,
      type: GuildOnboardingPromptType.MultipleChoice,
      options: prompt.options.map((opt) => ({
        title: opt.title,
        description: opt.description,
        emoji: opt.emoji,
        roles: opt.role ? [roleId(opt.role)] : [],
        channels: (opt.channels ?? []).map((key) => channels.get(key).id),
      })),
    }));
    await guild.editOnboarding({
      prompts,
      defaultChannels: ONBOARDING.defaultChannels.map((key) => channels.get(key).id),
      enabled: true,
      mode: GuildOnboardingMode.OnboardingDefault,
      reason: REASON,
    });
    ok("Canales y roles (onboarding) activado");

    await guild.editWelcomeScreen({
      enabled: true,
      description: WELCOME_SCREEN.description,
      welcomeChannels: WELCOME_SCREEN.channels.map((entry) => ({ channel: channels.get(entry.channel).id, description: entry.description, emoji: entry.emoji })),
    });
    ok("pantalla de bienvenida activada");
  }

  async function ensureWebhook() {
    const channel = channels.get("comentarios");
    if (!channel || !("fetchWebhooks" in channel)) throw new Error("Falta el canal comentarios.");
    const name = "Comentarios del juego";
    const hooks = await channel.fetchWebhooks();
    let hook = hooks.find((h) => h.name === name && h.owner?.id === client.user.id);
    if (!hook) {
      hook = await channel.createWebhook({ name, avatar: readAsset("icon.png"), reason: REASON });
      ok(`webhook creado en #${channel.name}`);
    } else {
      skip(`webhook ya existe en #${channel.name}`);
    }
    const out = resolve(ASSETS, "../out");
    mkdirSync(out, { recursive: true });
    const file = resolve(out, "webhook-url.txt");
    writeFileSync(file, `${hook.url}\n`, { mode: 0o600 });
    ok("URL guardada en out/webhook-url.txt (es secreta: pégala en Render como FEEDBACK_WEBHOOK_URL y no la compartas)");
  }



  async function ensureInvite() {
    const channel = channels.get("bienvenida");
    if (!channel) throw new Error("Falta el canal bienvenida.");
    // unique:false -> si ya existe una invitacion permanente igual, Discord devuelve esa.
    const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: false, reason: REASON });
    const out = resolve(ASSETS, "../out");
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, "invite-url.txt"), `${invite.url}
`);
    ok(`invitación permanente: ${invite.url}`);
  }

  let communityEnabled = guild.features.includes("COMMUNITY");

  if (wants("roles")) await step("Roles", ensureRoles);
  if (wants("channels")) {
    await step("Canales", () => ensureChannels({ deferred: false, communityEnabled }));
  }
  if (wants("settings")) {
    await step("Ajustes del servidor (modo Comunidad)", async () => {
      await applySettings();
      await guild.fetch();
      communityEnabled = guild.features.includes("COMMUNITY");
    });
  }
  if (wants("channels")) {
    await step("Canales de Comunidad (foros y anuncios)", () => ensureChannels({ deferred: true, communityEnabled }));
    await step("Orden de canales", orderChannels);
    if (CLEAN) await step("Limpieza de canales de plantilla", cleanTemplateChannels);
  }
  if (wants("content")) {
    await step("Mensajes fijos", async () => {
      for (const msg of MESSAGES) await upsertMessage(msg);
    });
    await step("Publicaciones de los foros", async () => {
      for (const post of FORUM_POSTS) await upsertForumPost(post);
    });
  }
  if (wants("emojis")) await step("Emojis", ensureEmojis);
  if (wants("automod")) await step("AutoMod", ensureAutomod);
  if (wants("onboarding")) await step("Canales y roles + bienvenida", applyOnboarding);
  if (wants("webhook")) await step("Webhook de comentarios", ensureWebhook);
  if (wants("invite")) await step("Enlace de invitación", ensureInvite);

  return failures;

}

// --------------------------------------------------------------------------- CLI

async function main() {
  const args = new Set(process.argv.slice(2));
  const DRY = args.has("--dry");
  const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").replace("--only=", "").split(",").filter(Boolean);

  const problems = validate();
  if (problems.length) {
    console.error("La configuración tiene problemas:\n" + problems.map((p) => `  • ${p}`).join("\n"));
    process.exit(1);
  }
  if (DRY) {
    console.log(summary());
    console.log("\n✓ Configuración válida. No se ha tocado Discord (--dry).");
    process.exit(0);
  }

  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.GUILD_ID;
  if (!token || !guildId) {
    console.error("Falta DISCORD_TOKEN o GUILD_ID. Copia .env.example a .env y rellénalo (ver README).");
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  const guild = await client.guilds.fetch(guildId);

  if (!args.has("--yes")) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`\nSe va a configurar el servidor "${guild.name}" (${guild.id}). ¿Continuar? (escribe SI) `);
    rl.close();
    if (answer.trim().toUpperCase() !== "SI") {
      console.log("Cancelado.");
      await client.destroy();
      process.exit(0);
    }
  }

  const failures = await run({ client, guild, only: ONLY, clean: args.has("--limpiar") });
  console.log(
    failures.length
      ? `\nTerminado con errores en: ${failures.join(", ")}. Corrige y vuelve a ejecutar (es repetible).`
      : "\n✓ Servidor listo.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
