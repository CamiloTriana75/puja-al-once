import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, COPY, HEAD } from "./brand";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Muelle de entrada estandar: 0 -> 1 a partir de `at` (frame local). */
export function useIn(at: number, damping = 13, stiffness = 140): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, stiffness, mass: 0.9 } });
}

/** Cesped segado: degradado + franjas que se deslizan despacio + vineta. */
export const Field: React.FC<{ tone?: "pitch" | "forest" | "gold" | "canvas"; children?: ReactNode }> = ({ tone = "pitch", children }) => {
  const frame = useCurrentFrame();
  const drift = (frame * 1.6) % 240;
  const bg: Record<string, string> = {
    pitch: `linear-gradient(170deg, ${C.pine} 0%, ${C.pitch} 62%, #1C9A57 100%)`,
    forest: `radial-gradient(ellipse at 50% 38%, #17402F 0%, ${C.forest} 70%)`,
    gold: `linear-gradient(165deg, ${C.goldSoft} 0%, ${C.gold} 100%)`,
    canvas: `linear-gradient(180deg, ${C.canvas} 0%, #ECEBDF 100%)`,
  };
  const stripe = tone === "gold" ? "rgba(122,75,0,0.07)" : tone === "canvas" ? "rgba(21,131,74,0.05)" : "rgba(0,0,0,0.09)";
  return (
    <AbsoluteFill style={{ background: bg[tone], overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -240 + drift,
          height: 1920 + 480,
          backgroundImage: `repeating-linear-gradient(180deg, ${stripe} 0 120px, transparent 120px 240px)`,
        }}
      />
      {tone !== "canvas" && tone !== "gold" && (
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 42%, transparent 48%, rgba(0,0,0,0.42) 100%)" }} />
      )}
      {children}
    </AbsoluteFill>
  );
};

/** Titular grande de la marca (Unbounded). */
export const Headline: React.FC<{ children: ReactNode; size?: number; color?: string; style?: CSSProperties }> = ({
  children,
  size = 104,
  color = C.white,
  style,
}) => (
  <div
    style={{
      fontFamily: HEAD,
      fontWeight: 800,
      fontSize: size,
      lineHeight: 1.02,
      letterSpacing: "-0.045em",
      color,
      textAlign: "center",
      textShadow: color === C.white ? "0 10px 30px rgba(0,0,0,0.28)" : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Copy: React.FC<{ children: ReactNode; size?: number; color?: string; weight?: number; style?: CSSProperties }> = ({
  children,
  size = 40,
  color = C.white,
  weight = 600,
  style,
}) => <div style={{ fontFamily: COPY, fontSize: size, fontWeight: weight, color, lineHeight: 1.25, textAlign: "center", ...style }}>{children}</div>;

/** La carta de la subasta, como en el juego: borde dorado, silueta blanca, precio de salida. */
export const AuctionCard: React.FC<{
  width?: number;
  photo?: number; // 0 = silueta, 1 = foto revelada
  stamp?: number; // 0..1 entrada del sello "SALE A 90 M"
  glow?: number;
  footer?: string;
}> = ({ width = 700, photo = 0, stamp = 0, glow = 0, footer = "¿QUIÉN ES?" }) => {
  const height = width * 1.34;
  const r = width * 0.08;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: r,
        padding: width * 0.017,
        background: `linear-gradient(160deg, ${C.goldSoft}, ${C.gold})`,
        boxShadow: `0 ${width * 0.06}px ${width * 0.12}px -${width * 0.04}px rgba(0,0,0,0.55), 0 0 ${glow * 120}px ${glow * 30}px rgba(240,184,61,${0.55 * glow})`,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: width * 0.017,
          borderRadius: r * 0.82,
          overflow: "hidden",
          background: `linear-gradient(165deg, ${C.forest2} 0%, ${C.forest} 100%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 40px, transparent 40px 80px)",
          }}
        />
        <Img
          src={staticFile("img/hero-silhouette.png")}
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            height: "90%",
            transform: "translateX(-50%)",
            filter: "brightness(0) invert(1)",
            opacity: 1 - photo,
          }}
        />
        <Img
          src={staticFile("img/hero-photo.png")}
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            height: "90%",
            transform: `translateX(-50%) scale(${1.06 - 0.06 * photo})`,
            transformOrigin: "50% 100%",
            opacity: photo,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "26%",
            background: `linear-gradient(180deg, transparent, ${C.forest} 78%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: width * 0.06,
            fontFamily: HEAD,
            fontWeight: 800,
            fontSize: width * 0.072,
            letterSpacing: "-0.03em",
            color: C.gold,
            textAlign: "center",
          }}
        >
          {footer}
        </div>
      </div>
      {stamp > 0 && (
        <div
          style={{
            position: "absolute",
            top: width * 0.06,
            left: width * 0.06,
            padding: `${width * 0.022}px ${width * 0.045}px`,
            borderRadius: 999,
            background: C.gold,
            color: C.forest,
            fontFamily: HEAD,
            fontWeight: 800,
            fontSize: width * 0.05,
            letterSpacing: "-0.02em",
            boxShadow: "0 10px 24px -8px rgba(0,0,0,0.5)",
            transform: `scale(${interpolate(stamp, [0, 1], [2.2, 1])}) rotate(${interpolate(stamp, [0, 1], [-14, -4])}deg)`,
            opacity: Math.min(1, stamp * 2),
          }}
        >
          SALE A 90 M
        </div>
      )}
    </div>
  );
};

/** Balon de la marca (misma geometria que BallMark). */
export const Ball: React.FC<{ size: number; fill?: string; ink?: string; style?: CSSProperties }> = ({ size, fill = C.white, ink = C.forest, style }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} style={style}>
    <circle cx="16" cy="16" r="14.5" fill={fill} stroke={ink} strokeWidth="1.2" />
    <path d="M16 10.2 21.52 14.21 19.41 20.69H12.59L10.48 14.21Z" fill={ink} />
    <path
      d="M16 10.2V3.4M21.52 14.21l6.6-2.14M19.41 20.69l4.08 5.62M12.59 20.69l-4.08 5.62M10.48 14.21l-6.6-2.14"
      stroke={ink}
      strokeWidth="1.7"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

/** Confeti con fisica simple (deterministico por semilla), desde `at` (frame local). */
export const Confetti: React.FC<{ at: number; x: number; y: number; count?: number; seed?: string }> = ({ at, x, y, count = 80, seed = "c" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame - at) / fps;
  if (t < 0 || t > 2.6) return null;
  const colors = [C.gold, C.white, C.goldSoft, C.pitchSoft, "#1C9A57"];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (-90 + (random(`${seed}a${i}`) - 0.5) * 150) * (Math.PI / 180);
        const speed = 900 + random(`${seed}s${i}`) * 1500;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const drag = Math.exp(-t * 1.4);
        const px = x + (vx * (1 - drag)) / 1.4;
        const py = y + (vy * (1 - drag)) / 1.4 + 0.5 * 1600 * t * t;
        const w = 14 + random(`${seed}w${i}`) * 18;
        const spin = (random(`${seed}r${i}`) - 0.5) * 1400 * t;
        const opacity = interpolate(t, [0, 1.6, 2.6], [1, 1, 0], clamp);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: w,
              height: w * 0.45,
              borderRadius: 3,
              background: colors[i % colors.length],
              transform: `rotate(${spin}deg) scaleY(${Math.cos((spin * Math.PI) / 90)})`,
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Temblor de camara alrededor de `at`. */
export function useShake(at: number, strength = 26, length = 18): string {
  const frame = useCurrentFrame();
  const d = frame - at;
  if (d < 0 || d > length) return "translate(0px, 0px)";
  const a = strength * Math.exp(-d / (length / 4));
  return `translate(${Math.sin(d * 2.7) * a}px, ${Math.cos(d * 2.1) * a}px)`;
}

/** Mazo dibujado: mango dorado, cabeza bosque con aros dorados. Gira sobre el final del mango. */
export const GavelArt: React.FC<{ angle: number; size?: number }> = ({ angle, size = 640 }) => (
  <svg
    viewBox="0 0 640 640"
    width={size}
    height={size}
    style={{ transform: `rotate(${angle}deg)`, transformOrigin: "88% 50%", overflow: "visible" }}
  >
    <rect x="250" y="296" width="320" height="48" rx="24" fill="#C8892C" />
    <rect x="250" y="296" width="320" height="16" rx="8" fill="#E0A848" />
    <rect x="540" y="288" width="48" height="64" rx="18" fill={C.forest} />
    <rect x="96" y="176" width="176" height="288" rx="46" fill={C.forest} />
    <rect x="96" y="176" width="176" height="288" rx="46" fill="url(#shine)" />
    <rect x="96" y="214" width="176" height="30" fill={C.gold} />
    <rect x="96" y="396" width="176" height="30" fill={C.gold} />
    <defs>
      <linearGradient id="shine" x1="0" x2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.25" />
      </linearGradient>
    </defs>
  </svg>
);

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
