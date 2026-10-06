import { useCallback, useEffect, useState } from 'react';
import { availability, initialPlayState, runPlayAction, tour } from '../utils/playgroundEngine';
import type { Packet } from '../types/socket';
import type { PlayAction, PlayFrame, PlayLogEntry, PlayState } from '../types/playground';

const PACKET_MS = 1300;
const LOCAL_MS = 650;

export function usePlayground() {
  const [state, setState] = useState<PlayState>(initialPlayState);
  const [queue, setQueue] = useState<PlayFrame[]>([]);
  const [frame, setFrame] = useState<PlayFrame | null>(null);
  const [log, setLog] = useState<PlayLogEntry[]>([]);
  const [history, setHistory] = useState<{id: string;packet: Packet;}[]>([]);
  const [tourIndex, setTourIndex] = useState(0);

  useEffect(() => {
    if (queue.length === 0) return;
    const [f, ...rest] = queue;
    setFrame(f);
    setState(f.state);
    setLog((l) => l.some((x) => x.id === f.log.id) ? l : [f.log, ...l]);
    if (f.packet) {
      const packet = f.packet;
      setHistory((h) => h.some((x) => x.id === f.id) ? h : [...h, { id: f.id, packet }]);
    }
    const t = window.setTimeout(() => setQueue(rest), f.packet ? PACKET_MS : LOCAL_MS);
    return () => window.clearTimeout(t);
  }, [queue]);

  const busy = queue.length > 0;

  const dispatch = useCallback(
    (action: PlayAction) => {
      if (busy) return;
      if (!availability(state, action.side, action.kind).ok) return;
      setQueue(runPlayAction(state, action));
      const hit = tour.findIndex((t, i) => i >= tourIndex && t.side === action.side && t.kind === action.kind);
      if (hit !== -1) setTourIndex(hit + 1);
    },
    [busy, state, tourIndex]
  );

  const reset = useCallback(() => {
    setQueue([]);
    setState(initialPlayState());
    setFrame(null);
    setLog([]);
    setHistory([]);
    setTourIndex(0);
  }, []);

  let suggestion: PlayAction | null = null;
  let suggestionIndex = -1;
  if (!busy) {
    for (let i = tourIndex; i < tour.length; i++) {
      if (availability(state, tour[i].side, tour[i].kind).ok) {
        suggestion = tour[i];
        suggestionIndex = i;
        break;
      }
    }
  }

  return {
    state,
    frame,
    log,
    history: history.slice(-10),
    busy,
    suggestion,
    suggestionIndex,
    tourIndex,
    tourTotal: tour.length,
    dispatch,
    reset
  };
}