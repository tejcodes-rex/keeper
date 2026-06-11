import { useEffect, useRef, useState } from "react";

// Animates a number toward `target` with an ease-out curve. Used by the
// business-impact meters so values feel alive as they climb.
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = performance.now();
    const from = fromRef.current;
    const delta = target - from;

    const tick = (now: number) => {
      const p = Math.min(1, (now - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + delta * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
