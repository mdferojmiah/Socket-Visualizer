import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PlayLogEntry } from '../../types/playground';

const actorMeta = {
  client: { label: 'Client process', text: 'text-client', dot: 'bg-client' },
  server: { label: 'Server process', text: 'text-server', dot: 'bg-server' },
  kernel: { label: 'Kernel, with no app involved', text: 'text-muted', dot: 'bg-muted' }
};

export function PlayNarration({ log }: {log: PlayLogEntry[];}) {
  const latest = log[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <AnimatePresence mode="wait">
        {latest ?
        <motion.section
          key={latest.id}
          aria-live="polite"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}>
          
            <span className={`text-sm font-medium ${actorMeta[latest.actor].text}`}>{actorMeta[latest.actor].label}</span>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-[28px]">{latest.title}</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink/80">{latest.detail}</p>
          </motion.section> :

        <motion.section key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="text-2xl font-semibold tracking-tight md:text-[28px]">Two machines, no sockets yet</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink/80">
              You’re both programs. Start on the server: call <code className="font-mono text-ink">socket()</code>, then{' '}
              <code className="font-mono text-ink">bind()</code>, <code className="font-mono text-ink">listen()</code> and{' '}
              <code className="font-mono text-ink">accept()</code>. Or connect from the client first and see what happens.
            </p>
          </motion.section>
        }
      </AnimatePresence>

      <aside className="min-w-0 border-l-2 border-ink/80 pl-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-semibold">Event log</h3>
          <span className="font-mono text-[11px] text-muted">{log.length} events</span>
        </div>
        {log.length === 0 ?
        <p className="mt-1 text-[13px] text-muted">Every call, packet and wakeup will be listed here.</p> :

        <ol className="mt-1.5 max-h-[148px] space-y-1 overflow-y-auto pr-1">
            {log.map((e, i) =>
          <li key={e.id} className={`flex items-start gap-2 text-[13px] leading-snug ${i === 0 ? 'text-ink' : 'text-muted'}`}>
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${actorMeta[e.actor].dot}`} aria-hidden />
                <span className="sr-only">{actorMeta[e.actor].label}: </span>
                {e.title}
              </li>
          )}
          </ol>
        }
      </aside>
    </div>);

}