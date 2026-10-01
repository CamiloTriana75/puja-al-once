import assert from "node:assert/strict";
import { test } from "node:test";
import { PermissionFlagsBits as P } from "discord.js";
import { CATEGORIES, ROLES } from "../config/server.mjs";
import { buildOverwrites, categoryOverwrites, mergeTags, parseTag } from "../src/helpers.mjs";
import { embedLength, normalizeChannelName, render, validate } from "../src/plan.mjs";
import { MESSAGES } from "../config/content.mjs";

test("la configuracion cumple los limites de Discord", () => {
  assert.deepEqual(validate(), []);
});

test("render resuelve canales, roles y la URL del juego", () => {
  const ctx = {
    gameUrl: "https://juego.example",
    guildId: "1",
    channelId: (k) => (k === "reglas" ? "22" : undefined),
    roleId: (k) => (k === "moderador" ? "33" : undefined),
  };
  assert.equal(render("Lee {#reglas} y avisa a {@moderador}: {game}", ctx), "Lee <#22> y avisa a <@&33>: https://juego.example");
  assert.equal(render("{channel:reglas}", ctx), "https://discord.com/channels/1/22");
  assert.equal(render("{#desconocido}", ctx), "#desconocido");
});

test("parseTag separa el emoji del nombre", () => {
  assert.deepEqual(parseTag("💡 Idea"), { name: "Idea", emoji: { id: null, name: "💡" } });
  assert.deepEqual(parseTag("⚙️ Reglas del juego"), { name: "Reglas del juego", emoji: { id: null, name: "⚙️" } });
  assert.deepEqual(parseTag("Sin emoji"), { name: "Sin emoji" });
});

test("mergeTags conserva las etiquetas existentes (con su id) y solo anade las que faltan", () => {
  const existing = [{ id: "9", name: "Idea", emoji: { id: null, name: "💡" } }];
  const merged = mergeTags(existing, ["💡 Idea", "🎨 Diseño"]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "9");
  assert.equal(merged[1].name, "Diseño");
});

test("normalizeChannelName imita a Discord: minusculas y guiones en texto, intacto en voz", () => {
  assert.equal(normalizeChannelName("💬｜General Chat", "text"), "💬｜general-chat");
  assert.equal(normalizeChannelName("🎙️ Sala 1", "voice"), "🎙️ Sala 1");
});

const ids = { everyone: "e", fundador: "f", moderador: "m", tester: "t" };

test("canales de solo lectura: todos leen, solo el staff escribe", () => {
  const o = buildOverwrites({ readonly: true }, ids);
  assert.ok(o.find((x) => x.id === "e").deny.includes(P.SendMessages));
  assert.ok(o.find((x) => x.id === "m").allow.includes(P.SendMessages));
});

test("canales de staff y de testers quedan ocultos para @everyone", () => {
  assert.ok(buildOverwrites({ staff: true }, ids).find((x) => x.id === "e").deny.includes(P.ViewChannel));
  const t = buildOverwrites({ testers: true }, ids);
  assert.ok(t.find((x) => x.id === "e").deny.includes(P.ViewChannel));
  assert.ok(t.find((x) => x.id === "t").allow.includes(P.ViewChannel));
  assert.ok(categoryOverwrites({ staff: true }, ids).find((x) => x.id === "e").deny.includes(P.ViewChannel));
  assert.deepEqual(categoryOverwrites({}, ids), []);
});

test("el rol Fundador es el unico administrador y Moderador no puede gestionar el servidor", () => {
  const admins = ROLES.filter((r) => r.permissions.includes(P.Administrator));
  assert.deepEqual(admins.map((r) => r.key), ["fundador"]);
  const mod = ROLES.find((r) => r.key === "moderador");
  for (const dangerous of [P.Administrator, P.ManageGuild, P.ManageRoles, P.ManageChannels, P.ManageWebhooks]) {
    assert.ok(!mod.permissions.includes(dangerous));
  }
});

test("las salas de voz de partida admiten 4 personas, como el juego", () => {
  const rooms = CATEGORIES.find((c) => c.key === "voz").channels.filter((c) => c.key.startsWith("voz-"));
  assert.equal(rooms.length, 4);
  for (const room of rooms) assert.equal(room.userLimit, 4);
});

test("ningun mensaje se acerca al limite de 6000 caracteres", () => {
  for (const msg of MESSAGES) {
    const total = msg.embeds.reduce((sum, e) => sum + embedLength(e), 0);
    assert.ok(total < 5400, `${msg.embeds[0].title}: ${total}`);
  }
});

test("todos los mensajes pasan la validacion de discord.js una vez resueltas las menciones", async () => {
  const { ButtonBuilder, ButtonStyle, EmbedBuilder } = await import("discord.js");
  const { embedData } = await import("../src/helpers.mjs");
  const ctx = {
    gameUrl: "https://juego.example",
    guildId: "100000000000000001",
    channelId: () => "200000000000000002",
    roleId: () => "300000000000000003",
  };
  ctx.render = (text) => render(text, ctx);

  for (const msg of MESSAGES) {
    msg.embeds.forEach((embed, i) => {
      const data = embedData(embed, ctx, i === 0 ? msg.image : undefined);
      const built = new EmbedBuilder().setColor(data.color).setTitle(data.title);
      if (data.description) built.setDescription(data.description);
      if (data.fields.length) built.addFields(data.fields);
      if (data.footer) built.setFooter(data.footer);
      const json = built.toJSON();
      assert.ok(json.title.length <= 256);
      assert.ok(!/\{[#@]/.test(JSON.stringify(json)), `placeholder sin resolver en ${msg.embeds[0].title}`);
    });
    for (const b of msg.buttons ?? []) {
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(b.label).setURL(ctx.render(b.url)).toJSON();
    }
  }
});

test("el canal del fundador lo ve solo el fundador: ni @everyone ni los moderadores", () => {
  const o = buildOverwrites({ founder: true }, ids, true);
  assert.ok(o.find((x) => x.id === "e").deny.includes(P.ViewChannel));
  assert.ok(o.find((x) => x.id === "m").deny.includes(P.ViewChannel));
  assert.ok(!o.some((x) => x.allow?.length));
});

test("un emoji sin resolver desaparece en vez de dejar {:nombre} a la vista", () => {
  const ctx = { gameUrl: "", channelId: () => undefined, roleId: () => undefined };
  assert.equal(render("Hola {:mazo}", ctx), "Hola ");
  assert.equal(render("Hola {:mazo}", { ...ctx, emoji: () => "<:mazo:1>" }), "Hola <:mazo:1>");
});
