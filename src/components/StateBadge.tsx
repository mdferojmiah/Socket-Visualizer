import React from 'react';
import type { SocketState } from '../types/socket';

const tone: Record<SocketState, string> = {
  CLOSED: 'bg-line text-muted',
  UNBOUND: 'bg-line text-muted',
  BOUND: 'bg-ok/10 text-ok',
  LISTEN: 'bg-ok/10 text-ok',
  ESTABLISHED: 'bg-ok/10 text-ok',
  SYN_SENT: 'bg-warn/10 text-warn',
  SYN_RCVD: 'bg-warn/10 text-warn',
  FIN_WAIT_1: 'bg-down/10 text-down',
  FIN_WAIT_2: 'bg-down/10 text-down',
  CLOSE_WAIT: 'bg-down/10 text-down',
  LAST_ACK: 'bg-down/10 text-down',
  TIME_WAIT: 'bg-down/10 text-down'
};

export function StateBadge({ state }: {state: SocketState;}) {
  return (
    <span
      key={state}
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold tracking-tight ${tone[state]}`}>
      
      {state}
    </span>);

}