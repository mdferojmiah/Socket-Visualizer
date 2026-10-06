import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoonIcon, PauseIcon, PlayIcon, RotateCcwIcon, StepForwardIcon } from 'lucide-react';
import { redisConnections, redisTotalClients } from '../../data/redisLoop';
import type { useRedisLoop } from '../../hooks/useRedisLoop';

type Loop = ReturnType<typeof useRedisLoop>;

const btn =
'inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors duration-150 hover:bg-kernel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30';

export function RedisLoopPanel({ loop }: {loop: Loop;}) {
  const avg = loop.commands ? loop.totalUs / loop.commands : 0;
  const perSecond = avg ? Math.round(1_000_000 / avg / 1000) * 1000 : 0;

  const cellState = (fd: number) => {
    if (fd === loop.current) return 'current';
    const ri = loop.ready.indexOf(fd);
    if (ri !== -1 && (loop.phase === 'ready' || ri >= loop.cursor)) return 'ready';
    if (loop.pending.includes(fd)) return 'pending';
    if (loop.phase === 'wait' && loop.flushed.includes(fd)) return 'flushed';
    return 'idle';
  };

  const cellCls: Record<string, string> = {
    current: 'border-server bg-server text-white',
    ready: 'border-warn bg-warn/15 text-warn',
    pending: 'border-ok/50 bg-ok/5 text-ok',
    flushed: 'border-ok bg-ok text-white',
    idle: 'border-line text-muted/60'
  };

  const now = describePhase(loop);

  return (
    <section aria-label="Redis event loop simulation" className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15px] font-semibold">redis-server</h3>
          <span className="font-mono text-xs text-muted">1 thread · loop #{loop.iteration}</span>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Simulation controls">
          <button type="button" onClick={loop.toggle} className={btn}>
            {loop.playing ? <PauseIcon className="h-3.5 w-3.5" aria-hidden /> : <PlayIcon className="h-3.5 w-3.5 text-ok" aria-hidden />}
            {loop.playing ? 'Pause' : 'Run loop'}
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

      {/* What the one thread is doing right now */}
      <div className="border-b border-line bg-kernel px-4 py-3" aria-live="polite">
        <span className="text-[11px] font-medium text-muted">Main thread</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${loop.iteration}-${loop.phase}-${loop.cursor}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="mt-0.5 flex items-start gap-2">
            
            {loop.phase === 'wait' && <MoonIcon className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />}
            <div className="min-w-0">
              <p className="font-mono text-[13px] font-semibold text-ink">{now.title}</p>
              <p className="text-[13px] leading-snug text-ink/75">{now.detail}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Connections */}
      <div className="px-4 py-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-xs font-semibold">Client sockets registered with epoll</h4>
          <span className="text-[11px] text-muted">
            {redisConnections.length} shown of {redisTotalClients.toLocaleString()}
          </span>
        </div>
        <ul className="grid grid-cols-8 gap-1 sm:grid-cols-12 2xl:grid-cols-[repeat(16,minmax(0,1fr))]">
          {redisConnections.map((fd) => {
            const st = cellState(fd);
            return (
              <li
                key={fd}
                className={`flex h-7 items-center justify-center rounded border font-mono text-[10px] font-medium transition-colors duration-200 ${cellCls[st]}`}
                aria-label={`fd ${fd}: ${st}`}>
                
                {fd}
              </li>);

          })}
        </ul>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <Legend cls="border-warn bg-warn/15" label="data arrived (on the ready list)" />
          <Legend cls="border-server bg-server" label="being served" />
          <Legend cls="border-ok/50 bg-ok/5" label="reply queued" />
          <Legend cls="border-ok bg-ok" label="reply written" />
        </div>
      </div>

      {/* Ready list + served commands */}
      <div className="grid flex-1 border-t border-line md:grid-cols-[200px_minmax(0,1fr)] md:divide-x md:divide-line">
        <div className="px-4 py-3">
          <h4 className="text-xs font-semibold">epoll_wait() returned</h4>
          {loop.ready.length === 0 ?
          <p className="mt-1.5 text-[12px] text-muted">{loop.phase === 'wait' ? 'Nothing yet. Sleeping.' : '—'}</p> :

          <ol className="mt-1.5 flex flex-wrap gap-1">
              {loop.ready.map((fd, i) =>
            <li
              key={fd}
              className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
              loop.phase === 'process' && i < loop.cursor ? 'bg-line/60 text-muted line-through' : 'bg-warn/15 text-warn'}`
              }>
              
                  fd {fd}
                </li>
            )}
            </ol>
          }
          <p className="mt-2 text-[11px] leading-snug text-muted">
            {loop.ready.length > 0 ? `${loop.ready.length} ready out of ${redisTotalClients.toLocaleString()}. Only these are touched.` : ''}
          </p>
        </div>
        <div className="min-w-0 border-t border-line px-4 py-3 md:border-t-0">
          <h4 className="text-xs font-semibold">Commands served, one at a time</h4>
          {loop.log.length === 0 ?
          <p className="mt-1.5 text-[12px] text-muted">Press Run loop or Step to start.</p> :

          <ol className="mt-1.5 space-y-0.5 font-mono text-[11px] leading-5">
              {loop.log.map((e, i) =>
            <li key={e.id} className={`grid grid-cols-[44px_minmax(0,1fr)_auto] gap-2 ${i === 0 ? 'text-ink' : 'text-muted'}`}>
                  <span>fd {e.fd}</span>
                  <span className="truncate">
                    {e.cmd} <span className="text-muted">→ {e.reply}</span>
                  </span>
                  <span className="text-right">{e.us.toFixed(1)} µs</span>
                </li>
            )}
            </ol>
          }
        </div>
      </div>

      <footer className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-line px-4 py-2.5 text-[12px] text-muted">
        <span>
          <span className="font-mono font-semibold text-ink">{loop.commands}</span> commands
        </span>
        <span>
          <span className="font-mono font-semibold text-ink">{avg ? avg.toFixed(1) : '—'}</span> µs average
        </span>
        <span className="ml-auto">
          {perSecond ?
          <>
              At this speed one core runs ≈ <span className="font-mono font-semibold text-ink">{perSecond.toLocaleString()}</span> commands/s
            </> :

          'Throughput appears after the first command'
          }
        </span>
      </footer>
    </section>);

}

function Legend({ cls, label }: {cls: string;label: string;}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm border ${cls}`} aria-hidden />
      {label}
    </span>);

}

function describePhase(loop: Loop): {title: string;detail: string;} {
  switch (loop.phase) {
    case 'wait':
      return {
        title: 'epoll_wait(epfd, events, 10000, timeout)',
        detail:
        loop.flushed.length > 0 ?
        `Replies to ${loop.flushed.length} clients were just written. Now the thread sleeps in the kernel, using no CPU, until any socket has data.` :
        'The thread sleeps in the kernel, using no CPU, until any of the 10,000 sockets has data.'
      };
    case 'ready':
      return {
        title: `epoll_wait() → ${loop.ready.length}`,
        detail: 'Packets arrived on a few sockets. Their callbacks put them on epoll’s ready list, and the thread wakes with exactly those fds.'
      };
    case 'process':{
        const e = loop.log[0];
        return {
          title: `fd ${loop.current}: ${e?.cmd ?? ''}`,
          detail: `read() the request, parse it, run it against memory and append “${e?.reply ?? ''}” to the client’s output buffer. Took ${e?.us.toFixed(1) ?? '?'} µs, then on to the next fd.`
        };
      }
    case 'write':
      return {
        title: `beforeSleep(): write() × ${loop.pending.length}`,
        detail: 'Before sleeping again, Redis flushes every queued reply with non-blocking writes. Then the loop starts over.'
      };
  }
}