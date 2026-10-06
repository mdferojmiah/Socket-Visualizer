import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRightIcon } from 'lucide-react';
import { BufferBar } from './BufferBar';
import { StateBadge } from './StateBadge';
import type { Side, SocketView } from '../types/socket';

interface SocketCardProps {
  socket: SocketView;
  side: Side;
}

export function SocketCard({ socket, side }: SocketCardProps) {
  const isListener = socket.role === 'listener';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-lg border border-line bg-surface p-3">
      
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px]">
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
            socket.fd === null ? 'bg-line text-muted line-through' : side === 'client' ? 'bg-client text-white' : 'bg-server text-white'}`
            }>
            
            {socket.fd === null ? 'no fd' : `fd ${socket.fd}`}
          </span>
          <span className="font-medium">{roleLabel[socket.role]}</span>
        </div>
        <StateBadge state={socket.state} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted">
        <span>{socket.local}</span>
        {socket.remote &&
        <>
            <ArrowLeftRightIcon className="h-3 w-3" aria-hidden />
            <span>{socket.remote}</span>
          </>
        }
      </div>

      {isListener ?
      <div className="mt-3 space-y-2">
          <QueueRow label="SYN queue" hint="half-open" items={socket.synQueue ?? []} slots={socket.backlog ?? 5} side={side} />
          <QueueRow label="Accept queue" hint={`backlog ${socket.backlog ?? 5}`} items={socket.acceptQueue ?? []} slots={socket.backlog ?? 5} side={side} />
        </div> :
      socket.role === 'datagram' ?
      <div className="mt-3 space-y-2">
          <DatagramQueue items={socket.recvQueue ?? []} side={side} />
          <p className="text-[11px] leading-relaxed text-muted">No send buffer. sendto() hands each datagram straight to IP.</p>
        </div> :

      <div className="mt-3 space-y-2.5">
          <BufferBar label="Send buffer" value={socket.sendBuf ?? ''} accent={side} />
          <BufferBar label="Receive buffer" value={socket.recvBuf ?? ''} accent={side} />
        </div>
      }
    </motion.div>);

}

const roleLabel: Record<SocketView['role'], string> = {
  listener: 'Listening socket',
  connection: 'Connection socket',
  datagram: 'Datagram socket'
};

function DatagramQueue({ items, side }: {items: string[];side: Side;}) {
  const filled = side === 'client' ? 'border-client/30 bg-client/10 text-client' : 'border-server/30 bg-server/10 text-server';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="font-medium text-ink">Receive queue</span>
        <span className="font-mono text-muted">
          {items.length === 0 ? 'empty' : `${items.length} datagram${items.length > 1 ? 's' : ''}`}
        </span>
      </div>
      {items.length === 0 ?
      <div className="h-7 rounded border border-dashed border-line" /> :

      <div className="flex flex-wrap gap-1">
          {items.map((d, i) =>
        <motion.span
          key={`${d}-${i}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className={`inline-flex h-7 items-center gap-2 rounded border px-2 font-mono text-[11px] font-medium ${filled}`}>
          
              “{d}”<span className="text-muted">{d.length} B</span>
            </motion.span>
        )}
        </div>
      }
    </div>);

}

interface QueueRowProps {
  label: string;
  hint: string;
  items: string[];
  slots: number;
  side: Side;
}

function QueueRow({ label, hint, items, slots, side }: QueueRowProps) {
  const filled = side === 'client' ? 'border-client/30 bg-client/10 text-client' : 'border-server/30 bg-server/10 text-server';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-mono text-muted">{hint}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: slots }).map((_, i) =>
        items[i] ?
        <motion.span
          key={`${label}-${items[i]}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className={`min-w-0 flex-[3] truncate rounded border px-1.5 py-1 font-mono text-[10px] font-medium ${filled}`}
          title={items[i]}>
          
              {items[i]}
            </motion.span> :

        <span key={i} className="h-[22px] flex-1 rounded border border-dashed border-line" />

        )}
      </div>
    </div>);

}