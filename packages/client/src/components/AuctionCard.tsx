import { useEffect, useState } from "react";
import { HTTP_URL } from "../net/endpoints.js";
import type { CardView } from "../net/types.js";

const SLOT_LABEL: Record<string, string> = {
  GK: "Portero", LB: "Lateral izquierdo", CB1: "Central", CB2: "Central",
  RB: "Lateral derecho", CDM: "Mediocentro defensivo", CM: "Mediocentro",
  CAM: "Mediapunta", LW: "Extremo izquierdo", ST: "Delantero", RW: "Extremo derecho",
};

interface Props {
  card: CardView;
  /** Puja vigente en millones. Se muestra en el estado oculto. */
  price: number;
  /**
   * Sala en curso. La silueta se pide a `/silhouettes/:roomId/:publicId.png`
   * -- el `publicId` solo tiene sentido dentro de la sala que lo emitio, asi
   * que sin el roomId el servidor no puede resolverlo (ver AuctionRoom.silhouetteIdFor).
   */
  roomId: string;
}

export function AuctionCard({ card, price, roomId }: Props) {
  const revealed = card.revealed;
  const silhouetteSrc = `${HTTP_URL}/silhouettes/${roomId}/${card.publicId}.png`;
  // Foto real que rellena la silueta en el reveal (`/photos`, hermana de
  // `/silhouettes`). El servidor SOLO la sirve para una carta ya revelada
  // (AuctionRoom.photoIdFor) -- por eso el <img> de mas abajo ni siquiera se
  // monta hasta que `revealed` es true: montarlo antes pediria la URL
  // contra una carta todavia en puja, que el servidor va a rechazar con 404
  // de todos modos. Es ruido innecesario, no un agujero (la respuesta ya
  // esta cerrada), pero no hay motivo para generarlo.
  const photoSrc = `${HTTP_URL}/photos/${roomId}/${card.publicId}.png`;

  // La foto se PRECARGA oculta (opacity 0, pero montada y descargando) y
  // solo se cruza a visible cuando termina de bajar -- si el cruce
  // empezara con la imagen a medias se veria un hueco en blanco justo en el
  // momento mas importante del juego. Si falla (jugador sin foto real, o
  // cualquier otro fallo de red) se queda con la silueta sin romper nada:
  // nunca se oculta la silueta hasta que la foto esta lista de verdad.
  const [photoReady, setPhotoReady] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  // Carta nueva (cambia publicId) o vuelve a ocultarse: arranca en limpio
  // para que la proxima revelacion no herede el "ready"/"failed" de la
  // anterior.
  useEffect(() => {
    setPhotoReady(false);
    setPhotoFailed(false);
  }, [card.publicId, revealed]);

  const showPhoto = revealed && photoReady && !photoFailed;

  return (
    <figure className="relative isolate aspect-[3/4] w-full overflow-hidden bg-green sm:aspect-[16/6]">
      {/* Cuña diagonal lima: cruza por detras de la silueta y sale del encuadre.
          overflow-hidden en el figure recorta los dos lados: eso es lo que
          la lee como "cuña que atraviesa y sale", no como rectangulo suelto. */}
      <div
        aria-hidden
        className="absolute -right-24 top-0 h-full w-2/5 bg-lime"
        style={{ transform: "skewX(-18deg)" }}
      />
      {/* Banda inferior: ancla al jugador y evita que flote. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/4 bg-deep" />

      {/* El jugador rompe el borde superior: la imagen se escala por encima
          del 100% y se ancla arriba con un offset negativo, asi que el
          figure (overflow-hidden) la recorta justo en su propio borde --
          igual que un cutout de retransmision deportiva, nunca contenida
          con margen dentro de su caja. */}
      <img
        src={silhouetteSrc}
        alt={revealed ? `${card.name}, temporada ${card.season}` : "Silueta de un futbolista sin identificar"}
        className="absolute -top-6 right-[6%] z-10 h-[112%] w-auto object-contain object-bottom sm:right-[8%] sm:h-[115%]"
        style={{
          filter: revealed ? "none" : "brightness(0) invert(1)",
          // Se desvanece en cuanto la foto esta lista para tomar su sitio.
          // Si la foto no existe o falla, showPhoto nunca pasa a true y la
          // silueta se queda a opacidad 1 sin que nada mas cambie.
          opacity: showPhoto ? 0 : 1,
          transition: "filter 450ms cubic-bezier(.16,1,.3,1), opacity 450ms cubic-bezier(.16,1,.3,1)",
        }}
      />
      {/* Foto real, en la misma caja exacta que la silueta de arriba (mismo
          recorte, mismo tamano -- ver tools/build-silhouettes.ts) para que
          encaje pixel a pixel al cruzar. Solo se monta -- y por tanto solo
          empieza a descargar -- cuando la carta ya esta revelada. */}
      {revealed && !photoFailed && (
        <img
          src={photoSrc}
          alt=""
          aria-hidden="true"
          onLoad={() => setPhotoReady(true)}
          onError={() => setPhotoFailed(true)}
          className="absolute -top-6 right-[6%] z-10 h-[112%] w-auto object-contain object-bottom sm:right-[8%] sm:h-[115%]"
          style={{
            opacity: photoReady ? 1 : 0,
            transition: "opacity 450ms cubic-bezier(.16,1,.3,1)",
          }}
        />
      )}

      {/* Panel negro: el unico soporte de texto. Nunca texto blanco sobre verde. */}
      <figcaption
        className="panel absolute left-0 top-[8%] z-20 max-w-[70%] bg-ink px-5 py-4 pr-10 sm:top-[10%] sm:max-w-[58%] sm:px-6 sm:py-5 sm:pr-14"
      >
        {revealed ? (
          // El nombre entra desde la izquierda 150ms despues de que la
          // silueta empiece a cruzar a foto (MASTER.md S5). Este div y el
          // filter del <img> de arriba son los dos unicos elementos
          // animados de la vista -- presupuesto que fija S5.
          <div className="reveal-in">
            <p className="font-display text-[clamp(1.75rem,4vw,3rem)] font-extrabold leading-[0.85] tracking-tight text-green">
              {card.name.split(" ")[0]}
            </p>
            <p className="font-display text-[clamp(2rem,5vw,3.75rem)] font-black uppercase leading-[0.85] tracking-tight text-white">
              {card.name.split(" ").slice(1).join(" ") || card.name}
            </p>
            <p className="tnum mt-3 inline-block bg-white px-3 py-1 font-display text-lg font-extrabold tracking-wide text-ink">
              {card.season}
            </p>
          </div>
        ) : (
          <>
            <p className="font-display text-[clamp(1.75rem,4vw,3rem)] font-extrabold uppercase leading-[0.85] tracking-tight text-white">
              Precio
            </p>
            <p className="tnum font-display text-[clamp(3.5rem,9vw,7rem)] font-black leading-[0.8] tracking-tighter text-green">
              ${price}M
            </p>
            <p className="mt-2 font-display text-[clamp(0.9rem,1.6vw,1.25rem)] font-bold uppercase tracking-[0.08em] text-lime">
              {SLOT_LABEL[card.slot] ?? card.slot}
            </p>
          </>
        )}
      </figcaption>
    </figure>
  );
}
