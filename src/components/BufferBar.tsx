import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface BufferBarProps {
  label: string;
  value: string;
  capacity?: number;
  accent: 'client' | 'server';
}

export function BufferBar({ label, value, capacity = 16, accent }: BufferBarProps) {
  const reduce = useReducedMotion();
  const chars = value.split('');
  const filled = accent === 'client' ? 'bg-client/10 text-client border-client/30' : 'bg-server/10 text-server border-server/30';

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-mono text-muted">{chars.length === 0 ? 'empty' : `${chars.length} bytes`}</span>
      </div>
      <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[2px]" aria-label={`${label}: ${value || 'empty'}`}>
        {Array.from({ length: capacity }).map((_, i) => {
          const ch = chars[i];
          return ch !== undefined ?
          <motion.span
            key={`${value}-${i}`}
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: reduce ? 0 : i * 0.025, ease: [0.23, 1, 0.32, 1] }}
            className={`flex h-6 items-center justify-center rounded-[3px] border font-mono text-[11px] font-medium ${filled}`}>
            
              {ch === ' ' ? '␣' : ch}
            </motion.span> :

          <span key={i} className="h-6 rounded-[3px] border border-dashed border-line bg-surface" />;

        })}
      </div>
    </div>);

}