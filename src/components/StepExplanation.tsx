import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Side } from '../types/socket';

interface ExplainableStep {
  id: string;
  actor: Side | 'kernel';
  call: string;
  title: string;
  summary: string;
  kernel: string;
}

const actorMeta = {
  client: { label: 'Client process', cls: 'text-client' },
  server: { label: 'Server process', cls: 'text-server' },
  kernel: { label: 'Kernel, with no app involved', cls: 'text-muted' }
};

interface StepExplanationProps {
  step: ExplainableStep;
  index: number;
  total: number;
  /** Overrides the default actor label (e.g. “Alice’s browser”) */
  actorLabel?: string;
}

export function StepExplanation({ step, index, total, actorLabel }: StepExplanationProps) {
  const actor = { ...actorMeta[step.actor], ...(actorLabel ? { label: actorLabel } : {}) };
  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={step.id}
        aria-live="polite"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-mono text-muted">
              {String(index + 1).padStart(2, '0')}/{total}
            </span>
            <span className={`font-medium ${actor.cls}`}>{actor.label}</span>
            <code className="rounded-md bg-surface px-2 py-0.5 font-mono text-[12px] text-ink ring-1 ring-line">{step.call}</code>
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-[28px]">{step.title}</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink/80">{step.summary}</p>
        </div>
        <aside className="border-l-2 border-ink/80 pl-4 lg:mt-7">
          <h3 className="text-xs font-semibold">Inside the kernel</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{step.kernel}</p>
        </aside>
      </motion.section>
    </AnimatePresence>);

}