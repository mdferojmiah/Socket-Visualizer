import React, { useRef } from 'react';
import { MachinePanel } from './MachinePanel';
import { NetworkLane } from './NetworkLane';
import { StepExplanation } from './StepExplanation';
import { StepTimeline } from './StepTimeline';
import { SyscallDebugger } from './debugger/SyscallDebugger';
import { useStepPlayer } from '../hooks/useStepPlayer';
import { useDebugSide } from '../hooks/useDebugSide';
import { tcpSteps } from '../data/socketSteps';
import { udpSteps } from '../data/udpSteps';
import { endpoints, listings, phases } from '../data/socketCode';
import { tcpCodeNotes } from '../data/tcpCodeNotes';
import { udpCodeNotes } from '../data/udpCodeNotes';
import { syscallIdOf } from '../utils/kernelSource';
import type { Packet, Protocol, Side, SocketStep } from '../types/socket';

const walkthroughs: Record<Protocol, SocketStep[]> = { tcp: tcpSteps, udp: udpSteps };

interface SocketWalkthroughProps {
  protocol: Protocol;
}

export function SocketWalkthrough({ protocol }: SocketWalkthroughProps) {
  const steps = walkthroughs[protocol];
  const player = useStepPlayer(steps.length);
  const index = Math.min(player.index, steps.length - 1);
  const step = steps[index];
  const listing = listings[protocol];
  const ep = endpoints[protocol];
  const debuggerRef = useRef<HTMLDivElement>(null);

  const history = steps.
  slice(0, index + 1).
  filter((s): s is SocketStep & {packet: Packet;} => Boolean(s.packet)).
  map((s) => ({ id: s.id, packet: s.packet }));

  const notes = protocol === 'tcp' ? tcpCodeNotes : udpCodeNotes;
  const noteFor = (side: Side) => {
    const line = step[side].line;
    return line !== null ? notes[side][line - 1] ?? null : null;
  };

  const nicFor = (side: Side) => step.packet ? step.packet.from === side ? 'tx' : 'rx' : null;
  const fileFor = (side: Side) => side === 'client' ? 'Client.cs' : 'Server.cs';
  const sourceLineFor = (side: Side) => {
    const line = step[side].line;
    return line !== null ? listing[side].anchors[line - 1] ?? line : null;
  };
  const userFrameFor = (side: Side) => {
    const line = sourceLineFor(side);
    return `Main() · ${fileFor(side)}${line !== null ? `:${line}` : ''}`;
  };

  const preferred: Side = step.actor === 'kernel' ? step.packet?.from ?? 'server' : step.actor;
  const [debugSide, setDebugSide] = useDebugSide(step.id, preferred, {
    client: Boolean(syscallIdOf(step.client.syscall)),
    server: Boolean(syscallIdOf(step.server.syscall))
  });

  const inspect = (side: Side) => {
    setDebugSide(side);
    debuggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const machine = (side: Side) =>
  <MachinePanel
    side={side}
    name={ep[side].name}
    ip={ep[side].ip}
    host={step[side]}
    code={listing[side]}
    fileName={fileFor(side)}
    stepId={step.id}
    nic={nicFor(side)}
    note={noteFor(side)}
    onInspect={() => inspect(side)} />;



  return (
    <div className="space-y-6">
      <StepTimeline
        steps={steps}
        phases={phases}
        index={index}
        playing={player.playing}
        onSelect={player.go}
        onPrev={player.prev}
        onNext={player.next}
        onToggle={player.toggle}
        onReset={player.reset} />
      

      <div className="min-h-[168px] border-y border-line py-6">
        <StepExplanation step={step} index={index} total={steps.length} />
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {machine('client')}
          {machine('server')}
        </div>
        <NetworkLane protocol={protocol} endpoints={ep} stepId={step.id} packet={step.packet} history={history} />
      </div>

      <div ref={debuggerRef} className="scroll-mt-6">
        <SyscallDebugger
          targets={{
            client: { syscall: step.client.syscall, userFrame: userFrameFor('client') },
            server: { syscall: step.server.syscall, userFrame: userFrameFor('server') }
          }}
          side={debugSide}
          onSideChange={setDebugSide}
          resetKey={step.id}
          protocol={protocol} />
        
      </div>
    </div>);

}