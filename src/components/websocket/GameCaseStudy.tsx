import React from 'react';
import { CodeBlock } from '../CodeBlock';
import { GameLoopPanel } from './GameLoopPanel';
import { useGameLoop } from '../../hooks/useGameLoop';
import { gameClientCode, gameReasons, gameServerCode } from '../../data/gameLoop';
import type { GamePhase } from '../../hooks/useGameLoop';

const serverLine: Record<GamePhase, number> = { inputs: 12, simulate: 21, broadcast: 27, sleep: 19 };
const clientLine: Record<GamePhase, number> = { inputs: 22, simulate: 24, broadcast: 12, sleep: 24 };

export function GameCaseStudy() {
  const loop = useGameLoop();

  return (
    <section aria-labelledby="game-heading" className="border-t border-line pt-8">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-server">Sockets in online games</p>
        <h2 id="game-heading" className="mt-1 text-2xl font-semibold tracking-tight md:text-[28px]">
          How a multiplayer game keeps every screen in sync
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
          A game is the chat pattern on a clock. Every player keeps one socket open to the game server. Players send tiny
          inputs whenever their keys change; the server runs the world on a fixed tick and broadcasts a snapshot of it to
          everyone, many times a second. Browser games and many Unity games do this over WebSocket. The simulation below runs
          15× slower than real time so you can follow each tick.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <GameLoopPanel loop={loop} />

        <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <h3 className="font-mono text-[14px] font-semibold text-server">GameServer.cs</h3>
            <span className="text-[12px] text-muted">C# · ASP.NET Core</span>
          </div>
          <div className="px-4 py-3">
            <CodeBlock lines={gameServerCode} activeLine={serverLine[loop.phase]} side="server" />
          </div>
          <div className="flex items-baseline justify-between gap-2 border-y border-line px-4 py-3">
            <h3 className="font-mono text-[14px] font-semibold text-client">GameClient.cs</h3>
            <span className="text-[12px] text-muted">C# · Unity</span>
          </div>
          <div className="px-4 py-3">
            <CodeBlock lines={gameClientCode} activeLine={clientLine[loop.phase]} side="client" />
            <p className="mt-2 text-[12px] leading-snug text-muted">
              Highlighted lines follow the simulation. Update() draws at 60 fps but only learns new positions 20 times a
              second, so real games smooth the gap by interpolating between the last two snapshots.
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
        {gameReasons.map((r, i) =>
        <div key={r.title} className={`border-l-2 pl-4 ${i === gameReasons.length - 1 ? 'border-warn' : 'border-ink/80'}`}>
            <dt className="text-[14px] font-semibold">{r.title}</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-muted">{r.body}</dd>
          </div>
        )}
      </dl>
    </section>);

}