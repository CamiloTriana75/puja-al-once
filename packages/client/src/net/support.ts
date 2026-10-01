import { useSyncExternalStore } from "react";

// Estado del dialogo de apoyo (donaciones), compartido por la interfaz igual que
// el de comentarios (feedback.ts): cualquier boton llama a `openSupport()` y
// `<SupportHost>` pinta el dialogo.
let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function openSupport(): void {
  open = true;
  emit();
}

export function closeSupport(): void {
  open = false;
  emit();
}

export function useSupportOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
    () => false,
  );
}
