import { tcpCodeNotes } from '../data/tcpCodeNotes';
import type { CodeListing, CodeNote, Side } from '../types/socket';
import type { PlayCall } from '../types/playground';

const header = 'using System.Net; using System.Net.Sockets; using System.Text;';

export function playLine(call: PlayCall, side: Side): string {
  const p = call.payload ?? '';
  const v = side === 'server' ? 'conn' : 'cli';
  switch (call.kind) {
    case 'socket':
      return `var ${side === 'server' ? 'srv' : 'cli'} = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);`;
    case 'bind':
      return 'srv.Bind(new IPEndPoint(IPAddress.Any, 8080));';
    case 'listen':
      return 'srv.Listen(5);';
    case 'accept':
      return 'Socket conn = srv.Accept();';
    case 'connect':
      return 'cli.Connect(new IPEndPoint(IPAddress.Parse("10.0.0.2"), 8080));';
    case 'send':
      return `${v}.Send(Encoding.ASCII.GetBytes("${p}"));`;
    case 'recv':
      return `int n = ${v}.Receive(buf);   // byte[] buf = new byte[1024]`;
    case 'close':
      return `${v}.Close();`;
  }
}

export function playListing(calls: PlayCall[], side: Side): CodeListing {
  const lines = [header, ...calls.map((c) => playLine(c, side))];
  return { lines, anchors: lines.map((_, i) => i + 1) };
}

/** Index into tcpCodeNotes for calls whose generated line matches the TCP walkthrough. */
const reuse: Record<Side, Partial<Record<PlayCall['kind'], number>>> = {
  server: { socket: 1, bind: 2, listen: 3, accept: 4, close: 7 },
  client: { socket: 1, connect: 2, close: 6 }
};

export function playNote(call: PlayCall, side: Side): CodeNote {
  const idx = reuse[side][call.kind];
  if (idx !== undefined) return tcpCodeNotes[side][idx];

  const p = call.payload ?? '';
  const n = p.length;
  switch (call.kind) {
    case 'send':
      return {
        what: `Copies the ${n} bytes of “${p}” into this socket’s send buffer in the kernel. It returns as soon as they’re queued, before they reach the other machine.`,
        parts: [
        { code: `GetBytes("${p}")`, meaning: 'Sockets carry bytes, not strings, so the text is encoded first.' },
        { code: 'Send', meaning: 'On a blocking socket, keeps calling send() until every byte is queued.' }],

        returns: `${n}, the number of bytes queued.`
      };
    case 'recv':
      return {
        what: 'Copies whatever is in the receive buffer into your program. If the buffer is empty, the thread sleeps here until data or a FIN arrives.',
        parts: [
        { code: 'buf', meaning: 'Where to copy the bytes, and at most how many (1024).' },
        { code: 'int n', meaning: 'Bytes read. 0 means the peer closed.' }],

        returns: 'the number of bytes read.'
      };
    default:
      return { what: '', parts: [] };
  }
}