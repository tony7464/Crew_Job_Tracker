import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/useTheme";
import { CountUp } from "../ui/Motion";
import { cx } from "../ui/styles";
import { prefersReducedMotion } from "../ui/useMotion";
import { createCrewScene, webglAvailable } from "./scene";

const START = { done: 0, total: 6, earned: 0 };
const dollars = (amount) => `$${amount.toLocaleString("en-US")}`;

// The 3D neighbourhood. variant: "hero" or "auth". hud: show the jobs-done and collected chips.
// It fills its parent, which sets the size. Load it with lazy(), since it brings in three.js.
export default function CrewScene({ variant = "hero", hud = true, className }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const { theme } = useTheme();
  const [supported] = useState(webglAvailable);
  const [progress, setProgress] = useState(START);

  useEffect(() => {
    if (!supported) return undefined;
    let scene;
    try {
      scene = createCrewScene(canvasRef.current, {
        variant,
        onProgress: setProgress,
        reducedMotion: prefersReducedMotion(),
      });
    } catch {
      return undefined; // no WebGL after all: the stage stays empty
    }
    sceneRef.current = scene;
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, [supported, variant]);

  useEffect(() => {
    sceneRef.current?.setTheme(theme);
  }, [theme, supported, variant]);

  if (!supported) {
    return (
      <img
        src="/marketing/dashboard-light.webp"
        alt="The owner's dashboard: this week's totals and the team schedule."
        className={cx("h-full w-full rounded-2xl border border-border object-cover shadow-pop", className)}
      />
    );
  }

  return (
    <div className={cx("relative h-full w-full select-none", className)}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        role="img"
        aria-label="A small 3D neighbourhood: a crew van drives a loop of six houses and finishes the job at each one."
      />
      {hud && (
        <>
          <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-2 sm:left-4 sm:top-4" aria-hidden="true">
            <span className="glass rounded-xl border border-border px-3 py-2 shadow-card">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted">Jobs done</span>
              <span className="font-display text-lg font-bold tabular-nums text-fg">
                {progress.done}/{progress.total}
              </span>
            </span>
            <span className="glass rounded-xl border border-border px-3 py-2 shadow-card">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted">Collected</span>
              <span className="font-display text-lg font-bold tabular-nums text-success">
                <CountUp value={progress.earned} format={dollars} duration={600} />
              </span>
            </span>
          </div>
          <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs font-medium text-muted">
            Tap a house to finish the job · drag to spin
          </p>
        </>
      )}
    </div>
  );
}
