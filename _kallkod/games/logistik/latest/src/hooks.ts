import { useEffect, useState } from "react";

/** forces a rerender every `ms` so components can read the mutable game state */
export function useTicker(ms: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}
