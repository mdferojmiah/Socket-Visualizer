import type { KernelSource, SyscallId, TracePoint } from '../types/kernel';

/** A source line, optionally tagged so trace points can refer to it by name instead of number. */
export type SrcLine = string | [string, string];

interface TraceSpec extends Omit<TracePoint, 'line'> {
  at: string;
}

interface SourceSpec {
  id: SyscallId;
  label: string;
  file: string;
  src: SrcLine[];
  breakpoints: string[];
  trace: TraceSpec[];
  returns: string;
}

export function defineSource(spec: SourceSpec): KernelSource {
  const tags: Record<string, number> = {};
  const lines = spec.src.map((l, i) => {
    if (typeof l === 'string') return l;
    tags[l[1]] = i + 1;
    return l[0];
  });
  const lineOf = (tag: string) => {
    const n = tags[tag];
    if (!n) throw new Error(`Unknown source tag "${tag}" in ${spec.id}`);
    return n;
  };
  return {
    id: spec.id,
    label: spec.label,
    file: spec.file,
    lines,
    returns: spec.returns,
    breakpoints: spec.breakpoints.map(lineOf),
    trace: spec.trace.map(({ at, ...rest }) => ({ ...rest, line: lineOf(at) }))
  };
}

const aliases: Record<string, SyscallId> = {
  socket: 'socket',
  bind: 'bind',
  listen: 'listen',
  accept: 'accept',
  connect: 'connect',
  send: 'send',
  sendto: 'send',
  recv: 'recv',
  recvfrom: 'recv',
  close: 'close',
  epoll_create: 'epoll_create',
  epoll_create1: 'epoll_create',
  epoll_ctl: 'epoll_ctl',
  epoll_wait: 'epoll_wait'
};

/** "recvfrom()" → "recv". Returns null for anything the debugger has no source for. */
export function syscallIdOf(name?: string): SyscallId | null {
  if (!name) return null;
  const key = name.replace(/\(.*$/, '').trim();
  return aliases[key] ?? null;
}