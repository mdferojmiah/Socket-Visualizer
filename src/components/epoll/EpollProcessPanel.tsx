import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownIcon, CheckIcon, CircleIcon, CpuIcon, HourglassIcon } from 'lucide-react';
import { CodeBlock } from '../CodeBlock';
import { CodeExplainer } from '../CodeExplainer';
import type { CodeListing, CodeNote } from '../../types/socket';
import type { EpollStep } from '../../types/epoll';

interface EpollProcessPanelProps {
  step: EpollStep;
  code: CodeListing;
  fileName: string;
  note: CodeNote | null;
  /** Jump to the kernel debugger for the current system call */
  onInspect?: () => void;
}

const statusMeta = {
  idle: { label: 'Not started', cls: 'text-muted bg-line/60', Icon: CircleIcon },
  running: { label: 'Running', cls: 'text-ok bg-ok/10', Icon: CpuIcon },
  blocked: { label: 'Blocked', cls: 'text-warn bg-warn/10', Icon: HourglassIcon },
  done: { label: 'Finished', cls: 'text-muted bg-line/60', Icon: CheckIcon }
};

const SLOTS = 4;

export function EpollProcessPanel({ step, code, fileName, note, onInspect }: EpollProcessPanelProps) {
  const p = step.process;
  const activeLine = p.line !== null ? code.anchors[p.line - 1] ?? null : null;
  const status = statusMeta[p.status];

  const fds = [
  ...step.sockets.map((s) => ({ fd: s.fd, label: s.role === 'listener' ? 'listen' : 'conn', kind: 'socket' as const })),
  ...(step.epoll ? [{ fd: 4, label: 'epoll', kind: 'epoll' as const }] : [])].
  sort((a, b) => a.fd - b.fd);

  const returned = step.returned ?? [];

  return (
    <section aria-label="Server process" className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-server" aria-hidden />
          <h2 className="text-[15px] font-semibold">web-server</h2>
          <span className="font-mono text-xs text-muted">10.0.0.2 · pid 812</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>
          <status.Icon className="h-3.5 w-3.5" aria-hidden />
          {status.label}
        </span>
      </header>

      <div className="flex-1 px-4 pb-4 pt-3">
        <div className="mb-2 flex items-baseline gap-2">
          <h3 className="text-xs font-semibold">User space</h3>
          <span className="font-mono text-[11px] text-muted">{fileName}</span>
          {p.syscall && (
          onInspect ?
          <button
            type="button"
            onClick={onInspect}
            title="Step into this call in the kernel debugger"
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-server/30 bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-server transition-colors duration-150 hover:bg-kernel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30">
            
                <ArrowDownIcon className="h-3 w-3" aria-hidden />
                {p.syscall}
                <span className="ml-1 font-sans text-[10px] font-medium text-muted">step into</span>
              </button> :

          <span className="ml-auto font-mono text-[11px] font-semibold text-server">{p.syscall}</span>)
          }
        </div>
        <CodeBlock lines={code.lines} activeLine={activeLine} side="server" />
        <CodeExplainer note={note} line={activeLine} noteKey={`ep-${p.line}-${activeLine}`} accent="server" />

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold">fd table</h3>
            <span className="text-xs text-muted">{p.note}</span>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label="File descriptor table">
            {['stdin', 'stdout', 'stderr'].map((l, i) =>
            <li key={l} className="flex w-12 flex-col items-center gap-0.5">
                <span className="w-full rounded border border-line py-0.5 text-center font-mono text-[11px] text-muted/70">{i}</span>
                <span className="text-[10px] text-muted/70">{l}</span>
              </li>
            )}
            <AnimatePresence initial={false}>
              {fds.map((f) => {
                const hot = step.hot === f.fd;
                return (
                  <motion.li
                    key={f.fd}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    className="flex w-12 flex-col items-center gap-0.5">
                    
                    <span
                      className={`w-full rounded py-0.5 text-center font-mono text-[11px] font-semibold text-white ${
                      f.kind === 'epoll' ? 'bg-ink' : 'bg-server'} ${
                      hot ? 'ring-2 ring-warn ring-offset-1' : ''}`}>
                      
                      {f.fd}
                    </span>
                    <span className={`text-[10px] ${f.kind === 'epoll' ? 'font-medium text-ink' : 'text-muted'}`}>{f.label}</span>
                  </motion.li>);

              })}
            </AnimatePresence>
          </ul>
        </div>
      </div>

      <div className="border-t border-line px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-semibold">Events array</h3>
          <span className="font-mono text-[11px] text-muted">
            {step.sleeping ? 'epoll_wait() still sleeping' : step.returned ? `epoll_wait() → ${returned.length}` : 'not called yet'}
          </span>
        </div>
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Events returned by epoll_wait">
          {Array.from({ length: SLOTS }).map((_, i) => {
            const ev = step.sleeping ? undefined : returned[i];
            return ev ?
            <motion.li
              key={`${step.id}-${i}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="flex h-11 flex-col justify-center rounded-md border border-warn/40 bg-warn/10 px-2 font-mono">
              
                <span className="text-[11px] font-semibold text-warn">fd {ev.fd}</span>
                <span className="truncate text-[10px] text-ink/70">{ev.events}</span>
              </motion.li> :

            <li
              key={i}
              className="flex h-11 items-center justify-center rounded-md border border-dashed border-line font-mono text-[10px] text-muted/60">
              
                [{i}]
              </li>;

          })}
        </ol>
      </div>
    </section>);

}