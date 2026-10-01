import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/** Paleta de packages/client/src/index.css: la misma identidad que el juego. */
export const C = {
  canvas: "#F5F4EC",
  forest: "#0C241C",
  forest2: "#123428",
  pitch: "#15834A",
  pitchSoft: "#E4F0DF",
  pine: "#0E5138",
  gold: "#F0B83D",
  goldSoft: "#F5C65C",
  slate: "#536158",
  alert: "#E5483B",
  white: "#FFFFFF",
};

export const HEAD = "Unbounded, 'Arial Black', sans-serif";
export const COPY = "Jost, 'Segoe UI', sans-serif";

loadFont({ family: "Unbounded", url: staticFile("fonts/Unbounded.ttf"), weight: "200 900" });
loadFont({ family: "Jost", url: staticFile("fonts/Jost.ttf"), weight: "100 900" });
