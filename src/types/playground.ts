import type { Packet, ProcessStatus, Side, SocketView } from './socket';

export type PlayKind = 'socket' | 'bind' | 'listen' | 'accept' | 'connect' | 'send' | 'recv' | 'close';

export interface PlayCall {
  kind: PlayKind;
  payload?: string;
}

export interface PlayHost {
  status: ProcessStatus;
  blockedIn: 'accept' | 'recv' | 'connect' | null;
  note: string;
  syscall?: string;
  sockets: SocketView[];
  /** every call the user has made on this side, in order; drives the generated program */
  calls: PlayCall[];
}

export interface PlayState {
  client: PlayHost;
  server: PlayHost;
  /** next sequence number each side will send */
  seq: Record<Side, number>;
}

export interface PlayLogEntry {
  id: string;
  actor: Side | 'kernel';
  title: string;
  detail: string;
}

export interface PlayFrame {
  id: string;
  state: PlayState;
  packet?: Packet;
  log: PlayLogEntry;
}

export interface PlayAction {
  side: Side;
  kind: PlayKind;
  payload?: string;
}

export interface Availability {
  ok: boolean;
  reason?: string;
}