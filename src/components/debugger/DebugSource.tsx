import React, { useEffect, useRef } from 'react';
import { ArrowRightIcon } from 'lucide-react';

interface DebugSourceProps {
  lines: string[];
  currentLine: number | null;
  breakpoints: number[];
  sleeping: boolean;
  onToggleBreakpoint: (line: number) => void;
}

const TOKEN = /(\/\/.*$|"[^"]*"|\b(?:return|if|while|do|continue|break|goto|struct|static|int|long|void|unsigned|short|size_t)\b)/;

function renderLine(line: string) {
  return line.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('//')) return <span key={i} className="text-muted">{part}</span>;
    if (part.startsWith('"')) return <span key={i} className="text-ok">{part}</span>;
    if (TOKEN.test(part) && /^\w+$/.test(part)) return <span key={i} className="font-semibold text-ink">{part}</span>;
    return <span key={i}>{part}</span>;
  });
}

export function DebugSource({ lines, currentLine, breakpoints, sleeping, onToggleBreakpoint }: DebugSourceProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLDivElement>(null);

  // Keep the current line in view without scrolling the page.
  useEffect(() => {
    const box = scroller.current;
    const row = active.current;
    if (!box || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < box.scrollTop + 24) box.scrollTop = Math.max(0, top - 48);else
    if (bottom > box.scrollTop + box.clientHeight - 24) box.scrollTop = bottom - box.clientHeight + 48;
  }, [currentLine]);

  return (
    <div ref={scroller} className="relative max-h-[420px] overflow-auto bg-canvas py-2 font-mono text-[12px] leading-[22px]">
      <code className="block min-w-max">
        {lines.map((line, i) => {
          const n = i + 1;
          const isCurrent = n === currentLine;
          const hasBp = breakpoints.includes(n);
          const breakable = line.trim() !== '' && !line.trim().startsWith('//') && line.trim() !== '{' && line.trim() !== '}';
          return (
            <div
              key={n}
              ref={isCurrent ? active : undefined}
              aria-current={isCurrent ? 'step' : undefined}
              className={`group relative flex pr-4 ${isCurrent ? sleeping ? 'bg-warn/15' : 'bg-warn/10' : ''}`}>
              
              {breakable ?
              <button
                type="button"
                onClick={() => onToggleBreakpoint(n)}
                aria-pressed={hasBp}
                aria-label={`${hasBp ? 'Remove' : 'Add'} breakpoint on line ${n}`}
                className="flex w-6 shrink-0 items-center justify-center focus-visible:outline-none">
                
                  <span
                  className={`h-2.5 w-2.5 rounded-full transition-opacity duration-150 ${
                  hasBp ? 'bg-down opacity-100' : 'bg-down opacity-0 group-hover:opacity-30 group-focus-within:opacity-30'}`
                  } />
                
                </button> :

              <span className="w-6 shrink-0" aria-hidden />
              }
              <span className="flex w-5 shrink-0 items-center justify-center" aria-hidden>
                {isCurrent && <ArrowRightIcon className="h-3.5 w-3.5 text-warn" strokeWidth={3} />}
              </span>
              <span className={`w-8 shrink-0 select-none pr-3 text-right ${isCurrent ? 'text-ink' : 'text-muted/60'}`}>{n}</span>
              <span className={`whitespace-pre ${isCurrent ? 'font-medium text-ink' : 'text-ink/80'}`}>{renderLine(line)}</span>
            </div>);

        })}
      </code>
    </div>);

}