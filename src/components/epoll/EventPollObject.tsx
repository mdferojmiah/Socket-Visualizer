import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownIcon, HourglassIcon } from 'lucide-react';
import { InterestTree } from './InterestTree';
import type { EpollStep } from '../../types/epoll';

const ease = [0.23, 1, 0.32, 1] as const;

export function EventPollObject({ step }: {step: EpollStep;}) {
  if (!step.epoll) {
    return (
      <section
        aria-label="eventpoll object"
        className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-xs text-muted">
        
        No epoll instance yet. <code className="font-mono text-ink">epoll_create1()</code> will allocate one here.
      </section>);

  }

  return (
    <motion.section
      aria-label="eventpoll object"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease }}
      className="rounded-lg border border-ink/20 bg-surface">
      
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-3 py-2">
        <h3 className="font-mono text-[13px] font-semibold">struct eventpoll</h3>
        <span className="font-mono text-[11px] text-muted">
          behind <span className="rounded bg-ink px-1 py-px font-semibold text-white">fd 4</span> · anon inode [eventpoll]
        </span>
      </header>

      <div className="grid divide-y divide-line md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] md:divide-x md:divide-y-0">
        <Part title="Interest list" sub="rbr · red-black tree" caption="One epitem per watched fd. Lookups are O(log n).">
          <InterestTree fds={step.interest} hot={step.hot} ready={step.ready} />
        </Part>

        <Part title="Ready list" sub="rdllist" caption="Filled by callbacks and drained by epoll_wait.">
          <div className="flex min-h-[118px] flex-col gap-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {step.ready.length === 0 ?
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-1 items-center justify-center rounded-md border border-dashed border-line text-[11px] text-muted">
                
                  Empty
                </motion.div> :

              step.ready.map((fd, i) =>
              <motion.div
                key={fd}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.22, ease }}
                className="flex flex-col items-stretch gap-1.5">
                
                    {i > 0 && <ArrowDownIcon className="mx-auto h-3 w-3 text-muted" aria-hidden />}
                    <div className="flex items-center justify-between rounded-md border border-warn/40 bg-warn/10 px-2.5 py-1.5 font-mono text-[11px]">
                      <span className="font-semibold text-warn">epitem fd {fd}</span>
                      <span className="text-ink/70">EPOLLIN</span>
                    </div>
                  </motion.div>
              )
              }
            </AnimatePresence>
          </div>
        </Part>

        <Part title="Wait queue" sub="wq" caption="Threads asleep in epoll_wait, not on any socket.">
          <div className="flex min-h-[118px] flex-col">
            <AnimatePresence initial={false} mode="wait">
              {step.sleeping ?
              <motion.div
                key="sleeping"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease }}
                className="flex items-center gap-2 rounded-md border border-server/30 bg-server/10 px-2.5 py-2 text-[11px]">
                
                  <HourglassIcon className="h-3.5 w-3.5 shrink-0 text-server" aria-hidden />
                  <span>
                    <span className="font-mono font-semibold text-server">pid 812</span>
                    <span className="block text-muted">asleep in epoll_wait()</span>
                  </span>
                </motion.div> :

              <motion.div
                key="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-1 items-center justify-center rounded-md border border-dashed border-line px-2 text-center text-[11px] text-muted">
                
                  No one waiting
                </motion.div>
              }
            </AnimatePresence>
          </div>
        </Part>
      </div>
    </motion.section>);

}

function Part({ title, sub, caption, children }: {title: string;sub: string;caption: string;children: React.ReactNode;}) {
  return (
    <div className="flex min-w-0 flex-col p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold">{title}</h4>
        <span className="truncate font-mono text-[10px] text-muted">{sub}</span>
      </div>
      <div className="flex-1">{children}</div>
      <p className="mt-2 text-[11px] leading-snug text-muted">{caption}</p>
    </div>);

}