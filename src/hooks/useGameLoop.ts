import { useCallback, useEffect, useState } from 'react';
import { ARENA, gamePlayers } from '../data/gameLoop';

export type GamePhase = 'sleep' | 'inputs' | 'simulate' | 'broadcast';

export interface GameInput {
  dx: number;
  dy: number;
}

export interface GamePlayerState {
  id: string;
  x: number;
  y: number;
  input: GameInput;
  seq: number;
  /** sent a new input frame in the current tick */
  sent: boolean;
}

interface GameLoopState {
  phase: GamePhase;
  tick: number;
  players: GamePlayerState[];
  /** positions currently drawn on players' screens (last snapshot) */
  shown: {x: number;y: number;}[];
  snapshotBytes: number;
  inputsReceived: number;
}

const TICK_MS = 750;

const DIRS: GameInput[] = [
{ dx: 1, dy: 0 },
{ dx: -1, dy: 0 },
{ dx: 0, dy: 1 },
{ dx: 0, dy: -1 },
{ dx: 1, dy: 1 },
{ dx: -1, dy: -1 },
{ dx: 1, dy: -1 },
{ dx: -1, dy: 1 }];


const inside = (x: number, y: number) => x >= ARENA.min && x <= ARENA.maxX && y >= ARENA.min && y <= ARENA.maxY;

function snapshotSize(tick: number, players: GamePlayerState[]) {
  const json = JSON.stringify({ tick, players: players.map((p) => [p.x, p.y]) });
  return json.length + 2; // 2-byte unmasked frame header
}

const initial = (): GameLoopState => {
  const players = gamePlayers.map((m) => ({ id: m.id, x: m.start.x, y: m.start.y, input: { dx: 0, dy: 0 }, seq: 0, sent: false }));
  return {
    phase: 'sleep',
    tick: 0,
    players,
    shown: players.map((p) => ({ x: p.x, y: p.y })),
    snapshotBytes: snapshotSize(0, players),
    inputsReceived: 0
  };
};

/** Small deterministic PRNG so the demo is the same every time. */
function rng(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function receiveInputs(s: GameLoopState): GameLoopState {
  let received = 0;
  const players = s.players.map((p, i) => {
    const meta = gamePlayers[i];
    const blocked = !inside(p.x + p.input.dx * ARENA.step, p.y + p.input.dy * ARENA.step);
    const stopped = p.input.dx === 0 && p.input.dy === 0;
    if (!blocked && !stopped && s.tick % meta.changeEvery !== 0) return { ...p, sent: false };
    const r = rng(s.tick * 97 + i * 13 + 1);
    const options = DIRS.filter(
      (d) => (d.dx !== p.input.dx || d.dy !== p.input.dy) && inside(p.x + d.dx * ARENA.step, p.y + d.dy * ARENA.step)
    );
    const input = options[Math.floor(r() * options.length)] ?? { dx: 0, dy: 0 };
    received += 1;
    return { ...p, input, seq: p.seq + 1, sent: true };
  });
  return { ...s, phase: 'inputs', players, inputsReceived: s.inputsReceived + received };
}

function advance(s: GameLoopState): GameLoopState {
  switch (s.phase) {
    case 'sleep':
      return receiveInputs(s);
    case 'inputs':
      return {
        ...s,
        phase: 'simulate',
        players: s.players.map((p) => {
          const x = p.x + p.input.dx * ARENA.step;
          const y = p.y + p.input.dy * ARENA.step;
          return inside(x, y) ? { ...p, x, y } : p;
        })
      };
    case 'simulate':{
        const tick = s.tick + 1;
        return {
          ...s,
          phase: 'broadcast',
          tick,
          shown: s.players.map((p) => ({ x: p.x, y: p.y })),
          snapshotBytes: snapshotSize(tick, s.players)
        };
      }
    case 'broadcast':
      return { ...s, phase: 'sleep', players: s.players.map((p) => ({ ...p, sent: false })) };
  }
}

export function useGameLoop() {
  const [state, setState] = useState<GameLoopState>(initial);
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

  return { ...state, playing, step, toggle, reset };
}