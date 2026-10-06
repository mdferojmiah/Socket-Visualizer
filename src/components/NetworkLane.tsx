import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { Packet, Protocol, Side } from '../types/socket';

interface Endpoint {
  ip: string;
  port: number;
}

interface NetworkLaneProps {
  protocol: Protocol;
  endpoints: Record<Side, Endpoint>;
  stepId: string;
  packet?: Packet;
  history: {id: string;packet: Packet;}[];
}

const UDP_HEADER = 8;

/** Full-width network strip that sits under the two machines: client on the left, server on the right. */
export function NetworkLane({ protocol, endpoints, stepId, packet, history }: NetworkLaneProps) {
  const reduce = useReducedMotion();
  const fromClient = packet?.from === 'client';
  const src = packet ? endpoints[packet.from] : null;
  const dst = packet ? endpoints[packet.from === 'client' ? 'server' : 'client'] : null;
  const isTcp = protocol === 'tcp';
  const chips = (p: Packet) => p.flags ?? ['UDP'];

  return (
    <section
      aria-label="Network"
      className="grid min-w-0 rounded-xl border border-line bg-surface lg:grid-cols-[minmax(0,1fr)_250px_290px] lg:divide-x lg:divide-line">
      
      {/* Wire */}
      <div className="min-w-0 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Network</h2>
          <p className="text-xs text-muted">What’s on the wire right now</p>
        </div>
        <div className="mt-3 flex items-center justify-between font-mono text-[11px]">
          <span className="text-client">
            client · {endpoints.client.ip}
            {packet ? `:${endpoints.client.port}` : ''}
          </span>
          <span className="text-server">
            server · {endpoints.server.ip}:{endpoints.server.port}
          </span>
        </div>
        <div className="relative mt-1 h-20">
          <div className="absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden />
          <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-client" aria-hidden />
          <span className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-server" aria-hidden />
          <AnimatePresence>
            {packet &&
            <motion.div
              key={stepId}
              initial={
              reduce ?
              { left: '50%', x: '-50%', y: '-50%', opacity: 0 } :
              { left: fromClient ? '0%' : '100%', x: fromClient ? '0%' : '-100%', y: '-50%', opacity: 0 }
              }
              animate={
              reduce ?
              { left: '50%', x: '-50%', y: '-50%', opacity: 1 } :
              { left: fromClient ? '100%' : '0%', x: fromClient ? '-100%' : '0%', y: '-50%', opacity: [0, 1, 1, 1] }
              }
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: reduce ? 0.2 : 1.1, ease: [0.65, 0, 0.35, 1] }}
              className={`absolute top-1/2 flex items-center gap-2 rounded-lg border bg-surface px-2.5 py-1.5 ${
              fromClient ? 'border-client/40' : 'border-server/40'}`
              }>
              
                <span className="flex gap-1">
                  {chips(packet).map((f) =>
                <span
                  key={f}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white ${fromClient ? 'bg-client' : 'bg-server'}`}>
                  
                      {f}
                    </span>
                )}
                </span>
                {packet.payload && <span className="whitespace-nowrap font-mono text-[11px] text-ink">“{packet.payload}”</span>}
              </motion.div>
            }
          </AnimatePresence>
          {!packet &&
          <p className="absolute inset-x-0 top-1/2 mt-3 text-center text-[11px] text-muted">
              Wire is idle. This step happens inside one machine, between the app and its kernel.
            </p>
          }
        </div>
      </div>

      {/* Header anatomy */}
      <div className="border-t border-line px-4 py-3 lg:border-t-0">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-semibold">{isTcp ? 'TCP header' : 'UDP header'}</h3>
          <span className="font-mono text-[10px] text-muted">{isTcp ? '20+ bytes' : '8 bytes'}</span>
        </div>
        {packet && src && dst ?
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
            <dt className="text-muted">src</dt>
            <dd className="truncate">
              {src.ip}:{src.port}
            </dd>
            <dt className="text-muted">dst</dt>
            <dd className="truncate">
              {dst.ip}:{dst.port}
            </dd>
            {isTcp ?
          <>
                <dt className="text-muted">flags</dt>
                <dd className="font-semibold">{(packet.flags ?? []).join(' + ')}</dd>
                <dt className="text-muted">seq / ack</dt>
                <dd>
                  {packet.seq ?? '—'} / {packet.ack ?? '—'}
                </dd>
              </> :

          <>
                <dt className="text-muted">length</dt>
                <dd>{UDP_HEADER + (packet.payload?.length ?? 0)} bytes</dd>
              </>
          }
            <dt className="text-muted">data</dt>
            <dd>{packet.payload ? `${packet.payload.length} bytes` : '0 bytes'}</dd>
          </dl> :

        <p className="text-[11px] leading-relaxed text-muted">No packet this step.</p>
        }
      </div>

      {/* Sequence log */}
      <div className="border-t border-line px-4 py-3 lg:border-t-0">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-semibold">Packet history</h3>
          <span className="font-mono text-[10px] text-muted">{history.length} sent</span>
        </div>
        {history.length === 0 ?
        <p className="text-[11px] text-muted">No packets sent yet.</p> :

        <HistoryList history={history} stepId={stepId} isTcp={isTcp} chips={chips} />
        }
      </div>
    </section>);

}

interface HistoryListProps {
  history: {id: string;packet: Packet;}[];
  stepId: string;
  isTcp: boolean;
  chips: (p: Packet) => string[];
}

function HistoryList({ history, stepId, isTcp, chips }: HistoryListProps) {
  const ref = React.useRef<HTMLOListElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [history.length]);

  return (
    <ol ref={ref} className="relative max-h-[104px] space-y-0.5 overflow-y-auto border-x border-line px-1">
      {history.map(({ id, packet: p }) => {
        const current = id === stepId;
        const right = p.from === 'client';
        const color = right ? 'text-client' : 'text-server';
        return (
          <li key={id} className={`relative h-7 ${current ? 'opacity-100' : 'opacity-55'}`}>
            <span className={`absolute inset-x-1 bottom-1.5 h-px ${right ? 'bg-client' : 'bg-server'}`} aria-hidden />
            {right ?
            <ChevronRightIcon className={`absolute -right-1 bottom-0 h-3.5 w-3.5 ${color}`} aria-hidden /> :

            <ChevronLeftIcon className={`absolute -left-1 bottom-0 h-3.5 w-3.5 ${color}`} aria-hidden />
            }
            <span className={`absolute inset-x-0 top-0 text-center font-mono text-[10px] ${current ? 'font-semibold text-ink' : 'text-muted'}`}>
              {isTcp ?
              <>
                  {chips(p).join('+')}{' '}
                  <span className="text-muted">
                    seq {p.seq}
                    {p.ack !== undefined ? ` ack ${p.ack}` : ''}
                  </span>
                </> :

              <>
                  UDP <span className="text-muted">“{p.payload}”</span>
                </>
              }
            </span>
          </li>);

      })}
    </ol>);

}