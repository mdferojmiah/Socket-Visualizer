import React from 'react';
import type { Side } from '../types/socket';

interface CodeBlockProps {
  lines: string[];
  activeLine: number | null;
  side: Side;
}

const TOKEN = /(\/\/.*$|#.*$|b?"[^"]*"|b?'[^']*')/;

function renderLine(line: string) {
  return line.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('#') || part.startsWith('//')) return <span key={i} className="text-muted">{part}</span>;
    if (/^b?["']/.test(part)) return <span key={i} className="text-ok">{part}</span>;
    return <span key={i}>{part}</span>;
  });
}

export function CodeBlock({ lines, activeLine, side }: CodeBlockProps) {
  const activeBg = side === 'client' ? 'bg-client/10' : 'bg-server/10';
  const activeBar = side === 'client' ? 'bg-client' : 'bg-server';

  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-canvas py-1.5 font-mono text-[12px] leading-[22px]">
      <code>
        {lines.map((line, i) => {
          const n = i + 1;
          const active = n === activeLine;
          return (
            <div
              key={n}
              className={`relative flex pr-3 transition-colors duration-200 ${active ? activeBg : ''}`}
              aria-current={active ? 'step' : undefined}>
              
              {active && <span className={`absolute inset-y-0 left-0 w-[3px] ${activeBar}`} aria-hidden />}
              <span className={`w-9 shrink-0 select-none pr-3 text-right ${active ? 'text-ink' : 'text-muted/60'}`}>{n}</span>
              <span className={`whitespace-pre ${active ? 'font-medium text-ink' : 'text-ink/80'}`}>{renderLine(line)}</span>
            </div>);

        })}
      </code>
    </pre>);

}