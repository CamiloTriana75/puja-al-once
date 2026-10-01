import { Globe, Lock, RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { fetchPublicRooms, type PublicRoomSummary, type RoomVisibility } from "../../net/roomLookup.js";
import { PillButton, SectionTitle } from "./ui.js";

const CODE_PATTERN = /^[2-9A-HJKMNP-Z]{5}$/;
const ROOMS_ERROR = "No se pudo cargar el vestuario. Puedes reintentarlo.";

interface Props {
  error: string | null;
  initialCode: string | null;
  nameInputRef: RefObject<HTMLInputElement | null>;
  codeInputRef: RefObject<HTMLInputElement | null>;
  onCreate: (name: string, visibility: RoomVisibility) => void;
  onJoinByCode: (name: string, code: string) => void;
  onJoinPublicRoom: (name: string, roomId: string) => void;
}

function VisibilityOption({
  selected,
  onSelect,
  icon,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 font-copy text-[1rem] font-semibold transition-colors duration-200 ${
        selected ? "bg-forest text-white" : "bg-white text-forest hover:bg-pitch-soft"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

export function EnterSection({ error, initialCode, nameInputRef, codeInputRef, onCreate, onJoinByCode, onJoinPublicRoom }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const [visibility, setVisibility] = useState<RoomVisibility>("private");
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async (initial = false) => {
      if (initial) setRoomsLoading(true);
      try {
        const rooms = await fetchPublicRooms();
        if (!active) return;
        setPublicRooms(rooms);
        setRoomsError(null);
      } catch {
        if (active) setRoomsError(ROOMS_ERROR);
      } finally {
        if (active && initial) setRoomsLoading(false);
      }
    };
    void load(true);
    const interval = window.setInterval(() => void load(), 10_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (error) {
      setSubmitting(false);
      setJoiningRoomId(null);
    }
  }, [error]);

  const refreshRooms = () => {
    setRoomsLoading(true);
    fetchPublicRooms()
      .then((rooms) => {
        setPublicRooms(rooms);
        setRoomsError(null);
      })
      .catch(() => setRoomsError(ROOMS_ERROR))
      .finally(() => setRoomsLoading(false));
  };

  /** El nombre lo piden los tres caminos de entrada: se valida aquí, junto al campo. */
  const requireName = (): string | null => {
    const trimmed = name.trim();
    if (trimmed) return trimmed;
    setNameError("Escribe tu nombre para entrar.");
    nameInputRef.current?.focus();
    return null;
  };

  const submitCreate = (event: FormEvent) => {
    event.preventDefault();
    const player = requireName();
    if (!player || submitting) return;
    setSubmitting(true);
    onCreate(player, visibility);
  };

  const submitJoin = (event: FormEvent) => {
    event.preventDefault();
    const player = requireName();
    if (!player || submitting) return;
    const roomCode = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(roomCode)) {
      setCodeError("El código tiene cinco caracteres, por ejemplo A7K2M.");
      codeInputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    onJoinByCode(player, roomCode);
  };

  const joinPublic = (roomId: string) => {
    const player = requireName();
    if (!player || joiningRoomId) return;
    setJoiningRoomId(roomId);
    onJoinPublicRoom(player, roomId);
  };

  return (
    <section id="entrar" aria-labelledby="entrar-title" className="scroll-mt-24 px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionTitle id="entrar-title">{initialCode ? "Tu sala te espera" : "Entra a jugar"}</SectionTitle>
        <p className="mx-auto mt-5 max-w-xl text-center font-copy text-[1.15rem] leading-[1.6] text-slate">
          {initialCode
            ? `La sala ${initialCode} ya está abierta. Escribe tu nombre y entra.`
            : "Escribe tu nombre y elige: abrir una sala para tu grupo o entrar en una que ya existe."}
        </p>

        <div className="mt-12 overflow-hidden rounded-[2rem] bg-white shadow-[0_40px_80px_-50px_rgba(4,23,38,.55)] ring-1 ring-line">
          <div className="border-b border-line px-6 py-7 sm:px-10">
            <label htmlFor="landing-name" className="font-headline text-[0.95rem] font-semibold tracking-[-0.01em] text-forest">
              Tu nombre en el vestuario
            </label>
            <input
              id="landing-name"
              ref={nameInputRef}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="Cómo te llamamos"
              autoComplete="nickname"
              maxLength={18}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "landing-name-error" : "landing-name-help"}
              className="mt-3 h-14 w-full rounded-2xl border-2 border-line bg-canvas px-5 font-copy text-[1.25rem] font-medium text-forest placeholder:text-slate/80 transition-colors focus:border-pine"
            />
            {nameError ? (
              <p id="landing-name-error" role="alert" className="mt-2 font-copy text-[1rem] font-medium text-gold-ink">
                {nameError}
              </p>
            ) : (
              <p id="landing-name-help" className="mt-2 font-copy text-[1rem] text-slate">
                Así te verán en la sala. Hasta 18 caracteres.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-gold/15 ring-1 ring-gold-ink/25 px-4 py-3 font-copy text-[1rem] font-medium text-forest">
                {error}
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2">
            <form onSubmit={submitCreate} noValidate className="flex flex-col bg-pitch px-6 py-8 sm:px-10 sm:py-10">
              <h3 className="font-headline text-[1.3rem] font-semibold tracking-[-0.03em] text-white">Crear una sala</h3>
              <fieldset className="mt-5">
                <legend className="font-copy text-[1rem] font-medium text-white">Visibilidad</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <VisibilityOption
                    selected={visibility === "private"}
                    onSelect={() => setVisibility("private")}
                    icon={<Lock className="h-4 w-4" aria-hidden="true" />}
                  >
                    Privada
                  </VisibilityOption>
                  <VisibilityOption
                    selected={visibility === "public"}
                    onSelect={() => setVisibility("public")}
                    icon={<Globe className="h-4 w-4" aria-hidden="true" />}
                  >
                    Pública · probar
                  </VisibilityOption>
                </div>
                <p className="mt-3 font-copy text-[1rem] leading-[1.5] text-white/90">
                  {visibility === "public"
                    ? "Aparece en el vestuario público mientras espera jugadores."
                    : "Solo entra quien tenga el código o el enlace de invitación."}
                </p>
              </fieldset>
              <PillButton type="submit" tone="forest" disabled={submitting} busy={submitting} className="mt-7 w-full">
                {submitting ? "Entrando al mercado…" : "Crear mi sala"}
              </PillButton>
              <div aria-hidden="true" className="md:flex-1" />
              <p className="mt-8 border-t border-white/25 pt-5 font-copy text-[1rem] leading-[1.55] text-white/90">
                En la sala verás el código y un botón para compartir el enlace con tu grupo. La partida empieza cuando todos pulsan Listo.
              </p>
            </form>

            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <form onSubmit={submitJoin} noValidate>
                <h3 className="font-headline text-[1.3rem] font-semibold tracking-[-0.03em] text-forest">Unirme con código</h3>
                <label htmlFor="landing-code" className="mt-5 block font-copy text-[1rem] font-medium text-forest">
                  Código de la sala
                </label>
                <input
                  id="landing-code"
                  ref={codeInputRef}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.toUpperCase());
                    if (codeError) setCodeError(null);
                  }}
                  placeholder="A7K2M"
                  maxLength={5}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={codeError ? true : undefined}
                  aria-describedby={codeError ? "landing-code-error" : undefined}
                  className="tnum mt-2 h-14 w-full rounded-2xl border-2 border-line bg-canvas px-5 font-headline text-[1.25rem] font-semibold uppercase tracking-[0.3em] text-forest placeholder:text-slate/70 transition-colors focus:border-pine"
                />
                {codeError && (
                  <p id="landing-code-error" role="alert" className="mt-2 font-copy text-[1rem] font-medium text-gold-ink">
                    {codeError}
                  </p>
                )}
                <PillButton type="submit" disabled={submitting} busy={submitting} className="mt-5 w-full">
                  Unirme a la partida
                </PillButton>
              </form>

              <section aria-labelledby="public-rooms-title" className="mt-9 border-t border-line pt-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="public-rooms-title" className="font-headline text-[1.05rem] font-semibold tracking-[-0.02em] text-forest">
                    Vestuario público
                  </h3>
                  <button
                    type="button"
                    onClick={refreshRooms}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 font-copy text-[0.98rem] font-medium text-slate transition-colors hover:bg-canvas hover:text-forest"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Actualizar
                  </button>
                </div>
                <div className="mt-3">
                  {roomsLoading ? (
                    <p role="status" className="rounded-xl bg-canvas px-4 py-3 font-copy text-[1rem] text-slate">
                      Buscando salas abiertas…
                    </p>
                  ) : roomsError ? (
                    <p role="status" className="rounded-xl bg-canvas px-4 py-3 font-copy text-[1rem] text-slate">
                      {roomsError}
                    </p>
                  ) : publicRooms.length === 0 ? (
                    <p role="status" className="rounded-xl bg-canvas px-4 py-3 font-copy text-[1rem] text-slate">
                      No hay salas abiertas ahora. Crea una pública para que se sumen otros.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {publicRooms.map((room) => (
                        <li key={room.roomId}>
                          <button
                            type="button"
                            disabled={joiningRoomId !== null}
                            onClick={() => joinPublic(room.roomId)}
                            className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-line px-4 text-left transition-colors hover:border-pitch disabled:cursor-wait disabled:opacity-60"
                          >
                            <span>
                              <span className="block font-headline text-[0.95rem] font-semibold text-forest">Sala {room.code}</span>
                              <span className="block font-copy text-[0.95rem] text-slate">
                                {room.players} de {room.capacity} jugadores, {room.ready} {room.ready === 1 ? "listo" : "listos"}
                              </span>
                            </span>
                            <span className="font-copy text-[1rem] font-semibold text-forest">
                              {joiningRoomId === room.roomId ? "Entrando…" : "Entrar"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="mt-3 font-copy text-[0.95rem] text-slate">La lista se actualiza sola cada 10 segundos.</p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
