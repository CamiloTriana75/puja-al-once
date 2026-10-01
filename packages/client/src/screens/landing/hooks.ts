import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect, useRef, useState, type RefObject } from "react";

/** Alto de la barra fija más aire: un anclaje nunca debe quedar tapado. */
export const NAV_OFFSET = 88;

export function useSmoothScroll(enabled: boolean): RefObject<Lenis | null> {
  const lenisRef = useRef<Lenis | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.11, anchors: { offset: -NAV_OFFSET } });
    lenisRef.current = lenis;
    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [enabled]);
  return lenisRef;
}

export function scrollToSection(id: string, lenis: Lenis | null, onArrive?: () => void): void {
  const target = document.getElementById(id);
  if (!target) return;
  if (lenis) {
    lenis.scrollTo(target, { offset: -NAV_OFFSET, onComplete: () => onArrive?.() });
    return;
  }
  target.scrollIntoView({ block: "start" });
  onArrive?.();
}

/** Al entrar en una sala la portada se desmonta a media página: la sala empieza arriba. */
export function useResetScrollOnLeave(): void {
  useEffect(() => () => {
    if (window.scrollY > 0) window.scrollTo(0, 0);
  }, []);
}

/** Visibilidad continua; sin IntersectionObserver se asume visible. */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry?.isIntersecting ?? true));
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}

export function useInViewOnce<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (seen || !node) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSeen(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);
  return [ref, seen];
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}
