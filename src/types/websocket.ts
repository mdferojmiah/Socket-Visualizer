export type WsPeer = 'alice' | 'server' | 'bob';

export type WsBrowser = 'alice' | 'bob';

export type WsPhase = 'connect' | 'upgrade' | 'message' | 'keepalive' | 'close';

export type WsLayer = 'app' | 'ws' | 'http' | 'tls' | 'tcp' | 'ip';

export type WsConnState = 'none' | 'tcp' | 'open' | 'closed';

export type WsFlowKind = 'tcp' | 'http' | 'frame' | 'control';

export interface WsWireField {
  name: string;
  value: string;
  note: string;
}

/** Something travelling over one connection during a step. */
export interface WsFlow {
  from: WsPeer;
  to: WsPeer;
  kind: WsFlowKind;
  /** Short label on the moving chip */
  label: string;
  wireTitle: string;
  fields?: WsWireField[];
  raw?: string[];
}

export interface WsChatMessage {
  from: WsBrowser;
  text: string;
}

export interface WsStep {
  id: string;
  phase: WsPhase;
  actor: WsPeer;
  call: string;
  title: string;
  summary: string;
  kernel: string;
  layers: WsLayer[];
  flow?: WsFlow;
  conn: Record<WsBrowser, WsConnState>;
  clientLine: number | null;
  clientWho: WsBrowser | null;
  serverLine: number | null;
  /** How many chat messages each browser is showing */
  delivered: Record<WsBrowser, number>;
  serverClients: WsBrowser[];
}