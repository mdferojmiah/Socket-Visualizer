import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownIcon, NetworkIcon } from 'lucide-react';
import { EventPollObject } from './EventPollObject';
import { EpollSocketCard } from './EpollSocketCard';
import { WakeupPath } from './WakeupPath';
import type { EpollStep } from '../../types/epoll';

export function EpollKernelPanel({ step }: {step: EpollStep;}) {
  return (
    <section aria-label="Kernel" className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-kernel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold">Kernel</h2>
          <span className="font-mono text-xs text-muted">epoll + TCP/IP stack</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-muted">
            <NetworkIcon className="h-3.5 w-3.5" aria-hidden />
            NIC · eth0
          </span>
          <AnimatePresence mode="wait">
            {step.packet ?
            <motion.span
              key={step.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="inline-flex items-center gap-1.5 rounded-md border border-warn/40 bg-warn/10 px-2 py-0.5 font-mono text-[11px]">
              
                <span className="font-semibold text-warn">RX</span>
                <span className="text-ink">{step.packet.label}</span>
                <span className="text-muted">from {step.packet.from}</span>
              </motion.span> :

            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="font-mono text-[11px] text-muted/60">
              
                idle
              </motion.span>
            }
          </AnimatePresence>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <EventPollObject step={step} />

        <div className="flex items-center gap-2 px-1 text-[11px] text-muted" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <ArrowDownIcon className="h-3 w-3" />
          <span>each epitem is hooked into its socket’s wait queue</span>
          <ArrowDownIcon className="h-3 w-3" />
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="grid gap-2.5 md:grid-cols-3">
          <AnimatePresence initial={false} mode="popLayout">
            {step.sockets.map((s) =>
            <EpollSocketCard key={s.fd} socket={s} hot={step.hot === s.fd} />
            )}
          </AnimatePresence>
        </div>

        <WakeupPath stepId={step.id} lit={step.path} fd={step.hot} />
      </div>
    </section>);

}