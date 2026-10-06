import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDownIcon, ArrowUpIcon, MoonIcon, PauseIcon, PlayIcon, RotateCcwIcon, StepForwardIcon } from 'lucide-react';
import { ARENA, TICK_RATE, gamePlayers } from '../../data/gameLoop';
import type { GamePlayerColor } from '../../data/gameLoop';
import type { useGameLoop } from '../../hooks/useGameLoop';

type Loop = ReturnType<typeof useGameLoop>;

const btn =
'inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors duration-150 hover:bg-kernel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30';

const fill: Record<GamePlayerColor, string> = {
  client: 'rgb(var(--client))',
  server: 'rgb(var(--server))',
  ok: 'rgb(var(--ok))'
};
const textCls: Record<GamePlayerColor, string> = { client: 'text-client', server: 'text-server', ok: 'text-ok' };

const ease = [0.23, 1, 0.32, 1] as const;

export function GameLoopPanel({ loop }: {loop: Loop;}) {
  const reduce = useReducedMotion();
  const now = describePhase(loop);
  const outPerSecond = loop.snapshotBytes * TICK_RATE * gamePlayers.length / 1000;

  return (
    <section aria-label="Game server tick loop simulation" className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15px] font-semibold">game-server</h3>
          <span className="font-mono text-xs text-muted">
            tick #{loop.tick} · {TICK_RATE} ticks/s
          </span>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Simulation controls">
          <button type="button" onClick={loop.toggle} className={btn}>
            {loop.playing ? <PauseIcon className="h-3.5 w-3.5" aria-hidden /> : <PlayIcon className="h-3.5 w-3.5 text-ok" aria-hidden />}
            {loop.playing ? 'Pause' : 'Run game'}
          </button>
          <button type="button" onClick={loop.step} className={btn}>
            <StepForwardIcon className="h-3.5 w-3.5" aria-hidden />
            Step
          </button>
          <button type="button" onClick={loop.reset} className={btn} aria-label="Reset simulation">
            <RotateCcwIcon className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </header>

      <div className="border-b border-line bg-kernel px-4 py-3" aria-live="polite">
        <span className="text-[11px] font-medium text-muted">Game loop</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${loop.tick}-${loop.phase}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15, ease }}
            className="mt-0.5 flex items-start gap-2">
            
            {loop.phase === 'sleep' && <MoonIcon className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />}
            <div className="min-w-0">
              <p className="font-mono text-[13px] font-semibold text-ink">{now.title}</p>
              <p className="text-[13px] leading-snug text-ink/75">{now.detail}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="grid flex-1 md:grid-cols-[minmax(0,1fr)_240px] md:divide-x md:divide-line">
        {/* Arena */}
        <div className="min-w-0 px-4 py-3">
          <h4 className="mb-2 text-xs font-semibold">World state</h4>
          <svg
            viewBox={`0 0 ${ARENA.width} ${ARENA.height}`}
            className="h-auto w-full rounded-lg border border-line bg-canvas"
            role="img"
            aria-label={`Arena at tick ${loop.tick}`}>
            
            {Array.from({ length: 9 }, (_, i) =>
            <line key={`v${i}`} x1={(i + 1) * 10} y1={0} x2={(i + 1) * 10} y2={ARENA.height} stroke="rgb(var(--line))" strokeWidth={0.2} />
            )}
            {Array.from({ length: 5 }, (_, i) =>
            <line key={`h${i}`} x1={0} y1={(i + 1) * 10} x2={ARENA.width} y2={(i + 1) * 10} stroke="rgb(var(--line))" strokeWidth={0.2} />
            )}

            {gamePlayers.map((m, i) => {
              const p = loop.players[i];
              const ghost = loop.shown[i];
              const color = fill[m.color];
              const t = { duration: reduce ? 0 : 0.25, ease };
              return (
                <g key={m.id}>
                  <motion.circle
                    initial={false}
                    animate={{ cx: ghost.x, cy: ghost.y }}
                    transition={t}
                    r={3.4}
                    fill="none"
                    stroke={color}
                    strokeWidth={0.4}
                    strokeDasharray="1 0.8" />
                  
                  {loop.phase === 'inputs' && p.sent &&
                  <line
                    x1={p.x}
                    y1={p.y}
                    x2={p.x + p.input.dx * 6}
                    y2={p.y + p.input.dy * 6}
                    stroke={color}
                    strokeWidth={0.7}
                    strokeLinecap="round" />

                  }
                  <motion.circle initial={false} animate={{ cx: p.x, cy: p.y }} transition={t} r={2.2} fill={color} />
                  <motion.text
                    initial={false}
                    animate={{ x: p.x, y: p.y - 3.6 }}
                    transition={t}
                    textAnchor="middle"
                    fontSize={2.6}
                    fontWeight={600}
                    fill={color}>
                    
                    {m.name}
                  </motion.text>
                </g>);

            })}
          </svg>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-ink/70" aria-hidden />
              server’s true position
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-dashed border-ink/70" aria-hidden />
              what players’ screens show (last snapshot)
            </span>
          </div>
        </div>

        {/* Sockets */}
        <div className="border-t border-line px-4 py-3 md:border-t-0">
          <h4 className="text-xs font-semibold">One WebSocket per player</h4>
          <ul className="mt-2 space-y-2.5">
            {gamePlayers.map((m, i) => {
              const p = loop.players[i];
              return (
                <li key={m.id} className="text-[12px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`font-semibold ${textCls[m.color]}`}>{m.name}</span>
                    <span className="font-mono text-[10px] text-muted">{m.latencyMs} ms away</span>
                  </div>
                  <div className="mt-0.5 h-5 font-mono text-[11px]">
                    {loop.phase === 'inputs' && p.sent ?
                    <span className="inline-flex items-center gap-1 text-ink">
                        <ArrowUpIcon className="h-3 w-3" aria-hidden />
                        input #{p.seq} {`{dx:${p.input.dx}, dy:${p.input.dy}}`}
                      </span> :
                    loop.phase === 'broadcast' ?
                    <span className="inline-flex items-center gap-1 text-server">
                        <ArrowDownIcon className="h-3 w-3" aria-hidden />
                        snapshot tick {loop.tick} · {loop.snapshotBytes} B
                      </span> :

                    <span className="text-muted">
                        {loop.phase === 'inputs' ? 'no key change, nothing sent' : `holding input {dx:${p.input.dx}, dy:${p.input.dy}}`}
                      </span>
                    }
                  </div>
                </li>);

            })}
          </ul>
        </div>
      </div>

      <footer className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-line px-4 py-2.5 text-[12px] text-muted">
        <span>
          <span className="font-mono font-semibold text-ink">{loop.inputsReceived}</span> inputs received
        </span>
        <span>
          <span className="font-mono font-semibold text-ink">{loop.snapshotBytes}</span> B per snapshot
        </span>
        <span className="ml-auto">
          At {TICK_RATE} ticks/s that’s ≈ <span className="font-mono font-semibold text-ink">{outPerSecond.toFixed(1)} KB/s</span> out to{' '}
          {gamePlayers.length} players
        </span>
      </footer>
    </section>);

}

function describePhase(loop: Loop): {title: string;detail: string;} {
  const sent = loop.players.filter((p) => p.sent).length;
  switch (loop.phase) {
    case 'sleep':
      return {
        title: 'await timer.WaitForNextTickAsync()',
        detail:
        loop.tick === 0 ?
        'Three players are connected. Press Run game or Step to start ticking.' :
        `Tick ${loop.tick} is done. The loop sleeps out the rest of its 50 ms slot while sockets stay open.`
      };
    case 'inputs':
      return {
        title: sent ? `${sent} input frame${sent > 1 ? 's' : ''} arrived` : 'No new inputs',
        detail:
        'Clients only send when their keys change. Each connection’s ReceiveAsync() loop stores the newest input for its player. Nobody moves yet.'
      };
    case 'simulate':
      return {
        title: `tick ${loop.tick + 1}: simulate`,
        detail:
        'The server alone applies every stored input, moves each player and enforces the walls. Screens still show the old positions.'
      };
    case 'broadcast':
      return {
        title: `SendAsync(snapshot) → ${loop.players.length} sockets`,
        detail: `One ${loop.snapshotBytes}-byte snapshot is written to every player’s TCP socket. Their ReceiveAsync() returns and the screens catch up.`
      };
  }
}