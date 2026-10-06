export type SyscallId =
'socket' |
'bind' |
'listen' |
'accept' |
'connect' |
'send' |
'recv' |
'close' |
'epoll_create' |
'epoll_ctl' |
'epoll_wait';

/** One place the debugger can pause: a source line plus the machine state at that moment. */
export interface TracePoint {
  line: number;
  /** kernel frames only, innermost first */
  stack: string[];
  locals: [string, string][];
  note: string;
  /** the process goes to sleep on this line */
  sleeps?: boolean;
}

export interface KernelSource {
  id: SyscallId;
  label: string;
  file: string;
  lines: string[];
  /** default breakpoint lines */
  breakpoints: number[];
  trace: TracePoint[];
  /** value left in rax when the call returns to user space */
  returns: string;
}