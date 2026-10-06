import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRightIcon, CornerDownRightIcon } from 'lucide-react';
import { BufferBar } from '../BufferBar';
import { StateBadge } from '../StateBadge';
import type { EpollSocket } from '../../types/epoll';

interface EpollSocketCardProps {
  socket: EpollSocket;
  hot: boolean;
}

export function EpollSocketCard({ socket, hot }: EpollSocketCardProps) {
  const isListener = socket.role === 'listener';
  const queue = socket.acceptQueue ?? [];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      aria-label={`Socket fd ${socket.fd}`}
      className={`flex min-w-0 flex-col rounded-lg border bg-surface p-3 transition-colors duration-200 ${
      hot ? 'border-warn' : 'border-line'}`
      }>
      
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="rounded bg-server px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">fd {socket.fd}</span>
          <span className="font-medium">{isListener ? 'Listener' : 'Connection'}</span>
        </div>
        <StateBadge state={socket.state} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted">
        <span>{socket.local}</span>
        {socket.remote &&
        <>
            <ArrowLeftRightIcon className="h-3 w-3" aria-hidden />
            <span>{socket.remote}</span>
          </>
        }
      </div>

      <div className="mt-3">
        {isListener ?
        <div>
            <div className="mb-1 flex items-baseline justify-between text-[11px]">
              <span className="font-medium text-ink">Accept queue</span>
              <span className="font-mono text-muted">{queue.length === 0 ? 'empty' : `${queue.length} waiting`}</span>
            </div>
            {queue.length === 0 ?
          <div className="h-6 rounded-[3px] border border-dashed border-line" /> :

          <div className="flex gap-1">
                {queue.map((q) =>
            <motion.span
              key={q}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="flex h-6 min-w-0 items-center truncate rounded-[3px] border border-server/30 bg-server/10 px-1.5 font-mono text-[10px] font-medium text-server">
              
                    {q}
                  </motion.span>
            )}
              </div>
          }
          </div> :

        <BufferBar label="Receive buffer" value={socket.recvBuf ?? ''} accent="server" />
        }
      </div>

      <div className="mt-auto pt-3">
        <div className="mb-1 flex items-baseline justify-between text-[11px]">
          <span className="font-medium text-ink">Wait queue</span>
          <span className="font-mono text-muted">sk_wq</span>
        </div>
        {socket.hooked ?
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 font-mono text-[11px] transition-colors duration-200 ${
          hot ? 'border-warn bg-warn/10 text-warn' : 'border-line bg-canvas text-ink/80'}`
          }>
          
            <CornerDownRightIcon className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">
              ep_poll_callback <span className="text-muted">→</span> epitem {socket.fd}
            </span>
          </motion.div> :

        <div className="rounded-md border border-dashed border-line px-2 py-1.5 text-[11px] text-muted">Not watched by epoll</div>
        }
      </div>
    </motion.article>);

}