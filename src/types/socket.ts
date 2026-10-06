export type Side = 'client' | 'server';

export type Protocol = 'tcp' | 'udp';

/** `anchors[k - 1]` is the source line for statement k (the `line` value used in step snapshots). */
export interface CodeListing {
  lines: string[];
  anchors: number[];
}

/** A line-by-line explanation of one code statement. */
export interface CodeNote {
  what: string;
  parts: {code: string;meaning: string;}[];
  returns?: string;
}

export type Phase = 'setup' | 'handshake' | 'transfer' | 'teardown';

export type TcpState =
'CLOSED' |
'LISTEN' |
'SYN_SENT' |
'SYN_RCVD' |
'ESTABLISHED' |
'FIN_WAIT_1' |
'FIN_WAIT_2' |
'CLOSE_WAIT' |
'LAST_ACK' |
'TIME_WAIT';

export type SocketState = TcpState | 'UNBOUND' | 'BOUND';

export type ProcessStatus = 'idle' | 'running' | 'blocked' | 'done';

export interface SocketView {
  id: string;
  fd: number | null;
  role: 'listener' | 'connection' | 'datagram';
  state: SocketState;
  local: string;
  remote?: string;
  sendBuf?: string;
  recvBuf?: string;
  synQueue?: string[];
  acceptQueue?: string[];
  backlog?: number;
  recvQueue?: string[];
}

export interface HostSnapshot {
  status: ProcessStatus;
  note: string;
  line: number | null;
  syscall?: string;
  sockets: SocketView[];
}

export interface Packet {
  from: Side;
  flags?: string[];
  seq?: number;
  ack?: number;
  payload?: string;
}

export interface SocketStep {
  id: string;
  phase: Phase;
  actor: Side | 'kernel';
  call: string;
  title: string;
  summary: string;
  kernel: string;
  client: HostSnapshot;
  server: HostSnapshot;
  packet?: Packet;
}