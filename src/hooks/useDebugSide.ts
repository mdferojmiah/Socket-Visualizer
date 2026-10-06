import { useCallback, useState } from 'react';
import type { Side } from '../types/socket';

/**
 * Which machine the kernel debugger is attached to.
 * Follows `preferred` (usually the acting side) unless the user picked a side during the current step.
 */
export function useDebugSide(stepId: string, preferred: Side, available: Record<Side, boolean>) {
  const [override, setOverride] = useState<{side: Side;stepId: string;} | null>(null);
  let side: Side = override && override.stepId === stepId ? override.side : preferred;
  if (!available[side]) {
    const other: Side = side === 'client' ? 'server' : 'client';
    if (available[other]) side = other;
  }
  const choose = useCallback((s: Side) => setOverride({ side: s, stepId }), [stepId]);
  return [side, choose] as const;
}