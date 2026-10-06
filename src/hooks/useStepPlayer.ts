import { useCallback, useEffect, useState } from 'react';

export function useStepPlayer(total: number, intervalMs = 3400) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const go = useCallback(
    (i: number) => {
      setPlaying(false);
      setIndex(Math.max(0, Math.min(i, total - 1)));
    },
    [total]
  );

  const next = useCallback(() => {
    setPlaying(false);
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);

  const prev = useCallback(() => {
    setPlaying(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setPlaying(false);
    setIndex(0);
  }, []);

  const toggle = useCallback(() => {
    if (!playing && index >= total - 1) setIndex(0);
    setPlaying(!playing);
  }, [playing, index, total]);

  useEffect(() => {
    if (!playing) return;
    if (index >= total - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setIndex((i) => i + 1), intervalMs);
    return () => window.clearTimeout(t);
  }, [playing, index, total, intervalMs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) && e.key === ' ') return;
      if (e.key === 'ArrowRight') next();else
      if (e.key === 'ArrowLeft') prev();else
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, toggle]);

  return { index, playing, go, next, prev, reset, toggle };
}