import { useCallback, useEffect, useState } from 'react';
import type { KernelSource } from '../types/kernel';

const RUN_TICK_MS = 260;

export type DebugMode = 'entry' | 'step' | 'breakpoint' | 'running' | 'returned';

/**
 * Drives a fake debugger over a kernel trace.
 * `pc` indexes source.trace; pc === trace.length means the call has returned to user space.
 */
export function useSyscallDebugger(source: KernelSource | null, resetKey: string) {
  const [pc, setPc] = useState(0);
  const [running, setRunning] = useState(false);
  const [hitBreakpoint, setHitBreakpoint] = useState(false);
  const [userBreakpoints, setUserBreakpoints] = useState<Record<string, number[]>>({});

  useEffect(() => {
    setPc(0);
    setRunning(false);
    setHitBreakpoint(false);
  }, [resetKey]);

  const total = source?.trace.length ?? 0;
  const breakpoints = source ? userBreakpoints[source.id] ?? source.breakpoints : [];

  useEffect(() => {
    if (!running || !source) return;
    const t = window.setTimeout(() => {
      const n = pc + 1;
      setPc(n);
      if (n >= total) {
        setRunning(false);
        setHitBreakpoint(false);
      } else if (breakpoints.includes(source.trace[n].line)) {
        setRunning(false);
        setHitBreakpoint(true);
      }
    }, RUN_TICK_MS);
    return () => window.clearTimeout(t);
  }, [running, pc, total, source, breakpoints]);

  const step = useCallback(() => {
    setRunning(false);
    setHitBreakpoint(false);
    setPc((p) => Math.min(p + 1, total));
  }, [total]);

  const resume = useCallback(() => {
    if (pc >= total) return;
    setHitBreakpoint(false);
    setRunning(true);
  }, [pc, total]);

  const pause = useCallback(() => setRunning(false), []);

  const restart = useCallback(() => {
    setRunning(false);
    setHitBreakpoint(false);
    setPc(0);
  }, []);

  const toggleBreakpoint = useCallback(
    (line: number) => {
      if (!source) return;
      setUserBreakpoints((prev) => {
        const cur = prev[source.id] ?? source.breakpoints;
        const next = cur.includes(line) ? cur.filter((l) => l !== line) : [...cur, line];
        return { ...prev, [source.id]: next };
      });
    },
    [source]
  );

  const returned = pc >= total && total > 0;
  const mode: DebugMode = running ? 'running' : returned ? 'returned' : hitBreakpoint ? 'breakpoint' : pc === 0 ? 'entry' : 'step';
  const point = source && !returned ? source.trace[pc] : null;
  const prevPoint = source && pc > 0 ? source.trace[Math.min(pc, total) - 1] : null;

  return { pc, point, prevPoint, mode, breakpoints, step, resume, pause, restart, toggleBreakpoint };
}