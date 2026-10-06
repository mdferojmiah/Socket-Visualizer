import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { WsConnState, WsFlow, WsPeer } from '../../types/websocket';

interface ChatLaneProps {
  left: WsPeer;
  right: WsPeer;
  state: WsConnState;
  flow?: WsFlow;
  stepId: string;
}

const peerName: Record<WsPeer, string> = { alice: 'Alice', server: 'Server', bob: 'Bob' };

const stateMeta: Record<WsConnState, {label: string;line: string;}> = {
  none: { label: 'no connection', line: 'border-t border-dashed border-line' },
  tcp: { label: 'TCP + TLS only', line: 'border-t border-muted/60' },
  open: { label: 'WebSocket open', line: 'border-t-2 border-ink' },
  closed: { label: 'closed', line: 'border-t border-dashed border-muted/50' }
};

/** The connection between a browser and the server, with the current frame travelling over it. */
export function ChatLane({ left, right, state, flow, stepId }: ChatLaneProps) {
  const reduce = useReducedMotion();
  const onLane = flow && (flow.from === left && flow.to === right || flow.from === right && flow.to === left);
  const toRight = onLane && flow.from === left;
  const chipColor = onLane && flow.from === 'server' ? 'bg-server' : 'bg-client';
  const meta = stateMeta[state];

  return (
    <>
      {/* Desktop: horizontal animated wire */}
      <div className="hidden min-w-0 flex-col justify-center lg:flex" aria-label={`${peerName[left]} to ${peerName[right]}: ${meta.label}`}>
        <div className="relative h-16">
          <div className={`absolute inset-x-0 top-1/2 h-0 ${meta.line}`} aria-hidden />
          <AnimatePresence>
            {onLane && flow &&
            <motion.span
              key={stepId}
              initial={
              reduce ?
              { left: '50%', x: '-50%', y: '-50%', opacity: 0 } :
              { left: toRight ? '0%' : '100%', x: toRight ? '0%' : '-100%', y: '-50%', opacity: 0 }
              }
              animate={
              reduce ?
              { left: '50%', x: '-50%', y: '-50%', opacity: 1 } :
              { left: toRight ? '100%' : '0%', x: toRight ? '-100%' : '0%', y: '-50%', opacity: [0, 1, 1, 1] }
              }
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: reduce ? 0.2 : 1.1, ease: [0.65, 0, 0.35, 1] }}
              className={`absolute top-1/2 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white ${chipColor}`}>
              
                {flow.label}
              </motion.span>
            }
          </AnimatePresence>
        </div>
        <p className="text-center text-[11px] leading-tight text-muted">{meta.label}</p>
      </div>

      {/* Mobile: compact status row */}
      <div className="flex flex-wrap items-center justify-center gap-2 py-1 text-[11px] text-muted lg:hidden">
        <span>{meta.label}</span>
        {onLane && flow &&
        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white ${chipColor}`}>
            {peerName[flow.from]} → {peerName[flow.to]} · {flow.label}
          </span>
        }
      </div>
    </>);

}