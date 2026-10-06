import React, { useRef } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { MachinePanel } from '../MachinePanel';
import { NetworkLane } from '../NetworkLane';
import { SyscallDebugger } from '../debugger/SyscallDebugger';
import { PlayActions } from './PlayActions';
import { PlayNarration } from './PlayNarration';
import { PlayGuide } from './PlayGuide';
import { usePlayground } from '../../hooks/usePlayground';
import { useDebugSide } from '../../hooks/useDebugSide';
import { endpoints } from '../../data/socketCode';
import { playListing, playNote } from '../../utils/playgroundCode';
import { syscallIdOf } from '../../utils/kernelSource';
import type { HostSnapshot, Side } from '../../types/socket';

export function PlayZone() {
  const play = usePlayground();
  const ep = endpoints.tcp;
  const packet = play.frame?.packet;
  const stepId = play.frame?.id ?? 'start';
  const debuggerRef = useRef<HTMLDivElement>(null);

  const fileFor = (side: Side) => side === 'client' ? 'Client.cs' : 'Server.cs';
  const codeFor = (side: Side) => playListing(play.state[side].calls, side);
  const hostFor = (side: Side): HostSnapshot => {
    const h = play.state[side];
    const last = h.calls[h.calls.length - 1];
    return {
      status: h.calls.length === 0 ? 'idle' : h.status,
      note: h.note,
      line: last ? h.calls.length + 1 : null,
      syscall: h.syscall,
      sockets: h.sockets
    };
  };
  const userFrameFor = (side: Side) => {
    const host = hostFor(side);
    const line = host.line !== null ? codeFor(side).anchors[host.line - 1] ?? null : null;
    return `Main() · ${fileFor(side)}${line !== null ? `:${line}` : ''}`;
  };

  const latestActor = play.log[0]?.actor;
  const preferred: Side = latestActor === 'client' || latestActor === 'server' ? latestActor : packet?.from ?? 'server';
  const [debugSide, setDebugSide] = useDebugSide(stepId, preferred, {
    client: Boolean(syscallIdOf(play.state.client.syscall)),
    server: Boolean(syscallIdOf(play.state.server.syscall))
  });

  const inspect = (side: Side) => {
    setDebugSide(side);
    debuggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const panel = (side: Side) => {
    const h = play.state[side];
    const last = h.calls[h.calls.length - 1];
    return (
      <MachinePanel
        side={side}
        name={ep[side].name}
        ip={ep[side].ip}
        host={hostFor(side)}
        code={codeFor(side)}
        fileName={fileFor(side)}
        stepId={stepId}
        nic={packet ? packet.from === side ? 'tx' : 'rx' : null}
        note={last ? playNote(last, side) : null}
        onInspect={() => inspect(side)}
        actions={
        <PlayActions side={side} state={play.state} busy={play.busy} suggestion={play.suggestion} onAction={play.dispatch} />
        } />);


  };

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <PlayGuide
          state={play.state}
          busy={play.busy}
          suggestion={play.suggestion}
          suggestionIndex={play.suggestionIndex}
          tourIndex={play.tourIndex}
          tourTotal={play.tourTotal}
          onDoIt={play.dispatch}
          onReset={play.reset} />
        
        <button
          type="button"
          onClick={play.reset}
          className="inline-flex h-9 items-center gap-1.5 justify-self-start whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-kernel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30">
          
          <RotateCcwIcon className="h-4 w-4" aria-hidden />
          Reset machines
        </button>
      </div>

      <div className="min-h-[148px] border-y border-line py-5">
        <PlayNarration log={play.log} />
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {panel('client')}
          {panel('server')}
        </div>
        <NetworkLane protocol="tcp" endpoints={ep} stepId={stepId} packet={packet} history={play.history} />
      </div>

      <div ref={debuggerRef} className="scroll-mt-6">
        <SyscallDebugger
          targets={{
            client: { syscall: play.state.client.syscall, userFrame: userFrameFor('client') },
            server: { syscall: play.state.server.syscall, userFrame: userFrameFor('server') }
          }}
          side={debugSide}
          onSideChange={setDebugSide}
          resetKey={stepId}
          protocol="tcp" />
        
      </div>
    </div>);

}