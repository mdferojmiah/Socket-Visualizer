import React from 'react';
import { StepTimeline } from '../StepTimeline';
import { StepExplanation } from '../StepExplanation';
import { CodeBlock } from '../CodeBlock';
import { ChatTopology } from './ChatTopology';
import { WsLayerStack } from './WsLayerStack';
import { WsWirePanel } from './WsWirePanel';
import { GameCaseStudy } from './GameCaseStudy';
import { useStepPlayer } from '../../hooks/useStepPlayer';
import { wsChatSteps } from '../../data/wsChatSteps';
import { wsChatMessages, wsClientCode, wsOverviewPoints, wsPhases, wsServerCode } from '../../data/wsChatCode';
import type { WsFlow, WsPeer, WsStep } from '../../types/websocket';

const actorLabels: Record<WsPeer, string> = {
  alice: 'Alice’s app',
  bob: 'Bob’s app',
  server: 'Chat server'
};

export function WebSocketWalkthrough() {
  const player = useStepPlayer(wsChatSteps.length);
  const index = Math.min(player.index, wsChatSteps.length - 1);
  const step = wsChatSteps[index];

  const history = wsChatSteps.
  slice(0, index + 1).
  filter((s): s is WsStep & {flow: WsFlow;} => Boolean(s.flow)).
  map((s) => ({ id: s.id, flow: s.flow }));

  const explainStep = { ...step, actor: step.actor === 'server' ? 'server' as const : 'client' as const };

  return (
    <div className="space-y-10">
      <section aria-label="WebSocket overview">
        <dl className="grid gap-x-8 gap-y-5 md:grid-cols-3">
          {wsOverviewPoints.map((p) =>
          <div key={p.title} className="border-l-2 border-ink/80 pl-4">
              <dt className="text-[14px] font-semibold">{p.title}</dt>
              <dd className="mt-1 text-[13px] leading-relaxed text-muted">{p.body}</dd>
            </div>
          )}
        </dl>
      </section>

      <div className="space-y-6">
        <div>
          <h2 className="text-[13px] font-medium text-client">Walkthrough</h2>
          <p className="mt-0.5 text-[15px] text-ink/80">Alice and Bob chat through one server. Step through every byte.</p>
        </div>

        <StepTimeline
          steps={wsChatSteps}
          phases={wsPhases}
          index={index}
          playing={player.playing}
          onSelect={player.go}
          onPrev={player.prev}
          onNext={player.next}
          onToggle={player.toggle}
          onReset={player.reset} />
        

        <div className="min-h-[168px] border-y border-line py-6">
          <StepExplanation step={explainStep} index={index} total={wsChatSteps.length} actorLabel={actorLabels[step.actor]} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 space-y-4">
            <ChatTopology step={step} messages={wsChatMessages} />
            <WsWirePanel step={step} history={history} />
          </div>
          <WsLayerStack active={step.layers} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CodePanel
            title="ChatClient.cs"
            meta="C# · ClientWebSocket"
            running={step.clientWho ? `running in ${step.clientWho === 'alice' ? 'Alice' : 'Bob'}’s app` : 'awaiting ReceiveAsync()'}
            tone="client">
            
            <CodeBlock lines={wsClientCode} activeLine={step.clientLine} side="client" />
          </CodePanel>
          <CodePanel title="Server.cs" meta="C# · ASP.NET Core" running={step.serverLine ? 'Kestrel' : 'idle'} tone="server">
            <CodeBlock lines={wsServerCode} activeLine={step.serverLine} side="server" />
          </CodePanel>
        </div>
      </div>

      <GameCaseStudy />
    </div>);

}

interface CodePanelProps {
  title: string;
  meta: string;
  running: string;
  tone: 'client' | 'server';
  children: React.ReactNode;
}

function CodePanel({ title, meta, running, tone, children }: CodePanelProps) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className={`font-mono text-[14px] font-semibold ${tone === 'client' ? 'text-client' : 'text-server'}`}>{title}</h3>
          <span className="text-[12px] text-muted">{meta}</span>
        </div>
        <span className="text-[11px] text-muted">{running}</span>
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>);

}