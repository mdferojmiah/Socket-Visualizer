import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRightIcon } from 'lucide-react';
import { wakeupHops } from '../../data/epollCode';

interface WakeupPathProps {
  stepId: string;
  lit: number;
  fd?: number;
}

export function WakeupPath({ stepId, lit, fd }: WakeupPathProps) {
  const reduce = useReducedMotion();
  const active = lit > 0;

  return (
    <section aria-label="Wakeup path" className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold">Wakeup path</h3>
        <span className="text-[11px] text-muted">
          {active ? `How the packet for fd ${fd} becomes an epoll event` : 'Idle. This lights up when a packet wakes a socket.'}
        </span>
      </div>
      <ol className="flex flex-wrap items-center gap-y-1.5">
        {wakeupHops.map((hop, i) => {
          const on = i < lit;
          const isCallback = hop === 'ep_poll_callback()';
          return (
            <li key={hop} className="flex items-center">
              {i > 0 && <ChevronRightIcon className={`mx-0.5 h-3.5 w-3.5 ${on ? 'text-warn' : 'text-line'}`} aria-hidden />}
              <motion.span
                key={`${stepId}-${hop}`}
                initial={on && !reduce ? { opacity: 0.35 } : false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, delay: on && !reduce ? i * 0.06 : 0, ease: [0.23, 1, 0.32, 1] }}
                className={`whitespace-nowrap rounded-md border px-2 py-1 font-mono text-[11px] ${
                on ?
                isCallback ?
                'border-warn bg-warn font-semibold text-white' :
                'border-warn/40 bg-warn/10 text-warn' :
                'border-line text-muted/70'}`
                }>
                
                {hop}
              </motion.span>
            </li>);

        })}
      </ol>
    </section>);

}