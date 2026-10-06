import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CodeNote } from '../types/socket';

interface CodeExplainerProps {
  note: CodeNote | null | undefined;
  /** 1-based source line the note explains */
  line: number | null;
  /** stable key so the note animates when the statement changes */
  noteKey: string;
  accent: 'client' | 'server';
}

export function CodeExplainer({ note, line, noteKey, accent }: CodeExplainerProps) {
  const bar = accent === 'client' ? 'border-client' : 'border-server';
  return (
    <AnimatePresence mode="wait" initial={false}>
      {note && line !== null ?
      <motion.div
        key={noteKey}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        className={`mt-3 border-l-2 ${bar} pl-3`}
        aria-live="polite">
        
          <h4 className="text-xs font-semibold">
            Line {line}, explained
          </h4>
          <p className="mt-1 text-[13px] leading-relaxed text-ink/85">{note.what}</p>
          {note.parts.length > 0 &&
        <dl className="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12px] leading-snug">
              {note.parts.map((p) =>
          <React.Fragment key={p.code}>
                  <dt className="max-w-[180px]">
                    <code className="inline-block break-all rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink ring-1 ring-line">
                      {p.code}
                    </code>
                  </dt>
                  <dd className="text-muted">{p.meaning}</dd>
                </React.Fragment>
          )}
            </dl>
        }
          {note.returns &&
        <p className="mt-2 text-[12px] leading-snug text-muted">
              <span className="font-semibold text-ink">Returns </span>
              {note.returns}
            </p>
        }
        </motion.div> :

      <motion.p
        key="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="mt-3 text-[12px] text-muted">
        
          No line is running on this side right now.
        </motion.p>
      }
    </AnimatePresence>);

}