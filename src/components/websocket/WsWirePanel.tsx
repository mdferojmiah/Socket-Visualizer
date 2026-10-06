import React, { useEffect, useRef } from 'react';
import type { WsFlow, WsPeer, WsStep } from '../../types/websocket';

interface WsWirePanelProps {
  step: WsStep;
  history: {id: string;flow: WsFlow;}[];
}

const peerName: Record<WsPeer, string> = { alice: 'Alice', server: 'Server', bob: 'Bob' };

export function WsWirePanel({ step, history }: WsWirePanelProps) {
  const flow = step.flow;

  return (
    <section
      aria-label="On the wire"
      className="grid min-w-0 rounded-xl border border-line bg-surface lg:grid-cols-[minmax(0,1fr)_280px] lg:divide-x lg:divide-line">
      
      <div className="min-w-0 px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold">On the wire</h3>
          {flow &&
          <span className="font-mono text-[11px] text-muted">
              {peerName[flow.from]} → {peerName[flow.to]} · {flow.wireTitle}
            </span>
          }
        </div>

        {!flow &&
        <p className="mt-2 text-[13px] text-muted">
            Nothing new on the wire this step. The work happens inside one machine, on bytes already in a socket buffer.
          </p>
        }

        {flow?.raw &&
        <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[12px] leading-[20px] text-ink/85">
            {flow.raw.join('\n')}
          </pre>
        }

        {flow?.fields &&
        <dl className="mt-2 grid grid-cols-[88px_minmax(0,auto)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.5 text-[12px]">
            {flow.fields.map((f) =>
          <React.Fragment key={f.name}>
                <dt className="font-mono text-muted">{f.name}</dt>
                <dd className="break-all font-mono font-medium text-ink">{f.value}</dd>
                <dd className="text-muted">{f.note}</dd>
              </React.Fragment>
          )}
          </dl>
        }
      </div>

      <div className="border-t border-line px-4 py-3 lg:border-t-0">
        <div className="mb-2 flex items-baseline justify-between">
          <h4 className="text-xs font-semibold">Wire history</h4>
          <span className="font-mono text-[10px] text-muted">{history.length} sent</span>
        </div>
        {history.length === 0 ? <p className="text-[11px] text-muted">Nothing sent yet.</p> : <History history={history} current={step.id} />}
      </div>
    </section>);

}

function History({ history, current }: {history: {id: string;flow: WsFlow;}[];current: string;}) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [history.length]);

  return (
    <ol ref={ref} className="max-h-[168px] space-y-1 overflow-y-auto font-mono text-[11px]">
      {history.map(({ id, flow }) => {
        const isCurrent = id === current;
        return (
          <li key={id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 ${isCurrent ? 'text-ink' : 'text-muted'}`}>
            <span className="truncate">
              <span className={flow.from === 'server' ? 'text-server' : 'text-client'}>{peerName[flow.from]}</span> →{' '}
              {peerName[flow.to]}
            </span>
            <span className={isCurrent ? 'font-semibold' : ''}>{flow.label}</span>
          </li>);

      })}
    </ol>);

}