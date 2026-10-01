import { AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile } from "remotion";
import "./brand";
import { Auction, EndCard, Features, Gavel, Hook, PASS_ARRIVALS, Pitch, Reveal, SHOT_AT } from "./scenes";
import timeline from "./timeline.json";

export type TrailerProps = {
  /** Falso: solo efectos, para poner encima un audio de tendencia en TikTok/Reels. */
  music: boolean;
};

const S = timeline.scenes;
const at = (scene: keyof typeof S, local: number) => S[scene][0] + local;

/** Efectos de sonido: [frame global, fichero, volumen]. */
const SFX: [number, string, number][] = [
  [6, "whistle", 0.55],
  [8, "whoosh", 0.45],
  [38, "whoosh", 0.45],
  [70, "boom", 0.75],
  [118, "whoosh", 0.55],
  ...[0, 1, 2, 3].map((i): [number, string, number] => [at("auction", 30 + i * 15), "pop", 0.55]),
  [at("auction", 95), "coin", 0.7],
  [at("auction", 117), "whoosh", 0.45],
  ...[15, 45, 75].map((b): [number, string, number] => [at("auction", 120 + b), "coin", 0.6]),
  ...[180, 210, 225, 240, 250, 260].map((b): [number, string, number] => [at("auction", b), "tick", 0.75]),
  [timeline.gavelImpact, "gavel", 1],
  [timeline.gavelImpact, "crowd", 0.8],
  [at("reveal", 10), "reveal", 0.8],
  ...PASS_ARRIVALS.map((a): [number, string, number] => [at("pitch", Math.round(a)), "kick-ball", 0.7]),
  [at("pitch", SHOT_AT), "kick-ball", 1],
  [at("pitch", SHOT_AT + 8), "crowd", 0.45],
  [at("features", 0), "whoosh", 0.6],
  [at("features", 30), "whoosh", 0.6],
  [at("features", 60), "whoosh", 0.6],
  [timeline.endHit, "boom", 0.6],
  [timeline.endHit + 2, "crowd", 0.4],
  [timeline.endHit + 20, "whistle-final", 0.55],
];

const SCENES = [
  ["hook", Hook],
  ["auction", Auction],
  ["gavel", Gavel],
  ["reveal", Reveal],
  ["pitch", Pitch],
  ["features", Features],
  ["end", EndCard],
] as const;

export const Trailer: React.FC<TrailerProps> = ({ music }) => (
  <AbsoluteFill style={{ background: "#0C241C" }}>
    {SCENES.map(([key, Scene]) => (
      <Sequence key={key} from={S[key][0]} durationInFrames={S[key][1] - S[key][0]} name={key}>
        <Scene />
      </Sequence>
    ))}

    {music && (
      <Html5Audio
        src={staticFile("audio/music.wav")}
        volume={(f) => interpolate(f, [0, 8, timeline.durationInFrames - 30, timeline.durationInFrames], [0, 0.6, 0.6, 0], { extrapolateRight: "clamp" })}
      />
    )}
    {SFX.map(([frame, file, volume], i) => (
      <Sequence key={`${file}-${i}`} from={frame} name={`sfx ${file}`} layout="none">
        <Html5Audio src={staticFile(`audio/${file}.wav`)} volume={volume} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
