import type { WsLayer, WsStep } from '../types/websocket';

const FULL: WsLayer[] = ['app', 'ws', 'tls', 'tcp', 'ip'];
const OPEN = { alice: 'open', bob: 'open' } as const;

export const wsChatSteps: WsStep[] = [
{
  id: 'tcp-connect',
  phase: 'connect',
  actor: 'alice',
  call: 'ConnectAsync("wss://…")',
  title: 'Alice’s app opens a plain TCP socket',
  summary:
  'ClientWebSocket.ConnectAsync() doesn’t create a special kind of socket. It opens an ordinary TCP connection to chat.example on port 443. Bob connected earlier, so the server already holds one socket for him.',
  kernel:
  '.NET calls socket() and connect() exactly like the TCP walkthrough. The kernel sends SYN, gets SYN-ACK, replies ACK, and the socket is ESTABLISHED. For wss:// the TLS handshake then runs over that same socket.',
  layers: ['tls', 'tcp', 'ip'],
  flow: {
    from: 'alice',
    to: 'server',
    kind: 'tcp',
    label: 'SYN · ACK',
    wireTitle: 'TCP handshake, then TLS',
    fields: [
    { name: 'TCP', value: 'SYN → SYN-ACK → ACK', note: 'connect() to port 443, same as any TCP client' },
    { name: 'TLS', value: 'ClientHello … Finished', note: 'wss:// adds encryption; ws:// skips this' },
    { name: 'state', value: 'ESTABLISHED', note: 'a plain byte stream, no messages yet' }]

  },
  conn: { alice: 'tcp', bob: 'open' },
  clientLine: 3,
  clientWho: 'alice',
  serverLine: 25,
  delivered: { alice: 0, bob: 0 },
  serverClients: ['bob']
},
{
  id: 'upgrade-request',
  phase: 'upgrade',
  actor: 'alice',
  call: 'GET /ws  Upgrade: websocket',
  title: 'The client asks to upgrade the connection',
  summary:
  'Still inside ConnectAsync(), the first bytes on the new socket are a normal HTTP/1.1 request, but with “Upgrade: websocket” and a random Sec-WebSocket-Key. It means: keep this connection open and stop speaking HTTP on it.',
  kernel:
  'To the kernel this is just ~200 bytes handed to send(). TLS encrypts them in user space, the kernel copies them into the socket’s send buffer and they leave as ordinary TCP segments. The kernel has no idea what WebSocket is.',
  layers: ['http', 'tls', 'tcp', 'ip'],
  flow: {
    from: 'alice',
    to: 'server',
    kind: 'http',
    label: 'GET Upgrade',
    wireTitle: 'HTTP Upgrade request',
    raw: [
    'GET /ws HTTP/1.1',
    'Host: chat.example',
    'Upgrade: websocket',
    'Connection: Upgrade',
    'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
    'Sec-WebSocket-Version: 13']

  },
  conn: { alice: 'tcp', bob: 'open' },
  clientLine: 3,
  clientWho: 'alice',
  serverLine: 25,
  delivered: { alice: 0, bob: 0 },
  serverClients: ['bob']
},
{
  id: 'upgrade-response',
  phase: 'upgrade',
  actor: 'server',
  call: 'AcceptWebSocketAsync() → 101',
  title: 'The server agrees: 101 Switching Protocols',
  summary:
  'AcceptWebSocketAsync() hashes the key with a fixed GUID (SHA-1, then base64) into Sec-WebSocket-Accept and replies 101, proving the server really speaks WebSocket. From now on neither side sends HTTP again.',
  kernel:
  'Still the same TCP connection and the same file descriptor on both sides. Nothing was closed or reopened; only the meaning of the bytes changed. Kestrel’s socket engine keeps this fd registered with epoll so it hears when Alice sends.',
  layers: ['http', 'tls', 'tcp', 'ip'],
  flow: {
    from: 'server',
    to: 'alice',
    kind: 'http',
    label: '101',
    wireTitle: 'HTTP response, the last HTTP on this socket',
    raw: [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    'Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=']

  },
  conn: { alice: 'open', bob: 'open' },
  clientLine: 3,
  clientWho: 'alice',
  serverLine: 8,
  delivered: { alice: 0, bob: 0 },
  serverClients: ['bob']
},
{
  id: 'open',
  phase: 'upgrade',
  actor: 'alice',
  call: 'ConnectAsync() returns · TryAdd(ws)',
  title: 'Both sides mark the connection open',
  summary:
  'ConnectAsync() completes and Alice’s status shows online. On the server, the endpoint adds Alice’s connection to the clients dictionary, which now holds two open sockets: Bob’s and Alice’s.',
  kernel:
  'No packets. Both kernels keep the established sockets idle with empty buffers. An open WebSocket costs the server one fd and a few KB of buffer, which is why one machine can hold tens of thousands of them.',
  layers: ['app', 'ws'],
  conn: OPEN,
  clientLine: 4,
  clientWho: 'alice',
  serverLine: 9,
  delivered: { alice: 0, bob: 0 },
  serverClients: ['bob', 'alice']
},
{
  id: 'alice-send',
  phase: 'message',
  actor: 'alice',
  call: 'SendAsync(json)',
  title: 'Alice sends a message as a frame',
  summary:
  'Alice types “Game tonight?”. SendAsync() wraps the 39-byte JSON in a frame: a 2-byte header (FIN, text opcode, mask bit, length), a 4-byte random masking key, then the payload XOR-ed with that key. Her own bubble renders right away.',
  kernel:
  '.NET writes the 45-byte frame to the TCP socket. The kernel copies it into the send buffer and ships it in one segment, and the server’s kernel ACKs it. TCP has no idea where a frame starts or ends; that’s WebSocket’s job.',
  layers: FULL,
  flow: {
    from: 'alice',
    to: 'server',
    kind: 'frame',
    label: 'TEXT 45 B',
    wireTitle: 'WebSocket frame · text · masked',
    fields: [
    { name: 'bytes', value: '81 A7 3A 1F 0C 77 …', note: 'header + masking key, then payload' },
    { name: 'FIN', value: '1', note: 'endOfMessage: true, the only fragment' },
    { name: 'opcode', value: '0x1 text', note: 'WebSocketMessageType.Text; Binary would be 0x2' },
    { name: 'MASK', value: '1', note: 'client → server frames must be masked' },
    { name: 'length', value: '39', note: 'under 126, so it fits in the 2-byte header' },
    { name: 'mask key', value: '3a 1f 0c 77', note: 'random per frame; payload is XOR-ed with it' },
    { name: 'payload', value: '{"from":"alice","text":"Game tonight?"}', note: 'exactly what SendAsync() was given' }]

  },
  conn: OPEN,
  clientLine: 8,
  clientWho: 'alice',
  serverLine: 13,
  delivered: { alice: 1, bob: 0 },
  serverClients: ['bob', 'alice']
},
{
  id: 'server-recv',
  phase: 'message',
  actor: 'server',
  call: 'await ws.ReceiveAsync(buf)',
  title: 'The server reads and decodes the frame',
  summary:
  'Data arrived on Alice’s socket, so the awaiting ReceiveAsync() resumes. .NET reads the bytes, parses the header, unmasks the payload and hands back one complete text message.',
  kernel:
  'The segment landed in the receive buffer of Alice’s socket and epoll reported it ready to .NET’s socket engine. If a frame arrives split across segments, or two frames share one, .NET buffers until a whole frame is there, because TCP is only a byte stream.',
  layers: FULL,
  conn: OPEN,
  clientLine: null,
  clientWho: null,
  serverLine: 13,
  delivered: { alice: 1, bob: 0 },
  serverClients: ['bob', 'alice']
},
{
  id: 'relay-bob',
  phase: 'message',
  actor: 'server',
  call: 'await peer.SendAsync(msg)',
  title: 'The server forwards it to Bob',
  summary:
  'The server loops over clients and sends the message to everyone except the sender, which here is Bob. Server-to-client frames are never masked, so the header is just 2 bytes.',
  kernel:
  'This write goes to a different socket: Bob’s fd. The 41-byte frame is copied into Bob’s send buffer and transmitted. The server never connects Alice to Bob; it relays between two independent TCP sockets.',
  layers: FULL,
  flow: {
    from: 'server',
    to: 'bob',
    kind: 'frame',
    label: 'TEXT 41 B',
    wireTitle: 'WebSocket frame · text · unmasked',
    fields: [
    { name: 'bytes', value: '81 27 7B 22 66 72 …', note: '2-byte header, then the plain payload' },
    { name: 'FIN', value: '1', note: 'complete message in one frame' },
    { name: 'opcode', value: '0x1 text', note: 'same message type Alice sent' },
    { name: 'MASK', value: '0', note: 'server → client frames are never masked' },
    { name: 'length', value: '39', note: 'same payload, 4 bytes smaller frame' },
    { name: 'payload', value: '{"from":"alice","text":"Game tonight?"}', note: 'relayed unchanged' }]

  },
  conn: OPEN,
  clientLine: null,
  clientWho: null,
  serverLine: 16,
  delivered: { alice: 1, bob: 0 },
  serverClients: ['bob', 'alice']
},
{
  id: 'bob-recv',
  phase: 'message',
  actor: 'bob',
  call: 'ReceiveAsync() → Text',
  title: 'Bob’s ReceiveAsync() returns the message',
  summary:
  'Bob’s app was awaiting ReceiveAsync(). It reads the frame, sees FIN=1 and the text opcode, and returns. The app deserializes the JSON and renders “Game tonight?” from Alice.',
  kernel:
  'Bob’s kernel queued the segment in the socket’s receive buffer and sent an ACK. epoll woke .NET’s socket engine, which completed the pending receive and resumed Bob’s async method.',
  layers: FULL,
  conn: OPEN,
  clientLine: 17,
  clientWho: 'bob',
  serverLine: 13,
  delivered: { alice: 1, bob: 1 },
  serverClients: ['bob', 'alice']
},
{
  id: 'bob-send',
  phase: 'message',
  actor: 'bob',
  call: 'SendAsync(json)',
  title: 'Bob replies on his own socket',
  summary:
  'Bob answers “In. 9pm?”. Nobody had to ask first: either side can send whenever it likes. That full-duplex push is the whole point of WebSocket compared with HTTP’s request and response.',
  kernel:
  'Bob’s 32-byte JSON becomes a 38-byte masked frame written to his TCP socket. It arrives on the server’s fd for Bob, which epoll reports as readable, resuming Bob’s ReceiveAsync() on the server.',
  layers: FULL,
  flow: {
    from: 'bob',
    to: 'server',
    kind: 'frame',
    label: 'TEXT 38 B',
    wireTitle: 'WebSocket frame · text · masked',
    fields: [
    { name: 'bytes', value: '81 A0 C4 09 5E 21 …', note: 'header + masking key, then payload' },
    { name: 'FIN', value: '1', note: 'complete message in one frame' },
    { name: 'opcode', value: '0x1 text', note: 'UTF-8 text' },
    { name: 'MASK', value: '1', note: 'client → server, so masked' },
    { name: 'length', value: '32', note: 'fits in the 2-byte header' },
    { name: 'mask key', value: 'c4 09 5e 21', note: 'a fresh random key for this frame' },
    { name: 'payload', value: '{"from":"bob","text":"In. 9pm?"}', note: 'what Bob’s SendAsync() was given' }]

  },
  conn: OPEN,
  clientLine: 8,
  clientWho: 'bob',
  serverLine: 13,
  delivered: { alice: 1, bob: 2 },
  serverClients: ['bob', 'alice']
},
{
  id: 'relay-alice',
  phase: 'message',
  actor: 'server',
  call: 'await peer.SendAsync(msg)',
  title: 'The server relays the reply to Alice',
  summary:
  'Same endpoint code, now running for Bob’s connection: receive one message, send it to every other client. Alice’s ReceiveAsync() returns and her chat shows Bob’s reply.',
  kernel:
  'The server writes a 34-byte unmasked frame to Alice’s socket. Two TCP connections, four frames, zero new connections: every message rode a socket that was already open, so there’s no handshake delay per message.',
  layers: FULL,
  flow: {
    from: 'server',
    to: 'alice',
    kind: 'frame',
    label: 'TEXT 34 B',
    wireTitle: 'WebSocket frame · text · unmasked',
    fields: [
    { name: 'bytes', value: '81 20 7B 22 66 72 …', note: '2-byte header, then the plain payload' },
    { name: 'FIN', value: '1', note: 'complete message in one frame' },
    { name: 'opcode', value: '0x1 text', note: 'UTF-8 text' },
    { name: 'MASK', value: '0', note: 'server → client, never masked' },
    { name: 'length', value: '32', note: 'fits in the 2-byte header' },
    { name: 'payload', value: '{"from":"bob","text":"In. 9pm?"}', note: 'relayed unchanged' }]

  },
  conn: OPEN,
  clientLine: 17,
  clientWho: 'alice',
  serverLine: 16,
  delivered: { alice: 2, bob: 2 },
  serverClients: ['bob', 'alice']
},
{
  id: 'ping',
  phase: 'keepalive',
  actor: 'server',
  call: 'PING 0x9 → PONG 0xA',
  title: 'Ping and pong keep the line alive',
  summary:
  'Every 20 seconds (KeepAliveInterval) the server sends a tiny ping control frame. ClientWebSocket answers with a pong automatically; your C# code never sees either. If no pong arrives within KeepAliveTimeout, the server aborts the connection.',
  kernel:
  'Idle TCP connections can be silently dropped by NATs, proxies and load balancers, and TCP alone may not notice for a long time. A few bytes every 20 s keeps that middlebox state fresh and detects dead peers quickly.',
  layers: ['ws', 'tls', 'tcp', 'ip'],
  flow: {
    from: 'server',
    to: 'alice',
    kind: 'control',
    label: 'PING ⇄ PONG',
    wireTitle: 'Control frames',
    fields: [
    { name: 'ping', value: '89 00', note: 'FIN + opcode 0x9, empty payload, from the server' },
    { name: 'pong', value: '8A 80 + mask key', note: 'opcode 0xA, sent back by ClientWebSocket itself' },
    { name: 'app sees', value: 'nothing', note: 'control frames never come out of ReceiveAsync()' }]

  },
  conn: OPEN,
  clientLine: null,
  clientWho: null,
  serverLine: 4,
  delivered: { alice: 2, bob: 2 },
  serverClients: ['bob', 'alice']
},
{
  id: 'close',
  phase: 'close',
  actor: 'alice',
  call: 'CloseAsync(NormalClosure)',
  title: 'Alice leaves: close frame, then TCP teardown',
  summary:
  'Alice quits. CloseAsync() sends a close frame with code 1000 (normal closure). The server’s ReceiveAsync() returns a Close message, the loop breaks, and the finally block removes Alice from clients and echoes a close frame. Bob stays connected.',
  kernel:
  'After the close frames, the TCP connection shuts down with FIN and ACK exactly like the TCP walkthrough. The server closes its fd for Alice, which also removes it from epoll.',
  layers: FULL,
  flow: {
    from: 'alice',
    to: 'server',
    kind: 'control',
    label: 'CLOSE 1000',
    wireTitle: 'Close handshake',
    fields: [
    { name: 'bytes', value: '88 82 + mask + 03 E8', note: 'opcode 0x8, 2-byte payload' },
    { name: 'code', value: '1000', note: 'NormalClosure (1001 = EndpointUnavailable)' },
    { name: 'reply', value: '88 02 03 E8', note: 'server’s CloseOutputAsync(), unmasked' },
    { name: 'then', value: 'FIN → ACK → FIN → ACK', note: 'the TCP socket itself closes' }]

  },
  conn: { alice: 'closed', bob: 'open' },
  clientLine: 21,
  clientWho: 'alice',
  serverLine: 20,
  delivered: { alice: 2, bob: 2 },
  serverClients: ['bob']
}];