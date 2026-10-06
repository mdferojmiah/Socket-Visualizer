import type { Packet, Side, SocketView } from '../types/socket';
import type {
  Availability,
  PlayAction,
  PlayFrame,
  PlayHost,
  PlayKind,
  PlayLogEntry,
  PlayState } from
'../types/playground';

const CLI_ADDR = '10.0.0.1:52814';
const SRV_ADDR = '10.0.0.2:8080';
const ISN: Record<Side, number> = { client: 1000, server: 5000 };

const freshHost = (): PlayHost => ({
  status: 'idle',
  blockedIn: null,
  note: 'No calls yet. Use the buttons above',
  sockets: [],
  calls: []
});

export const initialPlayState = (): PlayState => ({
  client: freshHost(),
  server: freshHost(),
  seq: { ...ISN }
});

export const clientActions: PlayKind[] = ['socket', 'connect', 'send', 'recv', 'close'];
export const serverActions: PlayKind[] = ['socket', 'bind', 'listen', 'accept', 'send', 'recv', 'close'];

/** The guided path the play zone suggests, in order. */
export const tour: PlayAction[] = [
{ side: 'server', kind: 'socket' },
{ side: 'server', kind: 'bind' },
{ side: 'server', kind: 'listen' },
{ side: 'server', kind: 'accept' },
{ side: 'client', kind: 'socket' },
{ side: 'client', kind: 'connect' },
{ side: 'client', kind: 'send' },
{ side: 'server', kind: 'recv' },
{ side: 'server', kind: 'send' },
{ side: 'client', kind: 'recv' },
{ side: 'client', kind: 'close' },
{ side: 'server', kind: 'recv' },
{ side: 'server', kind: 'close' }];


const other = (side: Side): Side => side === 'client' ? 'server' : 'client';
const listenerOf = (h: PlayHost) => h.sockets.find((s) => s.role === 'listener');
const connOf = (h: PlayHost) => h.sockets.find((s) => s.role === 'connection');
const ok: Availability = { ok: true };
const no = (reason: string): Availability => ({ ok: false, reason });

export function availability(state: PlayState, side: Side, kind: PlayKind): Availability {
  const h = state[side];
  if (h.blockedIn) return no(`The process is blocked inside ${h.blockedIn}()`);
  const conn = connOf(h);

  if (side === 'server') {
    const l = listenerOf(h);
    if (kind === 'socket') return l ? no('The server already has a listening socket') : ok;
    if (kind === 'bind') {
      if (!l) return no('Create a socket first');
      return l.state === 'UNBOUND' ? ok : no('The socket is already bound to :8080');
    }
    if (kind === 'listen') {
      if (!l) return no('Create a socket first');
      if (l.state === 'UNBOUND') return no('bind() an address first');
      return l.state === 'LISTEN' ? no('Already listening') : ok;
    }
    if (kind === 'accept') {
      if (!l || l.state !== 'LISTEN') return no('Call listen() first');
      if (conn) return no(conn.fd === null ? 'The previous connection is still closing' : 'This demo serves one client at a time');
      return ok;
    }
  } else {
    if (kind === 'socket') {
      if (!conn) return ok;
      return no(conn.fd === null ? 'The old socket is still closing in the kernel' : 'The client already has a socket');
    }
    if (kind === 'connect') {
      if (!conn) return no('Create a socket first');
      if (conn.state === 'CLOSED') return no('A refused socket can’t be reused. close() it and make a new one');
      return conn.state === 'UNBOUND' ? ok : no('Already connected');
    }
  }

  if (!conn || conn.fd === null) {
    return no(side === 'server' ? 'accept() a connection first' : 'Create and connect a socket first');
  }
  if (kind === 'close') return ok;
  if (kind === 'send') {
    if (conn.state === 'ESTABLISHED') {
      const peerConn = connOf(state[other(side)]);
      if (!peerConn) return no('The server hasn’t accept()ed yet. Call accept() on the server first');
      return ok;
    }
    if (conn.state === 'CLOSE_WAIT') return no('The peer has closed. Call close() to finish');
    return no('Not connected');
  }
  if (kind === 'recv') {
    return conn.state === 'ESTABLISHED' || conn.state === 'CLOSE_WAIT' ? ok : no('Not connected');
  }
  return no('Not available');
}

let frameCounter = 0;

class FrameBuilder {
  frames: PlayFrame[] = [];
  cur: PlayState;

  constructor(state: PlayState) {
    this.cur = clone(state);
  }

  push(mutate: (s: PlayState) => void, log: Omit<PlayLogEntry, 'id'>, packet?: Packet) {
    const next = clone(this.cur);
    mutate(next);
    this.cur = next;
    const id = `pf-${++frameCounter}`;
    this.frames.push({ id, state: next, packet, log: { ...log, id } });
  }
}

export function runPlayAction(state: PlayState, action: PlayAction): PlayFrame[] {
  const { side, kind, payload } = action;
  const peer = other(side);
  const b = new FrameBuilder(state);
  const record = (s: PlayState, syscall: string, note: string) => {
    const h = s[side];
    h.calls.push({ kind, payload });
    h.syscall = syscall;
    h.note = note;
    h.status = 'running';
  };

  switch (kind) {
    case 'socket':{
        if (side === 'server') {
          b.push(
            (s) => {
              record(s, 'socket()', 'Got back fd 3');
              s.server.sockets.push({
                id: 'pl-srv-listen',
                fd: 3,
                role: 'listener',
                state: 'UNBOUND',
                local: 'unbound',
                backlog: 5,
                synQueue: [],
                acceptQueue: []
              });
            },
            {
              actor: 'server',
              title: 'socket() created fd 3 on the server',
              detail:
              'The kernel allocated a TCP socket object and put it in slot 3 of the fd table (0–2 are stdin, stdout and stderr). It has no address yet, so no packet can reach it.'
            }
          );
        } else {
          b.push(
            (s) => {
              record(s, 'socket()', 'Got back fd 3');
              s.client.sockets.push({
                id: 'pl-cli-conn',
                fd: 3,
                role: 'connection',
                state: 'UNBOUND',
                local: 'unbound',
                sendBuf: '',
                recvBuf: ''
              });
            },
            {
              actor: 'client',
              title: 'socket() created fd 3 on the client',
              detail:
              'The client gets its own socket in its own kernel. It doesn’t need bind(): connect() will pick a local port automatically.'
            }
          );
        }
        break;
      }

    case 'bind':
      b.push(
        (s) => {
          record(s, 'bind()', 'fd 3 is bound to :8080');
          const l = listenerOf(s.server)!;
          l.state = 'BOUND';
          l.local = '0.0.0.0:8080';
        },
        {
          actor: 'server',
          title: 'bind() claimed port 8080',
          detail:
          'The socket was added to the kernel’s bind table under port 8080. Nothing goes on the network. If a client connected now, it would be refused, because the socket isn’t listening yet.'
        }
      );
      break;

    case 'listen':
      b.push(
        (s) => {
          record(s, 'listen()', 'Listening on :8080');
          listenerOf(s.server)!.state = 'LISTEN';
        },
        {
          actor: 'server',
          title: 'listen() opened the door',
          detail:
          'The socket is now passive. The kernel gives it a SYN queue (half-open handshakes) and an accept queue (completed connections). From now on, the kernel answers SYNs on its own, even before the app calls accept().'
        }
      );
      break;

    case 'accept':{
        const l = listenerOf(state.server)!;
        if ((l.acceptQueue ?? []).length > 0) {
          b.push(
            (s) => {
              record(s, 'accept()', 'accept() returned fd 4');
              acceptOne(s);
            },
            {
              actor: 'server',
              title: 'accept() returned straight away with fd 4',
              detail:
              'A connection was already waiting in the accept queue, so accept() took it off without blocking. It’s a new socket with its own buffers. fd 3 keeps listening.'
            }
          );
        } else {
          b.push(
            (s) => {
              record(s, 'accept()', 'Asleep in accept(): the accept queue is empty');
              s.server.status = 'blocked';
              s.server.blockedIn = 'accept';
            },
            {
              actor: 'server',
              title: 'accept() is blocking: no one has connected yet',
              detail:
              'The server process sleeps on the listener’s wait queue. It uses no CPU and can’t do anything else. Connect from the client to wake it up.'
            }
          );
        }
        break;
      }

    case 'connect':{
        const listening = listenerOf(state.server)?.state === 'LISTEN';
        b.push(
          (s) => {
            record(s, 'connect()', 'Asleep in connect(): waiting for SYN-ACK');
            s.client.status = 'blocked';
            s.client.blockedIn = 'connect';
            const c = connOf(s.client)!;
            c.state = 'SYN_SENT';
            c.local = CLI_ADDR;
            c.remote = SRV_ADDR;
            if (listening) listenerOf(s.server)!.synQueue = [CLI_ADDR];
            s.seq.client = ISN.client + 1;
          },
          {
            actor: 'client',
            title: 'connect() sent a SYN',
            detail:
            'The client kernel picked a free ephemeral port (52814) and sent a SYN with a random starting sequence number (1000 here). The client sleeps until a reply arrives.'
          },
          { from: 'client', flags: ['SYN'], seq: ISN.client }
        );

        if (!listening) {
          b.push(
            (s) => {
              s.client.status = 'running';
              s.client.blockedIn = null;
              s.client.note = 'connect() failed: ECONNREFUSED';
              const c = connOf(s.client)!;
              c.state = 'CLOSED';
              s.seq.client = ISN.client;
            },
            {
              actor: 'kernel',
              title: 'Nothing is listening, so the server kernel replied RST',
              detail:
              'No socket on the server is in LISTEN on port 8080, so its kernel rejected the SYN with a reset. connect() fails with ECONNREFUSED (a SocketException with SocketError.ConnectionRefused in C#). That’s what “connection refused” means.'
            },
            { from: 'server', flags: ['RST', 'ACK'], seq: 0, ack: ISN.client + 1 }
          );
          break;
        }

        b.push(
          (s) => {
            s.server.note = s.server.blockedIn ? s.server.note : 'Kernel is completing a handshake';
            s.seq.server = ISN.server + 1;
          },
          {
            actor: 'kernel',
            title: 'The server kernel answered with SYN-ACK',
            detail:
            'The listener’s SYN queue now holds a half-open entry for the client. Its kernel sent SYN-ACK, acknowledging seq 1000 (ack 1001) and choosing its own starting sequence number, 5000. The server app hasn’t done anything.'
          },
          { from: 'server', flags: ['SYN', 'ACK'], seq: ISN.server, ack: ISN.client + 1 }
        );

        b.push(
          (s) => {
            s.client.status = 'running';
            s.client.blockedIn = null;
            s.client.note = 'connect() returned. Connected';
            connOf(s.client)!.state = 'ESTABLISHED';
            const l = listenerOf(s.server)!;
            l.synQueue = [];
            l.acceptQueue = [...(l.acceptQueue ?? []), CLI_ADDR];
          },
          {
            actor: 'kernel',
            title: 'Final ACK: the connection is ESTABLISHED',
            detail:
            'The client acknowledged the server’s SYN, so connect() returns. On the server, the connection moved from the SYN queue to the accept queue. It now exists, waiting for accept() to pick it up.'
          },
          { from: 'client', flags: ['ACK'], seq: ISN.client + 1, ack: ISN.server + 1 }
        );

        if (state.server.blockedIn === 'accept') {
          b.push(
            (s) => {
              s.server.status = 'running';
              s.server.blockedIn = null;
              s.server.note = 'accept() returned fd 4';
              acceptOne(s);
            },
            {
              actor: 'server',
              title: 'The sleeping accept() woke up with fd 4',
              detail:
              'The new entry in the accept queue woke the server process. accept() took it off the queue and returned a new connected socket, fd 4. Both sides can now send() and recv().'
            }
          );
        }
        break;
      }

    case 'send':{
        const msg = payload ?? '';
        const n = msg.length;
        b.push(
          (s) => {
            record(s, 'send()', `send() queued ${n} bytes`);
            const c = connOf(s[side])!;
            c.sendBuf = (c.sendBuf ?? '') + msg;
          },
          {
            actor: side,
            title: `send() copied “${msg}” into the kernel`,
            detail: `The ${n} bytes now sit in the ${side}’s send buffer. send() has already returned. Your program is free to continue, even though nothing has reached the wire yet.`
          }
        );
        const seqStart = state.seq[side];
        b.push(
          (s) => {
            const pc = connOf(s[peer])!;
            pc.recvBuf = (pc.recvBuf ?? '') + msg;
            s.seq[side] = seqStart + n;
          },
          {
            actor: 'kernel',
            title: `A segment carries “${msg}” across the wire`,
            detail: `The ${side}’s TCP stack wrapped the bytes in a segment with seq ${seqStart}. The ${peer}’s kernel checked the sequence number and appended the bytes to its receive buffer. The ${peer} app isn’t involved, and the data waits there until recv().`
          },
          { from: side, flags: ['PSH', 'ACK'], seq: seqStart, ack: state.seq[peer], payload: msg }
        );
        b.push(
          (s) => {
            connOf(s[side])!.sendBuf = '';
          },
          {
            actor: 'kernel',
            title: `The ${peer} ACKed, so the ${side} freed its copy`,
            detail: `ack ${seqStart + n} means “I have everything before byte ${seqStart + n}”. Only now does the ${side}’s kernel drop the bytes from its send buffer. Until this point it kept them in case they needed to be resent.`
          },
          { from: peer, flags: ['ACK'], seq: state.seq[peer], ack: seqStart + n }
        );
        if (state[peer].blockedIn === 'recv') {
          b.push(
            (s) => {
              const pc = connOf(s[peer])!;
              pc.recvBuf = '';
              s[peer].status = 'running';
              s[peer].blockedIn = null;
              s[peer].note = `recv() returned “${msg}”`;
            },
            {
              actor: peer,
              title: `The ${peer}’s blocked recv() woke up with “${msg}”`,
              detail: `Data in the receive buffer woke the sleeping process. recv() copied the ${n} bytes into the program and the buffer is empty again.`
            }
          );
        }
        break;
      }

    case 'recv':{
        const c = connOf(state[side])!;
        const data = c.recvBuf ?? '';
        if (data) {
          b.push(
            (s) => {
              record(s, 'recv()', `recv() returned “${data}”`);
              connOf(s[side])!.recvBuf = '';
            },
            {
              actor: side,
              title: `recv() returned “${data}” immediately`,
              detail: `The bytes were already waiting in the receive buffer, so recv() copied all ${data.length} of them out without sleeping. Several send() calls can arrive as one recv(), because TCP is a byte stream with no message boundaries.`
            }
          );
        } else if (c.state === 'CLOSE_WAIT') {
          b.push((s) => record(s, 'recv()', 'recv() returned 0 bytes: the peer closed'), {
            actor: side,
            title: 'recv() returned 0: end of stream',
            detail:
            'The buffer is empty and the peer has sent a FIN, so there will never be more data. A return value of 0 (Receive() returning 0 in C#) is how your program learns the other side hung up. Now call close().'
          });
        } else {
          b.push(
            (s) => {
              record(s, 'recv()', 'Asleep in recv(): the receive buffer is empty');
              s[side].status = 'blocked';
              s[side].blockedIn = 'recv';
            },
            {
              actor: side,
              title: 'recv() is blocking: nothing to read yet',
              detail: `The ${side} sleeps on the socket’s wait queue until bytes or a FIN arrive. Try send() on the ${peer} to wake it up.`
            }
          );
        }
        break;
      }

    case 'close':{
        const c = connOf(state[side])!;
        if (c.state === 'UNBOUND' || c.state === 'CLOSED') {
          b.push(
            (s) => {
              record(s, 'close()', `close() freed fd ${c.fd}`);
              s[side].sockets = s[side].sockets.filter((x) => x.role !== 'connection');
              s.seq[side] = ISN[side];
            },
            {
              actor: side,
              title: `close() freed fd ${c.fd}`,
              detail: 'The socket was never connected, so it’s simply released. Nothing is sent on the network.'
            }
          );
          break;
        }

        const mySeq = state.seq[side];
        if (c.state === 'ESTABLISHED') {
          b.push(
            (s) => {
              record(s, 'close()', 'close() returned. The kernel is finishing the connection');
              const mc = connOf(s[side])!;
              mc.fd = null;
              mc.state = 'FIN_WAIT_1';
              const pc = connOf(s[peer]);
              if (pc) pc.state = 'CLOSE_WAIT';
              s.seq[side] = mySeq + 1;
            },
            {
              actor: side,
              title: `close() sent a FIN from the ${side}`,
              detail: `The fd is gone from the ${side}’s table right away, but the socket lives on in the kernel to finish the teardown. The ${peer} moves to CLOSE_WAIT: it knows no more data is coming, but it can still send.`
            },
            { from: side, flags: ['FIN', 'ACK'], seq: mySeq, ack: state.seq[peer] }
          );
          b.push(
            (s) => {
              connOf(s[side])!.state = 'FIN_WAIT_2';
            },
            {
              actor: 'kernel',
              title: `The ${peer} kernel ACKed the FIN`,
              detail: `The connection is now half-closed. The ${peer} app finds out when recv() returns 0, and it must call close() to finish the teardown.`
            },
            { from: peer, flags: ['ACK'], seq: state.seq[peer], ack: mySeq + 1 }
          );
          if (state[peer].blockedIn === 'recv') {
            b.push(
              (s) => {
                s[peer].status = 'running';
                s[peer].blockedIn = null;
                s[peer].note = 'recv() returned 0 bytes: the peer closed';
              },
              {
                actor: peer,
                title: `The ${peer}’s blocked recv() returned 0`,
                detail: 'The FIN woke the sleeping recv(), which returned 0 to signal end of stream. Now call close() on this side.'
              }
            );
          }
          break;
        }

        // Passive close from CLOSE_WAIT
        b.push(
          (s) => {
            record(s, 'close()', 'close() returned. Waiting for the last ACK');
            const mc = connOf(s[side])!;
            mc.fd = null;
            mc.state = 'LAST_ACK';
            connOf(s[peer])!.state = 'TIME_WAIT';
            s.seq[side] = mySeq + 1;
          },
          {
            actor: side,
            title: `close() sent the ${side}’s FIN`,
            detail: `Both directions are now closing. The ${peer}, which closed first, moves to TIME_WAIT.`
          },
          { from: side, flags: ['FIN', 'ACK'], seq: mySeq, ack: state.seq[peer] }
        );
        b.push(
          (s) => {
            s[side].sockets = s[side].sockets.filter((x) => x.role !== 'connection');
          },
          {
            actor: 'kernel',
            title: `The final ACK arrived. The ${side}’s socket is gone`,
            detail: `The ${side} received the ACK for its FIN and freed the socket completely. The connection is closed from its side.`
          },
          { from: peer, flags: ['ACK'], seq: state.seq[peer], ack: mySeq + 1 }
        );
        b.push(
          (s) => {
            s[peer].sockets = s[peer].sockets.filter((x) => x.role !== 'connection');
            s.seq = { ...ISN };
          },
          {
            actor: 'kernel',
            title: 'TIME_WAIT expired (fast-forwarded)',
            detail:
            'The side that closed first normally waits 2×MSL (60 s on Linux) so that stray old segments can’t confuse a new connection on the same ports. Here it’s skipped. Both sides are clean, and you can connect again.'
          }
        );
        break;
      }
  }

  return b.frames;
}

function acceptOne(s: PlayState) {
  const l = listenerOf(s.server)!;
  l.acceptQueue = (l.acceptQueue ?? []).slice(1);
  const conn: SocketView = {
    id: `pl-srv-conn-${frameCounter}`,
    fd: 4,
    role: 'connection',
    state: connOf(s.client)?.state === 'ESTABLISHED' ? 'ESTABLISHED' : 'CLOSE_WAIT',
    local: SRV_ADDR,
    remote: CLI_ADDR,
    sendBuf: '',
    recvBuf: ''
  };
  s.server.sockets.push(conn);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}