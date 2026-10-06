import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TracePoint } from '../../types/kernel';

interface DebugInspectorProps {
  point: TracePoint | null;
  prevPoint: TracePoint | null;
  label: string;
  returns: string;
  userFrame: string;
}

function Frame({ top, children }: {top: boolean;children: React.ReactNode;}) {
  return (
    <li className={`flex min-w-0 ${top ? 'font-semibold text-ink' : 'text-muted'}`}>
      <span className="w-4 shrink-0 text-warn" aria-hidden>
        {top ? '▸' : ''}
      </span>
      <span className="truncate">{children}</span>
    </li>);

}

export function DebugInspector({ point, prevPoint, label, returns, userFrame }: DebugInspectorProps) {
  const prevLocals = new Map(prevPoint?.locals ?? []);
  const kernelFrames = point ? [...point.stack, 'entry_SYSCALL_64'] : [];
  const fnName = label.replace('()', '');
  const locals: [string, string][] = point ? point.locals : [['rax (return value)', returns]];

  return (
    <div className="flex min-w-0 flex-col divide-y divide-line">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={point ? `${point.line}-${point.note}` : 'returned'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="px-4 py-3"
          aria-live="polite">
          
          <h3 className="text-xs font-semibold">{point ? `Line ${point.line}` : 'Back in user space'}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink/85">
            {point ?
            point.note :
            `The kernel put ${returns} in rax and executed sysret. The CPU is back in user mode, and ${label} returns ${returns} to your program.`}
          </p>
        </motion.div>
      </AnimatePresence>

      <section className="px-4 py-3" aria-label="Call stack">
        <h3 className="mb-1.5 text-xs font-semibold">Call stack</h3>
        <ol className="font-mono text-[11px] leading-5">
          {kernelFrames.map((f, i) =>
          <Frame key={`${f}-${i}`} top={i === 0}>
              {f}
            </Frame>
          )}
          <li className="my-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted/70" aria-label="syscall boundary">
            <span className="h-px flex-1 border-t border-dashed border-line" />
            syscall boundary
            <span className="h-px flex-1 border-t border-dashed border-line" />
          </li>
          <Frame top={!point}>{fnName}() · libc</Frame>
          <Frame top={false}>{userFrame}</Frame>
        </ol>
      </section>

      <section className="px-4 py-3" aria-label="Variables">
        <h3 className="mb-1.5 text-xs font-semibold">Variables</h3>
        <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[11px] leading-5">
          {locals.map(([name, value]) => {
            const changed = prevPoint !== null && point !== null && prevLocals.get(name) !== value;
            return (
              <React.Fragment key={name}>
                <dt className="truncate text-muted">{name}</dt>
                <dd className={`break-all ${changed ? 'font-semibold text-warn' : 'text-ink'}`}>{value}</dd>
              </React.Fragment>);

          })}
        </dl>
        <p className="mt-2 text-[11px] text-muted">
          <span className="font-semibold text-warn">Amber</span> values changed on this step.
        </p>
      </section>
    </div>);

}