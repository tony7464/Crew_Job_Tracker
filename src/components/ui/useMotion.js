// Motion hooks. The components that use them are in Motion.jsx (this file is useMotion.js so the two names differ by more than case).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.(REDUCED).matches);
}

// True while the media query matches; follows changes (a rotated phone, a resized window).
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function usePrefersReducedMotion() {
  return useMediaQuery(REDUCED);
}

// A whole number that counts from what is showing to value. Starts at 0 on first render.
export function useCountUp(value, duration = 900) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  const current = useRef(shown);

  useEffect(() => {
    const start = current.current;
    if (start === value) return undefined;
    const instant = prefersReducedMotion();
    let began = null;
    let frame = requestAnimationFrame(function step(now) {
      began ??= now;
      const t = instant ? 1 : Math.min(1, (now - began) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = t === 1 ? value : Math.round(start + (value - start) * eased);
      current.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}

// Adds "is-in" to the element the first time it scrolls into view (see .reveal in index.css).
export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("is-in");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

// Pointer handlers that lean an element toward the pointer (see .tilt in index.css).
// max: the most it leans, in degrees. Touch and reduced motion get no lean.
export function tiltHandlers(max = 7) {
  return {
    onPointerMove(event) {
      if (event.pointerType === "touch" || prefersReducedMotion()) return;
      const el = event.currentTarget;
      const box = el.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      el.style.setProperty("--ry", `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${((0.5 - y) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      el.classList.add("is-tilting");
    },
    onPointerLeave(event) {
      const el = event.currentTarget;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.classList.remove("is-tilting");
    },
  };
}
