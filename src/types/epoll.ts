import type { ProcessStatus, SocketState } from './socket';

export type EpollPhase = 'setup' | 'connect' | 'data' | 'teardown';

export interface EpollSocket {
  fd: number;
  role: 'listener' | 'connection';
  state: SocketState;
  local: string;
  remote?: string;
  recvBuf?: string;
  acceptQueue?: string[];
  /** true once epoll_ctl(ADD) has planted ep_poll_callback on this socket's wait queue */
  hooked: boolean;
}

export interface EpollEvent {
  fd: number;
  events: string;
}

export interface EpollStep {
  id: string;
  phase: EpollPhase;
  actor: 'server' | 'kernel';
  call: string;
  title: string;
  summary: string;
  kernel: string;
  process: {
    status: ProcessStatus;
    note: string;
    line: number | null;
    syscall?: string;
  };
  /** whether the eventpoll object (fd 4) exists */
  epoll: boolean;
  /** fds registered in the interest tree (all with EPOLLIN) */
  interest: number[];
  /** fds currently linked on rdllist */
  ready: number[];
  /** process asleep on ep->wq */
  sleeping: boolean;
  sockets: EpollSocket[];
  /** events copied to the user-space array by the last epoll_wait */
  returned?: EpollEvent[];
  /** fd being touched this step, highlighted across the diagram */
  hot?: number;
  /** number of hops lit in the wakeup path (0 = idle) */
  path: number;
  packet?: {label: string;from: string;};
}