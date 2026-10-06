import React from 'react';
import { BugIcon, CircleDotIcon, CornerUpLeftIcon, MoonIcon, PauseIcon, PlayIcon, RotateCcwIcon, StepForwardIcon } from 'lucide-react';
import { DebugSource } from './DebugSource';
import { DebugInspector } from './DebugInspector';
import { useSyscallDebugger } from '../../hooks/useSyscallDebugger';
import { kernelSources } from '../../data/kernelSources';
import { syscallIdOf } from '../../utils/kernelSource';
import type { Protocol, Side } from '../../types/socket';

export interface DebugTarget {
  syscall?: string;
  /** innermost user-space frame, e.g. "Main() · Server.cs:5" */
  userFrame: string;
}

interface SyscallDebuggerProps {
  /** One entry per process the debugger can attach to. */
  targets: Partial<Record<Side, DebugTarget>>;
  side: Side;
  onSideChange: (side: Side) => void;
  resetKey: string;
  protocol?: Protocol;
  /** Overrides the note shown above the kernel source. */
  sourceNote?: string;
}

const allSides: Side[] = ['client', 'server'];

export function SyscallDebugger({ targets, side, onSideChange, resetKey, protocol, sourceNote }: SyscallDebuggerProps) {
  const sides = allSides.filter((s) => targets[s]);
  const single = sides.length === 1;
  const id = syscallIdOf(targets[side]?.syscall);
  const source = id ? kernelSources[id] : null;
  const dbg = useSyscallDebugger(source, `${resetKey}-${side}-${id ?? 'none'}`);
  const sleeping = Boolean(dbg.point?.sleeps) && dbg.mode !== 'running';

  const btn =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors duration-150 hover:bg-kernel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface';

  return (
    <section aria-label="Kernel debugger" className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-3">
        <div className="mr-auto min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <BugIcon className="h-4 w-4 text-muted" aria-hidden />
            Kernel debugger
          </h2>
          <p className="text-xs text-muted">Step through the kernel code behind this call. Click the gutter to set breakpoints.</p>
        </div>

        {single ?
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 text-[12px] font-medium">
            <span className={`h-2 w-2 rounded-full ${side === 'client' ? 'bg-client' : 'bg-server'}`} aria-hidden />
            Attached to {side}
            <span className="font-mono text-[11px] text-muted">{id ? `${targets[side]?.syscall ?? ''}` : 'no call'}</span>
          </span> :

        <div role="tablist" aria-label="Attach debugger to" className="inline-flex rounded-lg border border-line bg-canvas p-0.5">
          {sides.map((s) => {
            const call = syscallIdOf(targets[s]?.syscall);
            const selected = s === side;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={!call}
                onClick={() => onSideChange(s)}
                className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:cursor-not-allowed disabled:opacity-45 ${
                selected ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'}`
                }>
                
                <span className={`h-2 w-2 rounded-full ${s === 'client' ? 'bg-client' : 'bg-server'}`} aria-hidden />
                <span className="capitalize">{s}</span>
                <span className="font-mono text-[11px] text-muted">{call ? `${call}()` : 'no call'}</span>
              </button>);

          })}
        </div>
        }

        <div className="flex items-center gap-1.5" role="group" aria-label="Debugger controls">
          {dbg.mode === 'running' ?
          <button type="button" onClick={dbg.pause} className={btn}>
              <PauseIcon className="h-3.5 w-3.5" aria-hidden />
              Pause
            </button> :

          <button type="button" onClick={dbg.resume} disabled={!source || dbg.mode === 'returned'} className={btn}>
              <PlayIcon className="h-3.5 w-3.5 text-ok" aria-hidden />
              Continue
            </button>
          }
          <button type="button" onClick={dbg.step} disabled={!source || dbg.mode === 'returned'} className={btn}>
            <StepForwardIcon className="h-3.5 w-3.5" aria-hidden />
            Step
          </button>
          <button type="button" onClick={dbg.restart} disabled={!source} className={btn} aria-label="Restart call">
            <RotateCcwIcon className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </header>

      {!source ?
      <p className="px-4 py-10 text-center text-[13px] text-muted">
          {single ?
        'The process isn’t inside a system call on this step. The kernel is acting on its own, handling packets and timers.' :
        'Neither process is inside a system call on this step. The kernel is acting on its own, handling packets and timers.'}
        </p> :

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 border-line lg:border-r">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-kernel px-4 py-2">
              <span className="font-mono text-[11px] text-ink">{source.file}</span>
              <span className="text-[11px] text-muted">
                {sourceNote ?? (
              protocol === 'udp' ? 'TCP path shown. UDP enters the same syscall, then branches to udp_*' : 'Simplified from Linux 6.x')}
              </span>
            </div>
            <StatusBar mode={dbg.mode} sleeping={sleeping} line={dbg.point?.line ?? null} label={source.label} returns={source.returns} />
            <DebugSource
            lines={source.lines}
            currentLine={dbg.point?.line ?? null}
            breakpoints={dbg.breakpoints}
            sleeping={sleeping}
            onToggleBreakpoint={dbg.toggleBreakpoint} />
          
          </div>
          <DebugInspector
          point={dbg.point}
          prevPoint={dbg.prevPoint}
          label={source.label}
          returns={source.returns}
          userFrame={targets[side]?.userFrame ?? ''} />
        
        </div>
      }
    </section>);

}

interface StatusBarProps {
  mode: ReturnType<typeof useSyscallDebugger>['mode'];
  sleeping: boolean;
  line: number | null;
  label: string;
  returns: string;
}

function StatusBar({ mode, sleeping, line, label, returns }: StatusBarProps) {
  let Icon = PauseIcon;
  let cls = 'text-muted';
  let text = `Paused · line ${line}`;
  if (mode === 'entry') text = `Paused on entry to ${label}. Press Continue to run to the next breakpoint`;
  if (mode === 'breakpoint') {
    Icon = CircleDotIcon;
    cls = 'text-down';
    text = `Breakpoint hit · line ${line}`;
  }
  if (mode === 'running') {
    Icon = PlayIcon;
    cls = 'text-ok';
    text = 'Running…';
  }
  if (mode === 'returned') {
    Icon = CornerUpLeftIcon;
    cls = 'text-ok';
    text = `Returned ${returns} to user space`;
  }
  if (sleeping) {
    Icon = MoonIcon;
    cls = 'text-warn';
    text = `Process asleep on line ${line}. It resumes when the kernel wakes it`;
  }
  return (
    <div className={`flex items-center gap-1.5 border-b border-line px-4 py-1.5 text-[12px] font-medium ${cls}`} aria-live="polite">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{text}</span>
    </div>);

}