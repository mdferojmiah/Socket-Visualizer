import React from 'react';
import { wsLayers } from '../../data/wsChatCode';
import type { WsLayer } from '../../types/websocket';

export function WsLayerStack({ active }: {active: WsLayer[];}) {
  return (
    <section aria-label="Protocol layers" className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold">Layers in use</h3>
        <span className="text-[11px] text-muted">this step</span>
      </div>
      <ol className="mt-3 flex flex-1 flex-col gap-1">
        {wsLayers.map((l) => {
          const on = active.includes(l.id);
          return (
            <li
              key={l.id}
              aria-current={on ? 'true' : undefined}
              className={`rounded-md border px-2.5 py-1.5 transition-colors duration-200 ${
              on ? 'border-ink/70 bg-surface' : 'border-dashed border-line bg-transparent'} ${
              l.id === 'tcp' && on ? 'bg-kernel' : ''}`}>
              
              <div className={`text-[13px] font-semibold ${on ? 'text-ink' : 'text-muted/70'}`}>{l.name}</div>
              <div className={`text-[11px] leading-snug ${on ? 'text-muted' : 'text-muted/60'}`}>{l.detail}</div>
            </li>);

        })}
      </ol>
      <p className="mt-3 text-[11px] leading-snug text-muted">
        WebSocket never replaces the TCP socket. It’s a set of rules for the bytes you send through it.
      </p>
    </section>);

}