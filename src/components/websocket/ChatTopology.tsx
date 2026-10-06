import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChatLane } from './ChatLane';
import type { WsBrowser, WsChatMessage, WsConnState, WsStep } from '../../types/websocket';

interface ChatTopologyProps {
  step: WsStep;
  messages: WsChatMessage[];
}

const names: Record<WsBrowser, string> = { alice: 'Alice', bob: 'Bob' };
const fds: Record<WsBrowser, number> = { bob: 7, alice: 8 };

const connBadge: Record<WsConnState, {label: string;cls: string;}> = {
  none: { label: 'not connected', cls: 'text-muted ring-line' },
  tcp: { label: 'connecting', cls: 'text-warn ring-warn/30' },
  open: { label: 'online', cls: 'text-ok ring-ok/30' },
  closed: { label: 'tab closed', cls: 'text-muted ring-line' }
};

export function ChatTopology({ step, messages }: ChatTopologyProps) {
  return (
    <section aria-label="Chat participants and their connections" className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(104px,0.5fr)_minmax(0,1fr)_minmax(104px,0.5fr)_minmax(0,1fr)] lg:gap-0">
        <BrowserCard who="alice" step={step} messages={messages} />
        <ChatLane left="alice" right="server" state={step.conn.alice} flow={step.flow} stepId={step.id} />
        <ServerCard step={step} />
        <ChatLane left="server" right="bob" state={step.conn.bob} flow={step.flow} stepId={step.id} />
        <BrowserCard who="bob" step={step} messages={messages} />
      </div>
    </section>);

}

function BrowserCard({ who, step, messages }: {who: WsBrowser;step: WsStep;messages: WsChatMessage[];}) {
  const conn = step.conn[who];
  const badge = connBadge[conn];
  const active = step.actor === who;
  const visible = messages.slice(0, step.delivered[who]);

  return (
    <article
      aria-label={`${names[who]}'s app`}
      className={`flex min-h-[188px] flex-col rounded-lg border bg-canvas transition-colors duration-200 ${
      active ? 'border-client' : 'border-line'} ${
      conn === 'closed' ? 'opacity-60' : ''}`}>
      
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-client">{names[who]}</h3>
          <p className="font-mono text-[10px] text-muted">app · ChatClient.cs</p>
        </div>
        <span className={`shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium ring-1 ${badge.cls}`}>{badge.label}</span>
      </header>
      <ul className="flex flex-1 flex-col justify-end gap-1.5 px-3 py-3" aria-live="polite">
        {visible.length === 0 && <li className="text-center text-[12px] text-muted">No messages yet</li>}
        <AnimatePresence initial={false}>
          {visible.map((m, i) => {
            const mine = m.from === who;
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                
                {!mine && <span className="mb-0.5 text-[10px] text-muted">{names[m.from]}</span>}
                <span
                  className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug ${
                  mine ? 'rounded-br-md bg-client text-white' : 'rounded-bl-md bg-surface text-ink ring-1 ring-line'}`
                  }>
                  
                  {m.text}
                </span>
              </motion.li>);

          })}
        </AnimatePresence>
      </ul>
    </article>);

}

function ServerCard({ step }: {step: WsStep;}) {
  const active = step.actor === 'server';
  return (
    <article
      aria-label="Chat server"
      className={`flex min-h-[188px] flex-col rounded-lg border bg-kernel transition-colors duration-200 ${active ? 'border-server' : 'border-line'}`}>
      
      <header className="border-b border-line px-3 py-2">
        <h3 className="text-[14px] font-semibold text-server">chat.example</h3>
        <p className="font-mono text-[10px] text-muted">Server.cs · ASP.NET Core</p>
      </header>
      <div className="flex flex-1 flex-col justify-between gap-3 px-3 py-3">
        <div>
          <p className="font-mono text-[12px] text-muted">clients = {'{'}</p>
          <ul className="my-1 flex flex-wrap gap-1.5 pl-3">
            <AnimatePresence initial={false}>
              {step.serverClients.map((c) =>
              <motion.li
                key={c}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="rounded-md bg-surface px-2 py-1 font-mono text-[11px] text-ink ring-1 ring-line">
                
                  ws({names[c].toLowerCase()}) <span className="text-muted">fd {fds[c]}</span>
                </motion.li>
              )}
            </AnimatePresence>
          </ul>
          <p className="font-mono text-[12px] text-muted">{'}'}</p>
        </div>
        <p className="text-[11px] leading-snug text-muted">
          Each client is one TCP socket, so one fd. The server relays between them; Alice and Bob are never directly connected.
        </p>
      </div>
    </article>);

}