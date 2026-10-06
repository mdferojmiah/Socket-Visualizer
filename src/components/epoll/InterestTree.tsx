import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface TreeNode {
  fd: number;
  x: number;
  depth: number;
  parent?: {x: number;depth: number;};
}

interface InterestTreeProps {
  fds: number[];
  hot?: number;
  ready: number[];
}

const ROW = 46;
const TOP = 22;

export function InterestTree({ fds, hot, ready }: InterestTreeProps) {
  const nodes = layout(fds);

  if (nodes.length === 0) {
    return (
      <div className="flex h-[118px] items-center justify-center rounded-md border border-dashed border-line px-3 text-center text-[11px] text-muted">
        Empty. No fds registered yet.
      </div>);

  }

  return (
    <div className="relative h-[118px]" role="tree" aria-label={`Interest tree holding fds ${fds.join(', ')}`}>
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {nodes.
        filter((n) => n.parent).
        map((n) =>
        <line
          key={`edge-${n.fd}`}
          x1={`${n.parent!.x}%`}
          y1={TOP + n.parent!.depth * ROW}
          x2={`${n.x}%`}
          y2={TOP + n.depth * ROW}
          className="stroke-line"
          strokeWidth={1.5} />

        )}
      </svg>
      <AnimatePresence initial={false}>
        {nodes.map((n) => {
          const isHot = hot === n.fd;
          const isReady = ready.includes(n.fd);
          return (
            <motion.div
              key={n.fd}
              role="treeitem"
              aria-label={`epitem for fd ${n.fd}${isReady ? ', on ready list' : ''}`}
              initial={{ opacity: 0, scale: 0.96, left: `${n.x}%`, top: TOP + n.depth * ROW }}
              animate={{ opacity: 1, scale: 1, left: `${n.x}%`, top: TOP + n.depth * ROW }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              style={{ x: '-50%', y: '-50%' }}
              className="absolute">
              
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border font-mono text-[12px] font-semibold transition-colors duration-200 ${
                isHot ?
                'border-warn bg-warn text-white' :
                isReady ?
                'border-warn/50 bg-warn/10 text-warn' :
                'border-line bg-surface text-ink'}`
                }>
                
                {n.fd}
              </span>
            </motion.div>);

        })}
      </AnimatePresence>
    </div>);

}

/** Balanced BST layout: x from in-order position, y from depth. */
function layout(fds: number[]): TreeNode[] {
  const sorted = [...fds].sort((a, b) => a - b);
  const out: TreeNode[] = [];
  const build = (lo: number, hi: number, depth: number, parent?: {x: number;depth: number;}) => {
    if (lo > hi) return;
    const mid = Math.floor((lo + hi + 1) / 2);
    const x = (mid + 1) / (sorted.length + 1) * 100;
    out.push({ fd: sorted[mid], x, depth, parent });
    build(lo, mid - 1, depth + 1, { x, depth });
    build(mid + 1, hi, depth + 1, { x, depth });
  };
  build(0, sorted.length - 1, 0);
  return out;
}