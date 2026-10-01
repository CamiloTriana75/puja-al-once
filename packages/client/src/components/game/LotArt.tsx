import { useEffect, useState } from "react";

/**
 * El cromo de una carta: campo verde con franjas, cuña oro y banda bosque,
 * con el jugador rompiendo el borde superior. Mismo arte en la subasta, la
 * ceremonia, los resultados y la portada.
 *
 * Con `photoSrc`, la foto se precarga oculta y solo cruza sobre la silueta
 * cuando ya ha bajado entera: si falla, la silueta se queda donde estaba.
 */
export function LotArt({
  silhouetteSrc,
  photoSrc,
  revealed,
  alt,
  className = "",
  children,
}: {
  silhouetteSrc?: string;
  photoSrc?: string;
  revealed: boolean;
  alt: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [photoReady, setPhotoReady] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoReady(false);
    setPhotoFailed(false);
  }, [photoSrc, revealed]);

  const showPhoto = revealed && photoReady && !photoFailed;

  return (
    <div className={`lot-field relative isolate overflow-hidden ${className}`}>
      <div aria-hidden="true" className="absolute -right-[18%] top-0 h-full w-[42%] -skew-x-[18deg] bg-gold" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[24%] bg-forest" />
      {silhouetteSrc && (
        <img
          src={silhouetteSrc}
          alt={showPhoto ? "" : alt}
          aria-hidden={showPhoto || undefined}
          decoding="async"
          className="absolute -top-[5%] right-[4%] z-10 h-[108%] w-auto max-w-none object-contain object-bottom transition-[opacity,filter] duration-500 ease-[cubic-bezier(.16,1,.3,1)]"
          style={{ filter: revealed ? "none" : "brightness(0) invert(1)", opacity: showPhoto ? 0 : 1 }}
        />
      )}
      {photoSrc && revealed && !photoFailed && (
        <img
          src={photoSrc}
          alt={showPhoto ? alt : ""}
          aria-hidden={showPhoto ? undefined : true}
          decoding="async"
          onLoad={() => setPhotoReady(true)}
          onError={() => setPhotoFailed(true)}
          className="absolute -top-[5%] right-[4%] z-10 h-[108%] w-auto max-w-none object-contain object-bottom transition-opacity duration-500 ease-[cubic-bezier(.16,1,.3,1)]"
          style={{ opacity: photoReady ? 1 : 0 }}
        />
      )}
      {children}
    </div>
  );
}
