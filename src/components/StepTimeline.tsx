import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react';

interface TimelineStep {
  id: string;
  phase: string;
  title: string;
}

interface StepTimelineProps {
  steps: TimelineStep[];
  phases: readonly {id: string;label: string;}[];
  index: number;
  playing: boolean;
  onSelect: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onReset: () => void;
}

export function StepTimeline({ steps, phases, index, playing, onSelect, onPrev, onNext, onToggle, onReset }: StepTimelineProps) {
  const btn =
  'inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface text-ink transition-colors duration-150 hover:bg-kernel disabled:opacity-40 disabled:hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30';

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
      <nav aria-label="Walkthrough steps" className="flex flex-1 gap-3">
        {phases.map((phase) => {
          const items = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.phase === phase.id);
          if (items.length === 0) return null;
          const activePhase = steps[index].phase === phase.id;
          return (
            <div key={phase.id} style={{ flexGrow: items.length }} className="min-w-0 basis-0">
              <div className={`mb-1.5 truncate text-xs font-medium ${activePhase ? 'text-ink' : 'text-muted'}`}>{phase.label}</div>
              <div className="flex gap-1">
                {items.map(({ s, i }) =>
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(i)}
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  aria-current={i === index ? 'step' : undefined}
                  title={s.title}
                  className="group flex h-6 flex-1 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30">
                  
                    <span
                    className={`h-1.5 w-full rounded-full transition-colors duration-200 ${
                    i === index ? 'bg-ink' : i < index ? 'bg-ink/35 group-hover:bg-ink/50' : 'bg-line group-hover:bg-ink/20'}`
                    } />
                  
                  </button>
                )}
              </div>
            </div>);

        })}
      </nav>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onReset} className={`${btn} w-9`} aria-label="Restart">
          <RotateCcwIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={onPrev} disabled={index === 0} className={`${btn} w-9`} aria-label="Previous step">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-9 w-24 items-center justify-center gap-1.5 rounded-lg bg-ink text-sm font-medium text-surface transition-colors duration-150 hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2">
          
          {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={onNext} disabled={index === steps.length - 1} className={`${btn} w-9`} aria-label="Next step">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>);

}