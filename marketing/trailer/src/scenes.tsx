import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, COPY, HEAD } from "./brand";
import { AuctionCard, Ball, clamp, Confetti, Copy, ease, Field, GavelArt, Headline, useIn, useShake } from "./parts";

/* ------------------------------------------------------------------ 1. Gancho (0-120) */
export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const l1 = useIn(8);
  const l2 = useIn(38, 10, 170);
  const l3 = useIn(70, 11, 190);
  const rise = interpolate(f, [4, 100], [560, 0], { easing: ease, ...clamp });
  const silOpacity = interpolate(f, [6, 36], [0, 1], clamp);
  const q = useIn(72, 8, 160);
  const exit = interpolate(f, [110, 120], [0, 1], clamp);

  const line = (s: number, from: number) => ({
    opacity: Math.min(1, s * 1.4),
    transform: `translateY(${(1 - s) * from}px) scale(${0.7 + 0.3 * s})`,
  });

  return (
    <Field tone="pitch">
      <AbsoluteFill style={{ transform: `scale(${1 + exit * 0.18})`, opacity: 1 - exit }}>
        <Img
          src={staticFile("img/hero-silhouette.png")}
          style={{
            position: "absolute",
            left: "50%",
            bottom: -40,
            height: 1060,
            transform: `translate(-50%, ${rise}px)`,
            opacity: silOpacity,
            filter: "brightness(0) drop-shadow(0 0 3px #F0B83D) drop-shadow(0 0 46px rgba(240,184,61,0.55))",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1240,
            textAlign: "center",
            fontFamily: HEAD,
            fontWeight: 900,
            fontSize: 300,
            color: C.gold,
            opacity: q,
            transform: `scale(${(0.4 + 0.6 * q) * (1 + 0.04 * Math.sin(f / 4))}) rotate(${(1 - q) * -30}deg)`,
            textShadow: "0 0 60px rgba(240,184,61,0.6)",
          }}
        >
          ?
        </div>
        <div style={{ position: "absolute", top: 250, left: 60, right: 60 }}>
          <div style={line(l1, 80)}>
            <Headline size={112}>UN CRACK</Headline>
          </div>
          <div style={{ ...line(l2, 80), marginTop: 18 }}>
            <Headline size={150} color={C.gold}>
              OCULTO.
            </Headline>
          </div>
          <div style={{ ...line(l3, 120), marginTop: 46 }}>
            <Headline size={92}>
              ¿CUÁNTO
              <br />
              PAGARÍAS?
            </Headline>
          </div>
        </div>
      </AbsoluteFill>
    </Field>
  );
};

/* ------------------------------------------------------------------ 2. Carta y pujas (120-390) */
const CLUES: [string, string][] = [
  ["Altura", "182 cm"],
  ["Pie", "Diestro"],
  ["Origen", "Sudamérica"],
  ["Década", "2000s"],
];

const BIDS = [
  { at: 15, who: "Ana", amount: 90, color: "#2E7D5B" },
  { at: 45, who: "Beto", amount: 100, color: "#536158" },
  { at: 75, who: "Tú", amount: 110, color: C.gold },
];

export const Auction: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = useIn(0, 14, 120);
  const stamp = useIn(95, 9, 210);
  const toBids = spring({ frame: f - 118, fps, config: { damping: 18, stiffness: 120 } });
  const cardScale = interpolate(toBids, [0, 1], [1, 0.55]);
  const titleA = interpolate(f, [2, 12, 116, 126], [0, 1, 1, 0], clamp);
  const titleB = useIn(124);

  // fase de pujas: frame local relativo a 120
  const b = f - 120;
  const last = [...BIDS].reverse().find((bid) => b >= bid.at);
  const prevAmount = BIDS[BIDS.indexOf(last ?? BIDS[0]) - 1]?.amount ?? 90;
  const shown = last
    ? Math.round(interpolate(b, [last.at, last.at + 6], [prevAmount, last.amount], clamp))
    : 90;
  const bump = last ? Math.exp(-Math.max(0, b - last.at) / 5) : 0;
  const priceIn = useIn(124);

  const remaining = Math.max(0, 150 - b);
  const secs = Math.ceil(remaining / 30);
  const urgent = secs <= 2;
  const ringProgress = remaining / 150;
  const secPulse = Math.exp(-((150 - remaining) % 30) / 6);

  return (
    <Field tone="pitch">
      <div style={{ position: "absolute", top: 250, left: 0, right: 0, opacity: titleA }}>
        <Headline size={96}>PUJAS A CIEGAS</Headline>
      </div>
      <div
        style={{
          position: "absolute",
          top: 220,
          left: 0,
          right: 0,
          opacity: titleB,
          transform: `translateY(${(1 - titleB) * -40}px)`,
        }}
      >
        <Headline size={74}>
          PUJA CONTRA
          <br />
          <span style={{ color: C.gold }}>TUS AMIGOS</span>
        </Headline>
      </div>

      <div
        style={{
          position: "absolute",
          top: 400,
          left: "50%",
          transform: `translate(-50%, ${(1 - enter) * 1100}px) rotate(${(1 - enter) * 14}deg) scale(${cardScale})`,
          transformOrigin: "50% 0%",
          marginTop: toBids * -10,
        }}
      >
        <AuctionCard width={640} stamp={stamp} />
      </div>

      {/* pistas */}
      <div
        style={{
          position: "absolute",
          top: 1300,
          left: 80,
          right: 80,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          opacity: interpolate(f, [116, 126], [1, 0], clamp),
          transform: `translateY(${interpolate(f, [116, 126], [0, 60], clamp)}px)`,
        }}
      >
        {CLUES.map(([k, v], i) => {
          const s = spring({ frame: f - (30 + i * 15), fps, config: { damping: 10, stiffness: 220 } });
          return (
            <div
              key={k}
              style={{
                background: "rgba(255,255,255,0.94)",
                borderRadius: 28,
                padding: "18px 26px",
                transform: `scale(${s})`,
                boxShadow: "0 14px 30px -14px rgba(0,0,0,0.55)",
              }}
            >
              <div style={{ fontFamily: COPY, fontSize: 30, fontWeight: 600, color: C.slate }}>{k}</div>
              <div style={{ fontFamily: HEAD, fontSize: 42, fontWeight: 800, color: C.forest, letterSpacing: "-0.03em" }}>{v}</div>
            </div>
          );
        })}
      </div>

      {/* reloj + puja actual */}
      {f >= 120 && (
        <div
          style={{
            position: "absolute",
            top: 880,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 40,
            opacity: priceIn,
            transform: `translateY(${(1 - priceIn) * 60}px)`,
          }}
        >
          <div style={{ position: "relative", width: 168, height: 168, transform: `scale(${1 + (urgent ? 0.1 : 0.04) * secPulse})` }}>
            <svg viewBox="0 0 168 168" width={168} height={168}>
              <circle cx="84" cy="84" r="72" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.18)" strokeWidth="12" />
              <circle
                cx="84"
                cy="84"
                r="72"
                fill="none"
                stroke={urgent ? C.alert : C.gold}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 72}
                strokeDashoffset={2 * Math.PI * 72 * (1 - ringProgress)}
                transform="rotate(-90 84 84)"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                fontFamily: HEAD,
                fontWeight: 800,
                fontSize: 46,
                color: urgent ? "#FFD7D2" : C.white,
              }}
            >
              0:0{secs}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: COPY, fontWeight: 700, fontSize: 32, letterSpacing: "0.16em", color: C.gold }}>PUJA ACTUAL</div>
            <div
              style={{
                fontFamily: HEAD,
                fontWeight: 900,
                fontSize: 150,
                lineHeight: 1,
                letterSpacing: "-0.05em",
                color: C.white,
                transform: `scale(${1 + 0.16 * bump})`,
                transformOrigin: "0% 60%",
                textShadow: "0 12px 30px rgba(0,0,0,0.35)",
              }}
            >
              {shown} M
            </div>
          </div>
        </div>
      )}

      {/* pujas de la sala */}
      <div style={{ position: "absolute", top: 1110, left: 150, right: 150 }}>
        {BIDS.map((bid, i) => {
          const s = spring({ frame: b - bid.at, fps, config: { damping: 13, stiffness: 170 } });
          if (b < bid.at) return null;
          const mine = bid.who === "Tú";
          const leading = last === bid;
          return (
            <div
              key={bid.who}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                marginBottom: 18,
                padding: "16px 28px 16px 16px",
                borderRadius: 999,
                background: mine ? C.gold : "rgba(255,255,255,0.14)",
                border: leading ? `4px solid ${mine ? C.white : C.gold}` : "4px solid transparent",
                transform: `translateX(${(1 - s) * (i % 2 ? -900 : 900)}px)`,
                opacity: leading ? 1 : 0.75,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  background: mine ? C.forest : bid.color,
                  color: mine ? C.gold : C.white,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: HEAD,
                  fontWeight: 800,
                  fontSize: 34,
                }}
              >
                {bid.who[0]}
              </div>
              <div style={{ flex: 1, fontFamily: COPY, fontWeight: 700, fontSize: 42, color: mine ? C.forest : C.white }}>
                {bid.who} <span style={{ fontWeight: 500, opacity: 0.75 }}>puja</span>
              </div>
              <div style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 52, color: mine ? C.forest : C.white, letterSpacing: "-0.04em" }}>
                {bid.amount} M
              </div>
            </div>
          );
        })}
      </div>
    </Field>
  );
};

/* ------------------------------------------------------------------ 3. Mazo (390-480), golpe en 30 */
export const Gavel: React.FC = () => {
  const f = useCurrentFrame();
  const IMPACT = 30;
  const angle =
    f < 18
      ? interpolate(f, [0, 18], [12, 50], { easing: ease, ...clamp })
      : f < IMPACT
        ? interpolate(f, [18, IMPACT], [50, 0], { easing: (t) => t * t * t, ...clamp })
        : interpolate(f, [IMPACT, IMPACT + 4, IMPACT + 11], [0, 8, 0], clamp);
  const shake = useShake(IMPACT, 30, 20);
  const flash = interpolate(f, [IMPACT - 1, IMPACT, IMPACT + 8], [0, 0.8, 0], clamp);
  const sold = useIn(IMPACT, 9, 230);
  const sub = useIn(IMPACT + 12);
  const call1 = interpolate(f, [2, 8, IMPACT - 2, IMPACT], [0, 1, 1, 0], clamp);
  const call2 = interpolate(f, [16, 22, IMPACT - 2, IMPACT], [0, 1, 1, 0], clamp);

  const BLOCK_TOP = 1220;
  const SIZE = 780;
  const K = SIZE / 640; // escala del dibujo del mazo
  const HEAD_X = 184 * K;

  return (
    <Field tone="forest">
      <AbsoluteFill style={{ transform: shake }}>
        {/* ondas del golpe */}
        {[0, 6].map((delay) => {
          const t = interpolate(f, [IMPACT + delay, IMPACT + delay + 26], [0, 1], clamp);
          if (f < IMPACT + delay) return null;
          return (
            <div
              key={delay}
              style={{
                position: "absolute",
                left: 540 - 160,
                top: BLOCK_TOP - 160,
                width: 320,
                height: 320,
                borderRadius: 999,
                border: `${14 * (1 - t) + 2}px solid ${C.gold}`,
                transform: `scale(${0.3 + t * 3.4}) scaleY(0.45)`,
                opacity: 1 - t,
              }}
            />
          );
        })}

        {/* taco */}
        <div style={{ position: "absolute", left: 540 - 270, top: BLOCK_TOP, width: 540, height: 170 }}>
          <div style={{ position: "absolute", inset: "40px 0 0 0", borderRadius: 40, background: "#0A1C16", boxShadow: "0 30px 50px -20px rgba(0,0,0,0.7)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 92, borderRadius: "50%", background: `linear-gradient(180deg, #E0A848, ${C.gold})` }} />
        </div>

        {/* mazo */}
        <div style={{ position: "absolute", left: 540 - HEAD_X, top: BLOCK_TOP + 44 - 464 * K }}>
          <GavelArt angle={angle} size={SIZE} />
        </div>

        {/* "a la una, a las dos" */}
        <div style={{ position: "absolute", top: 330, left: 0, right: 0 }}>
          <div style={{ opacity: call1, transform: `translateY(${(1 - call1) * 30}px)` }}>
            <Headline size={84}>¡A LA UNA…</Headline>
          </div>
          <div style={{ opacity: call2, transform: `translateY(${(1 - call2) * 30}px)`, marginTop: 20 }}>
            <Headline size={84} color={C.gold}>
              A LAS DOS…!
            </Headline>
          </div>
        </div>

        {/* VENDIDO */}
        {f >= IMPACT && (
          <div style={{ position: "absolute", top: 300, left: 0, right: 0 }}>
            <div style={{ transform: `scale(${interpolate(sold, [0, 1], [2.8, 1])}) rotate(-7deg)`, opacity: Math.min(1, sold * 3) }}>
              <Headline
                size={132}
                color={C.gold}
                style={{ WebkitTextStroke: `10px ${C.forest}`, paintOrder: "stroke fill", textShadow: "0 18px 40px rgba(0,0,0,0.5)" }}
              >
                ¡VENDIDO!
              </Headline>
            </div>
            <div style={{ marginTop: 50, opacity: sub, transform: `translateY(${(1 - sub) * 30}px)` }}>
              <Copy size={54}>
                Te lo llevas por <span style={{ color: C.gold, fontFamily: HEAD, fontWeight: 800 }}>110 M</span>
              </Copy>
            </div>
          </div>
        )}
      </AbsoluteFill>
      <Confetti at={IMPACT} x={540} y={BLOCK_TOP} count={90} seed="gavel" />
      <AbsoluteFill style={{ background: C.white, opacity: flash }} />
    </Field>
  );
};

/* ------------------------------------------------------------------ 4. Revelacion (480-570) */
export const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const enter = useIn(0, 14, 160);
  const photo = interpolate(f, [12, 22], [0, 1], clamp);
  const glow = interpolate(f, [12, 24, 80], [0, 1, 0.45], clamp);
  const flash = interpolate(f, [11, 12, 20], [0, 0.75, 0], clamp);
  const name = useIn(24, 12, 170);
  const meta = useIn(34);
  const title = interpolate(f, [0, 8, 16, 24], [0, 1, 1, 0], clamp);
  const titleB = useIn(18);

  return (
    <Field tone="pitch">
      <div
        style={{
          position: "absolute",
          left: 540 - 900,
          top: 760 - 900,
          width: 1800,
          height: 1800,
          background: `repeating-conic-gradient(from ${f * 0.7}deg, rgba(255,255,255,0.11) 0deg 9deg, transparent 9deg 18deg)`,
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 62%)",
          opacity: glow,
        }}
      />
      <div style={{ position: "absolute", top: 222, left: 0, right: 0, opacity: title }}>
        <Headline size={80}>¿QUIÉN ERA?</Headline>
      </div>
      <div style={{ position: "absolute", top: 222, left: 0, right: 0, opacity: titleB, transform: `scale(${0.8 + 0.2 * titleB})` }}>
        <Headline size={80} color={C.gold}>
          ¡ERA ÉL!
        </Headline>
      </div>
      <div style={{ position: "absolute", top: 360, left: "50%", transform: `translateX(-50%) scale(${0.85 + 0.15 * enter + 0.04 * glow})` }}>
        <AuctionCard width={600} photo={photo} glow={glow} footer={photo > 0.5 ? "★ 2006 ★" : "¿QUIÉN ES?"} />
      </div>
      <div style={{ position: "absolute", top: 1210, left: 0, right: 0 }}>
        <div style={{ opacity: name, transform: `translateY(${(1 - name) * 60}px)` }}>
          <Headline size={104}>RONALDINHO</Headline>
        </div>
        <div style={{ marginTop: 22, opacity: meta, transform: `translateY(${(1 - meta) * 30}px)` }}>
          <Copy size={44}>
            Fichado por <b style={{ color: C.gold }}>Tú</b> · 110 M
          </Copy>
        </div>
      </div>
      <AbsoluteFill style={{ background: C.white, opacity: flash }} />
    </Field>
  );
};

/* ------------------------------------------------------------------ 5. Arma tu once (570-690) */
const SLOTS = [
  { abbr: "POR", name: "Buffon", x: 50, y: 91 },
  { abbr: "LI", name: "R. Carlos", x: 14, y: 72 },
  { abbr: "DFC", name: "Puyol", x: 37, y: 77 },
  { abbr: "DFC", name: "Cannavaro", x: 63, y: 77 },
  { abbr: "LD", name: "Cafu", x: 86, y: 72 },
  { abbr: "MCD", name: "Makélélé", x: 50, y: 58 },
  { abbr: "MC", name: "Xavi", x: 25, y: 44 },
  { abbr: "MP", name: "Ronaldinho", x: 75, y: 44 },
  { abbr: "EI", name: "Henry", x: 16, y: 21 },
  { abbr: "DC", name: "Ronaldo", x: 50, y: 14 },
  { abbr: "ED", name: "Messi", x: 84, y: 21 },
];
export const PASS_ARRIVALS = SLOTS.map((_, i) => 15 + 7.5 * i);
export const SHOT_AT = 96;
const SHOT_IN = 104;

export const Pitch: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = useIn(0);
  const board = useIn(2, 16, 130);
  const badge = useIn(SHOT_IN, 9, 220);
  const W = 860;
  const H = 1080;
  const X0 = 110;
  const Y0 = 400;
  const pos = (p: { x: number; y: number }) => ({ x: (p.x / 100) * W, y: (p.y / 100) * H });

  // balon
  const start = { x: 50, y: 108 };
  let ball = pos(start);
  let lift = 0;
  const legs = [start, ...SLOTS];
  for (let i = 0; i < SLOTS.length; i++) {
    const a0 = PASS_ARRIVALS[i] - 7.5;
    if (f >= a0) {
      const t = interpolate(f, [a0, PASS_ARRIVALS[i]], [0, 1], { easing: (x) => 1 - (1 - x) ** 3, ...clamp });
      const p0 = pos(legs[i]);
      const p1 = pos(legs[i + 1]);
      ball = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
      lift = Math.sin(Math.PI * t);
    }
  }
  if (f >= SHOT_AT) {
    const t = interpolate(f, [SHOT_AT, SHOT_IN], [0, 1], { easing: (x) => x * x, ...clamp });
    const p0 = pos(SLOTS[10]);
    const p1 = pos({ x: 52, y: -1 });
    ball = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
    lift = Math.sin(Math.PI * t) * 1.4;
  }
  const net = interpolate(f, [SHOT_IN - 1, SHOT_IN, SHOT_IN + 16], [0, 1, 0], clamp);

  return (
    <Field tone="pitch">
      <div style={{ position: "absolute", top: 236, left: 0, right: 0, opacity: title, transform: `translateY(${(1 - title) * -40}px)` }}>
        <Headline size={100}>
          ARMA TU <span style={{ color: C.gold }}>ONCE</span>
        </Headline>
      </div>
      <div
        style={{
          position: "absolute",
          left: X0,
          top: Y0,
          width: W,
          height: H,
          transform: `scale(${0.9 + 0.1 * board})`,
          opacity: board,
        }}
      >
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="5">
          <rect x="4" y="4" width={W - 8} height={H - 8} rx="26" fill="rgba(255,255,255,0.05)" />
          <line x1="4" y1={H / 2} x2={W - 4} y2={H / 2} />
          <circle cx={W / 2} cy={H / 2} r="110" />
          <circle cx={W / 2} cy={H / 2} r="7" fill="rgba(255,255,255,0.55)" />
          <rect x={W / 2 - 230} y="4" width="460" height="170" />
          <rect x={W / 2 - 110} y="4" width="220" height="66" />
          <rect x={W / 2 - 230} y={H - 174} width="460" height="170" />
          <rect x={W / 2 - 110} y={H - 70} width="220" height="66" />
          <rect x={W / 2 - 80} y="-14" width="160" height="18" fill={`rgba(240,184,61,${0.4 + net * 0.6})`} stroke="none" />
        </svg>

        {SLOTS.map((slot, i) => {
          const p = pos(slot);
          const s = spring({ frame: f - PASS_ARRIVALS[i], fps, config: { damping: 9, stiffness: 240 } });
          const filled = f >= PASS_ARRIVALS[i];
          return (
            <div key={i} style={{ position: "absolute", left: p.x - 64, top: p.y - 64, width: 128, textAlign: "center" }}>
              <div
                style={{
                  width: 128,
                  height: 128,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  background: filled ? C.gold : "rgba(0,0,0,0.18)",
                  border: filled ? `6px solid ${C.white}` : "4px dashed rgba(255,255,255,0.6)",
                  transform: `scale(${filled ? 0.75 + 0.25 * s + 0.12 * Math.exp(-(f - PASS_ARRIVALS[i]) / 4) : 0.9})`,
                  boxShadow: filled ? "0 14px 30px -10px rgba(0,0,0,0.55)" : undefined,
                  fontFamily: HEAD,
                  fontWeight: 800,
                  fontSize: 34,
                  color: filled ? C.forest : "rgba(255,255,255,0.85)",
                }}
              >
                {slot.abbr}
              </div>
              {filled && (
                <div
                  style={{
                    position: "absolute",
                    top: 120,
                    left: "50%",
                    transform: `translateX(-50%) scale(${s})`,
                    whiteSpace: "nowrap",
                    padding: "4px 14px",
                    borderRadius: 999,
                    background: C.forest,
                    color: C.white,
                    fontFamily: COPY,
                    fontWeight: 700,
                    fontSize: 28,
                  }}
                >
                  {slot.name}
                </div>
              )}
            </div>
          );
        })}

        {f >= 7 && f < SHOT_IN + 2 && (
          <Ball
            size={54}
            style={{
              position: "absolute",
              left: ball.x - 27,
              top: ball.y - 27,
              transform: `scale(${1 + 0.45 * lift}) rotate(${f * 24}deg)`,
              filter: `drop-shadow(0 ${8 + 22 * lift}px ${6 + 10 * lift}px rgba(0,0,0,0.45))`,
            }}
          />
        )}

        {f >= SHOT_IN && (
          <div
            style={{
              position: "absolute",
              right: -18,
              top: -30,
              padding: "12px 26px",
              borderRadius: 999,
              background: C.gold,
              color: C.forest,
              fontFamily: HEAD,
              fontWeight: 900,
              fontSize: 46,
              transform: `scale(${badge}) rotate(6deg)`,
              boxShadow: "0 16px 30px -12px rgba(0,0,0,0.6)",
            }}
          >
            11/11
          </div>
        )}
      </div>
    </Field>
  );
};

/* ------------------------------------------------------------------ 6. Claves (690-780) */
const FEATURES = [
  { big: "2–4 AMIGOS", sub: "Una sala y un código de 5 letras" },
  { big: "SIN CUENTAS", sub: "Pones tu nombre y a pujar" },
  { big: "GRATIS", sub: "En el navegador o como app" },
];

export const Features: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Field tone="gold">
      <div style={{ position: "absolute", top: 380, left: 60, right: 60 }}>
        {FEATURES.map((item, i) => {
          const s = spring({ frame: f - i * 30, fps, config: { damping: 14, stiffness: 160 } });
          const dir = i % 2 ? 1 : -1;
          return (
            <div
              key={item.big}
              style={{
                marginBottom: 130,
                opacity: Math.min(1, s * 1.5),
                transform: `translateX(${(1 - s) * dir * 1100}px) skewX(${(1 - s) * dir * -14}deg)`,
              }}
            >
              <Headline size={i === 2 ? 150 : 108} color={C.forest}>
                {item.big}
              </Headline>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 14 }}>
                <Ball size={40} fill={C.forest} ink={C.gold} style={{ transform: `rotate(${f * 6}deg)` }} />
                <Copy size={42} color="#3D2C05" weight={600}>
                  {item.sub}
                </Copy>
              </div>
            </div>
          );
        })}
      </div>
    </Field>
  );
};

/* ------------------------------------------------------------------ 7. Cierre (780-870) */
export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const logo = useIn(0, 8, 200);
  const word = useIn(10, 14, 150);
  const tag = useIn(20);
  const cta = useIn(30, 10, 190);
  const link = useIn(40);
  const pulse = f > 45 ? 1 + 0.035 * Math.sin((f - 45) / 4) : 1;

  return (
    <Field tone="canvas">
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 230 }}>
        <Field tone="pitch" />
      </div>
      <Img
        src={staticFile("img/logo-symbol.png")}
        style={{
          position: "absolute",
          left: 540 - 200,
          top: 300,
          width: 400,
          height: 400,
          transform: `scale(${logo}) rotate(${(1 - logo) * -200}deg)`,
          filter: "drop-shadow(0 26px 30px rgba(12,36,28,0.35))",
        }}
      />
      <Img
        src={staticFile("img/logo-wordmark.png")}
        style={{
          position: "absolute",
          left: 540 - 360,
          top: 760,
          width: 720,
          opacity: word,
          transform: `translateY(${(1 - word) * 50}px)`,
        }}
      />
      <div style={{ position: "absolute", top: 1080, left: 120, right: 120, opacity: tag, transform: `translateY(${(1 - tag) * 30}px)` }}>
        <Copy size={48} color={C.forest} weight={600}>
          Subastas de fútbol a ciegas
          <br />
          con tus amigos
        </Copy>
      </div>
      <div style={{ position: "absolute", top: 1250, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            padding: "20px 22px 20px 48px",
            borderRadius: 999,
            background: C.forest,
            color: C.white,
            fontFamily: HEAD,
            fontWeight: 800,
            fontSize: 50,
            letterSpacing: "-0.03em",
            transform: `scale(${cta * pulse})`,
            boxShadow: "0 24px 40px -18px rgba(12,36,28,0.7)",
          }}
        >
          JUEGA GRATIS
          <div style={{ width: 76, height: 76, borderRadius: 999, background: C.gold, color: C.forest, display: "grid", placeItems: "center", fontSize: 44 }}>→</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1410, left: 0, right: 0, opacity: link }}>
        <Copy size={38} color={C.slate} weight={600}>
          Link en la bio
        </Copy>
        <Copy size={32} color={C.slate} weight={500} style={{ marginTop: 6 }}>
          puja-al-once-3u8j.onrender.com
        </Copy>
      </div>
      <Confetti at={2} x={540} y={520} count={60} seed="end" />
    </Field>
  );
};
