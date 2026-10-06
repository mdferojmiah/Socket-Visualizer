import { useCallback, useEffect, useState } from 'react';
import { redisCommands, redisConnections } from '../data/redisLoop';

export type RedisPhase = 'wait' | 'ready' | 'process' | 'write';

export interface RedisEntry {
  id: number;
  fd: number;
  cmd: string;
  reply: string;
  us: number;
}

interface RedisLoopState {
  phase: RedisPhase;
  iteration: number;
  ready: number[];
  cursor: number;
  /** fds whose reply is queued, waiting for beforeSleep */
  pending: number[];
  /** fds that just had replies written */
  flushed: number[];
  log: RedisEntry[];
  commands: number;
  totalUs: number;
}

const TICK_MS = 850;

const initial = (): RedisLoopState => ({
  phase: 'wait',
  iteration: 1,
  ready: [],
  cursor: 0,
  pending: [],
  flushed: [],
  log: [],
  commands: 0,
  totalUs: 0
});

/** Small deterministic PRNG so the demo is the same every time. */
function rng(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pickReady(iteration: number) {
  const r = rng(iteration * 7919);
  const count = 2 + Math.floor(r() * 4);
  const set = new Set<number>();
  while (set.size < count) set.add(redisConnections[Math.floor(r() * redisConnections.length)]);
  return [...set].sort((a, b) => a - b);
}

function processNext(s: RedisLoopState): RedisLoopState {
  const fd = s.ready[s.cursor];
  const r = rng(s.iteration * 131 + fd);
  const c = redisCommands[Math.floor(r() * redisCommands.length)];
  const us = Math.round((0.6 + r() * 1.8) * 10) / 10;
  const entry: RedisEntry = { id: s.commands + 1, fd, cmd: c.cmd, reply: c.reply, us };
  return {
    ...s,
    pending: [...s.pending, fd],
    log: [entry, ...s.log].slice(0, 6),
    commands: s.commands + 1,
    totalUs: s.totalUs + us,
    cursor: s.cursor + 1
  };
}

function advance(s: RedisLoopState): RedisLoopState {
  switch (s.phase) {
    case 'wait':
      return { ...s, phase: 'ready', ready: pickReady(s.iteration), cursor: 0, flushed: [] };
    case 'ready':
      return processNext({ ...s, phase: 'process', cursor: 0 });
    case 'process':
      return s.cursor >= s.ready.length ? { ...s, phase: 'write' } : processNext(s);
    case 'write':
      return { ...s, phase: 'wait', iteration: s.iteration + 1, flushed: s.pending, pending: [], ready: [], cursor: 0 };
  }
}

export function useRedisLoop() {
  const [state, setState] = useState<RedisLoopState>(initial);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setState(advance), TICK_MS);
    return () => window.clearTimeout(t);
  }, [playing, state]);

  const step = useCallback(() => {
    setPlaying(false);
    setState(advance);
  }, []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const reset = useCallback(() => {
    setPlaying(false);
    setState(initial());
  }, []);

  /** fd currently being handled in the process phase (the last one finished) */
  const current = state.phase === 'process' && state.cursor > 0 ? state.ready[state.cursor - 1] : null;

  return { ...state, current, playing, step, toggle, reset };
}