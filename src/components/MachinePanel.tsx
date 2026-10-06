import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownIcon, CpuIcon, HourglassIcon, CircleIcon, CheckIcon, NetworkIcon } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { SocketCard } from './SocketCard';
import { CodeExplainer } from './CodeExplainer';
import type { CodeListing, CodeNote, HostSnapshot, Side } from '../types/socket';

interface MachinePanelProps {
  side: Side;
  name: string;
  ip: string;
  host: HostSnapshot;
  code: CodeListing;
  fileName: string;
  stepId: string;
  nic: 'tx' | 'rx' | null;
  note?: CodeNote | null;
  /** optional controls rendered above the code (used by the play zone) */
  actions?: React.ReactNode;
  /** when set, the syscall chip becomes a button that opens the kernel debugger on this side */
  onInspect?: () => void;
}

const statusMeta = {
  idle: { label: 'Not started', cls: 'text-muted bg-line/60', Icon: CircleIcon },
  running: { label: 'Running', cls: 'text-ok bg-ok/10', Icon: CpuIcon },
  blocked: { label: 'Blocked', cls: 'text-warn bg-warn/10', Icon: HourglassIcon },
  done: { label: 'Finished', cls: 'text-muted bg-line/60', Icon: CheckIcon }
};

export function MachinePanel({ side, name, ip, host, code, fileName, stepId, nic, note, actions, onInspect }: MachinePanelProps) {
  const activeLine = host.line !== null ? code.anchors[host.line - 1] ?? null : null;
  const status = statusMeta[host.status];
  const accentText = side === 'client' ? 'text-client' : 'text-server';
  const accentBg = side === 'client' ? 'bg-client' : 'bg-server';

  return (
    <section aria-label={`${name} machine`} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${accentBg}`} aria-hidden />
          <h2 className="text-[15px] font-semibold">{name}</h2>
          <span className="font-mono text-xs text-muted">{ip}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>
          <status.Icon className="h-3.5 w-3.5" aria-hidden />
          {status.label}
        </span>
      </header>

      {actions && <div className="border-b border-line px-4 py-3">{actions}</div>}

      {/* User space */}
      <div className="px-4 pb-4 pt-3">
        <LayerLabel title="User space" sub={fileName} />
        <CodeBlock lines={code.lines} activeLine={activeLine} side={side} />
        <CodeExplainer note={note} line={activeLine} noteKey={`${side}-${host.line}-${activeLine}`} accent={side} />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1" aria-label="File descriptor table">
            <span className="mr-1 text-[11px] font-medium text-muted">fd table</span>
            {['stdin', 'stdout', 'stderr'].map((l, i) =>
            <span key={l} title={l} className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted/70">
                {i}
              </span>
            )}
            <AnimatePresence initial={false}>
              {host.sockets.
              filter((s) => s.fd !== null).
              map((s) =>
              <motion.span
                key={s.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                title={`${s.role} socket`}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white ${accentBg}`}>
                
                    {s.fd}
                  </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="text-xs text-muted">{host.note}</p>
        </div>
      </div>

      {/* Syscall boundary */}
      <div className="relative flex h-9 items-center px-4" aria-label="System call boundary">
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" aria-hidden />
        <span className="relative bg-surface pr-2 text-[10px] font-medium uppercase tracking-wider text-muted">syscall boundary</span>
        <AnimatePresence mode="wait">
          {host.syscall &&
          <motion.span
            key={`${stepId}-${host.syscall}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="relative ml-auto">
            
              {onInspect ?
            <button
              type="button"
              onClick={onInspect}
              title="Step into this call in the kernel debugger"
              className={`inline-flex items-center gap-1 rounded-md border bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors duration-150 hover:bg-kernel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${accentText} ${
              side === 'client' ? 'border-client/30' : 'border-server/30'}`
              }>
              
                  <ArrowDownIcon className="h-3 w-3" aria-hidden />
                  {host.syscall}
                  <span className="ml-1 font-sans text-[10px] font-medium text-muted">step into</span>
                </button> :

            <span
              className={`inline-flex items-center gap-1 rounded-md border bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold ${accentText} ${
              side === 'client' ? 'border-client/30' : 'border-server/30'}`
              }>
              
                  <ArrowDownIcon className="h-3 w-3" aria-hidden />
                  {host.syscall}
                </span>
            }
            </motion.span>
          }
        </AnimatePresence>
      </div>

      {/* Kernel */}
      <div className="flex-1 bg-kernel px-4 pb-4 pt-3">
        <LayerLabel title="Kernel" sub="TCP/IP stack" />
        {host.sockets.length === 0 ?
        <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
            No sockets allocated
          </div> :

        <div className="space-y-2.5">
            <AnimatePresence initial={false} mode="popLayout">
              {host.sockets.map((s) =>
            <SocketCard key={s.id} socket={s} side={side} />
            )}
            </AnimatePresence>
          </div>
        }
      </div>

      {/* NIC */}
      <div className="flex items-center justify-between border-t border-line bg-kernel px-4 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-muted">
          <NetworkIcon className="h-3.5 w-3.5" aria-hidden />
          NIC · eth0
        </span>
        <span className="font-mono text-[11px]">
          <span className={nic === 'tx' ? `font-semibold ${accentText}` : 'text-muted/50'}>TX</span>
          <span className="mx-1.5 text-muted/40">/</span>
          <span className={nic === 'rx' ? `font-semibold ${accentText}` : 'text-muted/50'}>RX</span>
        </span>
      </div>
    </section>);

}

function LayerLabel({ title, sub }: {title: string;sub: string;}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h3 className="text-xs font-semibold text-ink">{title}</h3>
      <span className="font-mono text-[11px] text-muted">{sub}</span>
    </div>);

}