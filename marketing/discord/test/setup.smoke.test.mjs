/**
 * Prueba de humo de run() contra un servidor FALSO que imita la API de discord.js.
 * No habla con Discord: sirve para pillar errores de orden, de tipos o de
 * idempotencia (repetir el script no debe duplicar nada). No sustituye a una
 * ejecucion real: Discord puede rechazar cosas que aqui se aceptan.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ChannelType } from "discord.js";
import { CATEGORIES, ROLES, AUTOMOD } from "../config/server.mjs";
import { FORUM_POSTS, MESSAGES } from "../config/content.mjs";
import { run } from "../src/setup.mjs";

class Collection extends Map {
  find(fn) {
    for (const value of this.values()) if (fn(value)) return value;
    return undefined;
  }
  some(fn) {
    return this.find(fn) !== undefined;
  }
}

function makeServer() {
  let nextId = 1000;
  const id = () => String(nextId++);
  const log = { rolesCreated: 0, channelsCreated: [], messagesSent: 0, messagesEdited: 0, pins: 0, automodCreated: 0, threads: 0, emojis: 0 };
  const botId = "bot";

  const emojiStore = new Collection();
  const roles = new Collection();
  const channels = new Collection();
  const everyone = { id: id(), setPermissions: async function (p) { this.permissions = p; } };
  roles.set(everyone.id, { ...everyone, name: "@everyone" });

  const makeChannel = (data) => {
    const channel = {
      id: id(),
      ...data,
      sent: [],
      availableTags: data.availableTags?.map((t, i) => ({ id: String(i + 1), ...t })) ?? [],
      messages: { fetch: async () => channel.sent.slice().reverse() },
      threads: {
        fetchActive: async () => ({ threads: new Collection(channel.threadList?.map((t) => [t.id, t])) }),
        fetchArchived: async () => ({ threads: new Collection() }),
        create: async ({ name }) => {
          log.threads++;
          const t = { id: id(), name, pin: async () => { log.pins++; } };
          (channel.threadList ??= []).push(t);
          return t;
        },
      },
      send: async (payload) => {
        log.messagesSent++;
        const msg = {
          author: { id: botId },
          embeds: payload.embeds ?? [],
          content: payload.content ?? "",
          pinned: false,
          pin: async () => { msg.pinned = true; log.pins++; },
          edit: async (p) => { log.messagesEdited++; msg.embeds = p.embeds; return msg; },
        };
        channel.sent.push(msg);
        return msg;
      },
      edit: async (patch) => Object.assign(channel, patch),
      delete: async () => channels.delete(channel.id),
      createInvite: async () => ({ url: "https://discord.gg/abc" }),
      fetchWebhooks: async () => [],
      createWebhook: async () => ({ url: "https://discord.com/api/webhooks/1/token" }),
    };
    return channel;
  };

  const guild = {
    id: "g1",
    name: "Servidor de prueba",
    features: [],
    roles: {
      everyone,
      fetch: async () => roles,
      create: async (data) => {
        log.rolesCreated++;
        const role = { id: id(), ...data, managed: false, edit: async (d) => Object.assign(role, d) };
        roles.set(role.id, role);
        return role;
      },
      setPositions: async () => {},
    },
    members: { fetchMe: async () => ({ roles: { highest: { position: 99 } } }) },
    fetchOwner: async () => ({ user: { username: "dueño" }, roles: { cache: { has: () => false }, add: async () => {} } }),
    channels: {
      fetch: async () => channels,
      create: async (data) => {
        // Discord solo deja crear foros y anuncios en servidores de Comunidad.
        if ([ChannelType.GuildForum, ChannelType.GuildAnnouncement].includes(data.type) && !guild.features.includes("COMMUNITY")) {
          throw Object.assign(new Error("Comunidad requerida"), { code: 50024 });
        }
        const channel = makeChannel(data);
        channels.set(channel.id, channel);
        log.channelsCreated.push(channel);
        return channel;
      },
      setPositions: async () => {},
    },
    edit: async (data) => {
      if (data.features) guild.features = [...data.features];
      return guild;
    },
    fetch: async () => guild,
    emojis: {
      fetch: async () => emojiStore,
      create: async ({ name }) => {
        log.emojis++;
        const e = { id: id(), name };
        emojiStore.set(e.id, e);
        return e;
      },
    },
    autoModerationRules: {
      fetch: async () => new Collection(),
      create: async () => { log.automodCreated++; },
    },
    editOnboarding: async (data) => { log.onboarding = data; },
    editWelcomeScreen: async (data) => { log.welcome = data; },
  };
  return { client: { user: { id: botId } }, guild, log, channels, roles };
}

test("run() monta el servidor completo y es repetible sin duplicar nada", async () => {
  const quiet = console.log;
  console.log = () => {};
  try {
    const { client, guild, log, channels } = makeServer();

    const first = await run({ client, guild });
    assert.deepEqual(first, [], "no debe fallar ninguna seccion");

    const totalChannels = CATEGORIES.reduce((n, c) => n + c.channels.length, 0);
    assert.equal(log.rolesCreated, ROLES.length);
    assert.equal(log.channelsCreated.filter((c) => c.type === ChannelType.GuildCategory).length, CATEGORIES.length);
    assert.equal(log.channelsCreated.length, CATEGORIES.length + totalChannels);

    // Los foros y anuncios se crean DESPUES de activar Comunidad.
    assert.ok(guild.features.includes("COMMUNITY"));
    assert.equal([...channels.values()].filter((c) => c.type === ChannelType.GuildForum).length, 2);
    assert.equal([...channels.values()].filter((c) => c.type === ChannelType.GuildAnnouncement).length, 1);

    // Mensajes, foros, automod y onboarding.
    assert.equal(log.messagesSent, MESSAGES.length + 0);
    assert.equal(log.threads, FORUM_POSTS.length);
    assert.equal(log.automodCreated, AUTOMOD.length);
    assert.equal(log.emojis, 7);
    assert.equal(log.onboarding.prompts.length, 2);
    assert.ok(log.onboarding.defaultChannels.length >= 7);
    assert.equal(log.welcome.welcomeChannels.length, 5);

    // Las menciones y enlaces del primer mensaje se resolvieron.
    const welcome = [...channels.values()].find((c) => c.name === "👋｜bienvenida").sent[0];
    assert.ok(!/\{[#@:]/.test(JSON.stringify(welcome.embeds)), "sin placeholders sin resolver");
    assert.match(JSON.stringify(welcome.embeds), /<:mazo:\d+>/, "el emoji personalizado se resuelve a su id");

    // Segunda ejecucion: nada nuevo.
    const rolesBefore = log.rolesCreated;
    const channelsBefore = log.channelsCreated.length;
    const sentBefore = log.messagesSent;
    const second = await run({ client, guild });
    assert.deepEqual(second, []);
    assert.equal(log.rolesCreated, rolesBefore, "no duplica roles");
    assert.equal(log.channelsCreated.length, channelsBefore, "no duplica canales");
    assert.equal(log.messagesSent, sentBefore, "no duplica mensajes");
    assert.equal(log.messagesEdited, MESSAGES.length, "edita los mensajes existentes");
    assert.equal(log.threads, FORUM_POSTS.length, "no duplica publicaciones de foro");
  } finally {
    console.log = quiet;
  }
});

test("si el servidor no admite Comunidad, los foros se crean como canales de texto y no se rompe", async () => {
  const quiet = console.log;
  console.log = () => {};
  try {
    const { client, guild, channels } = makeServer();
    // Simula un servidor donde guild.edit no activa Comunidad.
    guild.edit = async () => guild;
    const failures = await run({ client, guild, only: ["roles", "channels", "settings", "content"] });
    assert.ok(failures.every((f) => !f.startsWith("Canales")), `fallos inesperados: ${failures}`);
    const bugs = [...channels.values()].find((c) => c.name === "🐛｜reporte-de-bugs");
    assert.equal(bugs.type, ChannelType.GuildText);
    assert.ok(bugs.sent.length >= 1, "el aviso de como reportar se publica como mensaje");
  } finally {
    console.log = quiet;
  }
});
