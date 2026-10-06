import React, { useRef } from 'react';
import { StepExplanation } from '../StepExplanation';
import { StepTimeline } from '../StepTimeline';
import { SyscallDebugger } from '../debugger/SyscallDebugger';
import { EpollProcessPanel } from './EpollProcessPanel';
import { EpollKernelPanel } from './EpollKernelPanel';
import { RedisCaseStudy } from './RedisCaseStudy';
import { useStepPlayer } from '../../hooks/useStepPlayer';
import { epollSteps } from '../../data/epollSteps';
import { epollListing, epollPhases } from '../../data/epollCode';
import { epollCodeNotes } from '../../data/epollCodeNotes';
import { syscallIdOf } from '../../utils/kernelSource';

const FILE = 'Server.cs';

export function EpollWalkthrough() {
  const player = useStepPlayer(epollSteps.length);
  const index = Math.min(player.index, epollSteps.length - 1);
  const step = epollSteps[index];
  const debuggerRef = useRef<HTMLDivElement>(null);

  const line = step.process.line;
  const sourceLine = line !== null ? epollListing.anchors[line - 1] ?? null : null;
  const userFrame = `Main() · ${FILE}${sourceLine !== null ? `:${sourceLine}` : ''}`;
  const canDebug = Boolean(syscallIdOf(step.process.syscall));

  const inspect = () => debuggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-6">
      <StepTimeline
        steps={epollSteps}
        phases={epollPhases}
        index={index}
        playing={player.playing}
        onSelect={player.go}
        onPrev={player.prev}
        onNext={player.next}
        onToggle={player.toggle}
        onReset={player.reset} />
      

      <div className="min-h-[168px] border-y border-line py-6">
        <StepExplanation step={step} index={index} total={epollSteps.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
        <EpollProcessPanel
          step={step}
          code={epollListing}
          fileName={FILE}
          note={line !== null ? epollCodeNotes[line - 1] ?? null : null}
          onInspect={canDebug ? inspect : undefined} />
        
        <EpollKernelPanel step={step} />
      </div>

      <div ref={debuggerRef} className="scroll-mt-6">
        <SyscallDebugger
          targets={{ server: { syscall: step.process.syscall, userFrame } }}
          side="server"
          onSideChange={() => undefined}
          resetKey={step.id}
          sourceNote="Simplified from Linux 6.x · example values" />
        
      </div>

      <RedisCaseStudy />
    </div>);

}