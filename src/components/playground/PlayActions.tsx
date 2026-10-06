import React, { useState } from 'react';
import { SendIcon } from 'lucide-react';
import { availability, clientActions, serverActions } from '../../utils/playgroundEngine';
import type { Side } from '../../types/socket';
import type { PlayAction, PlayKind, PlayState } from '../../types/playground';

interface PlayActionsProps {
  side: Side;
  state: PlayState;
  busy: boolean;
  suggestion: PlayAction | null;
  onAction: (action: PlayAction) => void;
}

const describe: Record<PlayKind, string> = {
  socket: 'Ask the kernel for a new TCP socket',
  bind: 'Claim 0.0.0.0:8080 for the listener',
  listen: 'Make the socket passive so the kernel accepts handshakes',
  accept: 'Take a finished connection off the accept queue (blocks if it’s empty)',
  connect: 'Run the three-way handshake to 10.0.0.2:8080',
  send: 'Copy the message into the send buffer',
  recv: 'Read from the receive buffer (blocks if it’s empty)',
  close: 'Release the fd and start the teardown'
};

export function PlayActions({ side, state, busy, suggestion, onAction }: PlayActionsProps) {
  const [message, setMessage] = useState(side === 'client' ? 'hello' : 'hi back');
  const [hint, setHint] = useState<string | null>(null);
  const kinds = (side === 'client' ? clientActions : serverActions).filter((k) => k !== 'send');
  const accentFill = side === 'client' ? 'bg-client border-client' : 'bg-server border-server';

  const check = (kind: PlayKind) => {
    if (busy) return { ok: false, reason: 'Wait for the kernel to finish the current step' };
    return availability(state, side, kind);
  };

  const fire = (kind: PlayKind) => {
    if (!check(kind).ok) return;
    if (kind === 'send') {
      const msg = message.trim();
      if (!msg) return;
      onAction({ side, kind, payload: msg });
    } else {
      onAction({ side, kind });
    }
  };

  const show = (kind: PlayKind) => {
    const a = check(kind);
    setHint(a.ok ? describe[kind] : a.reason ?? null);
  };

  const btnCls = (kind: PlayKind) => {
    const a = check(kind);
    const suggested = suggestion?.side === side && suggestion.kind === kind;
    return `inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2.5 font-mono text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
    !a.ok ?
    'cursor-not-allowed border-line text-muted/50' :
    suggested ?
    `${accentFill} text-white hover:opacity-90` :
    'border-line bg-surface text-ink hover:bg-kernel'}`;

  };

  const suggestedHere = suggestion?.side === side ? suggestion.kind : null;
  const sendCheck = check('send');

  return (
    <div onMouseLeave={() => setHint(null)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold">Your calls</h3>
        <span className="text-[11px] text-muted">
          {suggestedHere ?
          <>
              Suggested next: <code className="font-mono text-ink">{suggestedHere}()</code>
            </> :
          busy ?
          'Kernel working…' :

          ''
          }
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${side} system calls`}>
        {kinds.map((k) => {
          const a = check(k);
          return (
            <button
              key={k}
              type="button"
              aria-disabled={!a.ok}
              aria-describedby={`${side}-hint`}
              onClick={() => fire(k)}
              onMouseEnter={() => show(k)}
              onFocus={() => show(k)}
              onBlur={() => setHint(null)}
              className={btnCls(k)}>
              
              {k}()
            </button>);

        })}
      </div>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          fire('send');
        }}>
        
        <label htmlFor={`${side}-msg`} className="sr-only">
          Message to send from the {side}
        </label>
        <input
          id={`${side}-msg`}
          value={message}
          maxLength={12}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={() => show('send')}
          onBlur={() => setHint(null)}
          className="h-8 min-w-0 flex-1 rounded-md border border-line bg-canvas px-2.5 font-mono text-[12px] text-ink placeholder:text-muted focus:border-ink/40 focus:outline-none"
          placeholder="message" />
        
        <button
          type="submit"
          aria-disabled={!sendCheck.ok || !message.trim()}
          aria-describedby={`${side}-hint`}
          onMouseEnter={() => show('send')}
          onFocus={() => show('send')}
          onBlur={() => setHint(null)}
          className={btnCls('send')}>
          
          <SendIcon className="h-3 w-3" aria-hidden />
          send()
        </button>
      </form>
      <p id={`${side}-hint`} className="mt-2 min-h-[16px] text-[11px] leading-snug text-muted" aria-live="polite">
        {hint ?? ''}
      </p>
    </div>);

}