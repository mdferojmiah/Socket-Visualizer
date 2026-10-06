import React from 'react';
import { CodeBlock } from '../CodeBlock';
import { RedisLoopPanel } from './RedisLoopPanel';
import { useRedisLoop } from '../../hooks/useRedisLoop';
import { redisListing, redisReasons } from '../../data/redisLoop';
import type { RedisPhase } from '../../hooks/useRedisLoop';

const phaseLine: Record<RedisPhase, number> = {
  wait: redisListing.anchors[0],
  ready: redisListing.anchors[1],
  process: redisListing.anchors[2],
  write: redisListing.anchors[3]
};

export function RedisCaseStudy() {
  const loop = useRedisLoop();

  return (
    <section aria-labelledby="redis-heading" className="border-t border-line pt-8">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-server">epoll in the real world</p>
        <h2 id="redis-heading" className="mt-1 text-2xl font-semibold tracking-tight md:text-[28px]">
          How Redis serves huge numbers of clients with one thread
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
          Redis runs every command on a single thread, yet one instance handles tens of thousands of connections and hundreds
          of thousands of commands per second. Spread across a cluster and app-server connection pools, that serves millions of
          users. The trick is exactly what you just stepped through: register every socket with epoll once, then loop on{' '}
          <code className="font-mono text-ink">epoll_wait()</code> and only touch the sockets that are ready.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <RedisLoopPanel loop={loop} />

        <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <h3 className="text-[15px] font-semibold">The event loop</h3>
            <span className="font-mono text-[11px] text-muted">src/ae.c · src/ae_epoll.c (C, simplified)</span>
          </div>
          <div className="px-4 py-3">
            <CodeBlock lines={redisListing.lines} activeLine={phaseLine[loop.phase]} side="server" />
            <p className="mt-2 text-[12px] leading-snug text-muted">
              The highlighted line follows the simulation. At startup Redis calls{' '}
              <code className="font-mono text-ink">epoll_ctl(EPOLL_CTL_ADD)</code> for the listening socket, and again for each
              client it accepts, so the loop itself never re-registers anything.
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
        {redisReasons.map((r, i) =>
        <div key={r.title} className={`border-l-2 pl-4 ${i === redisReasons.length - 1 ? 'border-warn' : 'border-ink/80'}`}>
            <dt className="text-[14px] font-semibold">{r.title}</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-muted">{r.body}</dd>
          </div>
        )}
      </dl>
    </section>);

}