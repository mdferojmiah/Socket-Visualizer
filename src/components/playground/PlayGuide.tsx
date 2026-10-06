import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2Icon, LoaderIcon, MousePointerClickIcon, RotateCcwIcon, WandIcon } from 'lucide-react';
import { playGuide } from '../../data/playGuide';
import type { PlayAction, PlayState } from '../../types/playground';

interface PlayGuideProps {
  state: PlayState;
  busy: boolean;
  suggestion: PlayAction | null;
  suggestionIndex: number;
  tourIndex: number;
  tourTotal: number;
  onDoIt: (action: PlayAction) => void;
  onReset: () => void;
}

const defaultPayload = { client: 'hello', server: 'hi back' };

export function PlayGuide({ state, busy, suggestion, suggestionIndex, tourIndex, tourTotal, onDoIt, onReset }: PlayGuideProps) {
  const done = tourIndex >= tourTotal && !busy;
  const progress = Math.min(tourIndex, tourTotal) / tourTotal;
  const blocked = (['server', 'client'] as const).find((s) => state[s].blockedIn);

  let key = 'idle';
  let content: React.ReactNode;

  if (busy) {
    key = 'busy';
    content =
    <Body
      icon={<LoaderIcon className="h-4 w-4 animate-spin text-muted" aria-hidden />}
      title="Watch the kernel work"
      text="Packets are moving and the kernels are reacting. Keep an eye on the Network strip and the socket cards. Buttons unlock when it’s done." />;


  } else if (done) {
    key = 'done';
    content =
    <Body
      icon={<CheckCircle2Icon className="h-4 w-4 text-ok" aria-hidden />}
      title="You ran a full TCP connection"
      text="Now break things on purpose: reset and press connect() on the client before the server calls listen(). You’ll see the kernel reply with RST, which is what “connection refused” means."
      action={
      <button type="button" onClick={onReset} className={ghostBtn}>
            <RotateCcwIcon className="h-3.5 w-3.5" aria-hidden />
            Reset and experiment
          </button>
      } />;


  } else if (suggestion && suggestionIndex >= 0) {
    const guide = playGuide[suggestionIndex];
    const isClient = suggestion.side === 'client';
    key = `s-${suggestionIndex}`;
    content =
    <Body
      icon={<MousePointerClickIcon className={`h-4 w-4 ${isClient ? 'text-client' : 'text-server'}`} aria-hidden />}
      title={guide.goal}
      text={
      <>
            Press{' '}
            <code
          className={`rounded px-1.5 py-0.5 font-mono text-[12px] font-semibold text-white ${isClient ? 'bg-client' : 'bg-server'}`}>
          
              {suggestion.kind}()
            </code>{' '}
            on the <span className={`font-semibold ${isClient ? 'text-client' : 'text-server'}`}>{suggestion.side}</span>{' '}
            {isClient ? '(left)' : '(right)'}. {guide.why}
          </>
      }
      action={
      <button
        type="button"
        onClick={() =>
        onDoIt(suggestion.kind === 'send' ? { ...suggestion, payload: defaultPayload[suggestion.side] } : suggestion)
        }
        className={ghostBtn}>
        
            <WandIcon className="h-3.5 w-3.5" aria-hidden />
            Do it for me
          </button>
      } />;


  } else if (blocked) {
    const other = blocked === 'server' ? 'client' : 'server';
    key = `blocked-${blocked}`;
    content =
    <Body
      icon={<MousePointerClickIcon className="h-4 w-4 text-warn" aria-hidden />}
      title={`The ${blocked} is stuck in ${state[blocked].blockedIn}()`}
      text={`A blocked process can’t make any calls. Only something from the ${other} can wake it, so use the ${other}’s buttons.`} />;


  } else {
    key = 'free';
    content =
    <Body
      icon={<MousePointerClickIcon className="h-4 w-4 text-muted" aria-hidden />}
      title="You’re off the guided path"
      text="That’s fine. Any enabled button is a valid next call. Hover a disabled one to see why it’s not allowed, or reset to start the guided tour again."
      action={
      <button type="button" onClick={onReset} className={ghostBtn}>
            <RotateCcwIcon className="h-3.5 w-3.5" aria-hidden />
            Restart tour
          </button>
      } />;


  }

  return (
    <section aria-label="What to do now" className="overflow-hidden rounded-xl border border-ink/15 bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-kernel px-4 py-2">
        <h2 className="text-xs font-semibold">What to do now</h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted">
            {Math.min(tourIndex, tourTotal)}/{tourTotal} calls
          </span>
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line" aria-hidden>
            <motion.span
              className="block h-full rounded-full bg-ok"
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }} />
            
          </span>
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          aria-live="polite">
          
          {content}
        </motion.div>
      </AnimatePresence>
    </section>);

}

const ghostBtn =
'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors duration-150 hover:bg-kernel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30';

function Body({ icon, title, text, action }: {icon: React.ReactNode;title: string;text: React.ReactNode;action?: React.ReactNode;}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink/80">{text}</p>
      </div>
      {action}
    </div>);

}