import type { HostSnapshot, SocketStep, SocketView, TcpState } from '../types/socket';

const listener = (state: TcpState, local: string, extra: Partial<SocketView> = {}): SocketView => ({
  id: 'srv-listen',
  fd: 3,
  role: 'listener',
  state,
  local,
  backlog: 5,
  synQueue: [],
  acceptQueue: [],
  ...extra
});

const srvConn = (o: Partial<SocketView> = {}): SocketView => ({
  id: 'srv-conn',
  fd: 4,
  role: 'connection',
  state: 'ESTABLISHED',
  local: '10.0.0.2:8080',
  remote: '10.0.0.1:52814',
  sendBuf: '',
  recvBuf: '',
  ...o
});

const cliConn = (o: Partial<SocketView> = {}): SocketView => ({
  id: 'cli-conn',
  fd: 3,
  role: 'connection',
  state: 'ESTABLISHED',
  local: '10.0.0.1:52814',
  remote: '10.0.0.2:8080',
  sendBuf: '',
  recvBuf: '',
  ...o
});

const LISTENING = listener('LISTEN', '0.0.0.0:8080');

const clientIdle: HostSnapshot = { status: 'idle', note: 'Process not started yet', line: null, sockets: [] };

const serverInAccept: HostSnapshot = {
  status: 'blocked',
  note: 'Asleep inside accept(), waiting on the accept queue',
  line: 5,
  syscall: 'accept()',
  sockets: [LISTENING]
};

export const tcpSteps: SocketStep[] = [
{
  id: 'srv-socket',
  phase: 'setup',
  actor: 'server',
  call: 'socket(AF_INET, SOCK_STREAM)',
  title: 'Server asks the kernel for a socket',
  summary:
  'A socket is a kernel object, not something that lives in your program. The server asks for a TCP endpoint and gets back a file descriptor: a small integer it uses as a handle from now on.',
  kernel:
  'Allocates a socket struct with empty send and receive buffers, attaches TCP protocol handlers, and puts it in the lowest free slot of the fd table. That slot is 3, because 0 to 2 are stdin, stdout and stderr.',
  client: clientIdle,
  server: {
    status: 'running',
    note: 'Got back fd 3',
    line: 2,
    syscall: 'socket()',
    sockets: [listener('CLOSED', 'unbound')]
  }
},
{
  id: 'srv-bind',
  phase: 'setup',
  actor: 'server',
  call: 'Bind(IPAddress.Any, 8080)',
  title: 'bind() claims an address and port',
  summary:
  'The socket now has a name: any local interface, port 8080. Incoming packets addressed to :8080 can now be routed to this socket. Nothing is sent on the network.',
  kernel:
  'Adds the socket to the kernel’s bind hash table under port 8080. A second process that tries to bind the same port gets EADDRINUSE.',
  client: clientIdle,
  server: {
    status: 'running',
    note: 'fd 3 is bound to :8080',
    line: 3,
    syscall: 'bind()',
    sockets: [listener('CLOSED', '0.0.0.0:8080')]
  }
},
{
  id: 'srv-listen',
  phase: 'setup',
  actor: 'server',
  call: 'listen(5)',
  title: 'listen() turns it into a listening socket',
  summary:
  'The socket switches to LISTEN. It will never carry data itself. Its only job is to accept new connections, like a receptionist.',
  kernel:
  'Creates two queues: a SYN queue for handshakes that are halfway done, and an accept queue (backlog = 5) for finished connections waiting for the app to pick them up.',
  client: clientIdle,
  server: { status: 'running', note: 'fd 3 is now LISTEN', line: 4, syscall: 'listen()', sockets: [LISTENING] }
},
{
  id: 'srv-accept',
  phase: 'setup',
  actor: 'server',
  call: 'accept()',
  title: 'accept() blocks until a client arrives',
  summary:
  'The accept queue is empty, so the server process goes to sleep. It uses no CPU while it waits. The kernel will wake it once a connection is ready.',
  kernel:
  'Adds the process to the socket’s wait queue and marks it TASK_INTERRUPTIBLE. The scheduler won’t run it again until something wakes it up.',
  client: clientIdle,
  server: serverInAccept
},
{
  id: 'cli-socket',
  phase: 'setup',
  actor: 'client',
  call: 'socket(AF_INET, SOCK_STREAM)',
  title: 'Client creates its own socket',
  summary:
  'The client process starts and makes a TCP socket the same way. It also gets fd 3 because each process has its own fd table, so the matching numbers are a coincidence.',
  kernel: 'Same allocation as the server: a socket struct, empty buffers, and an fd slot. No address yet.',
  client: {
    status: 'running',
    note: 'Got back fd 3',
    line: 2,
    syscall: 'socket()',
    sockets: [cliConn({ state: 'CLOSED', local: 'unbound', remote: undefined })]
  },
  server: serverInAccept
},
{
  id: 'syn',
  phase: 'handshake',
  actor: 'client',
  call: 'Connect(10.0.0.2:8080)',
  title: 'connect() sends a SYN',
  summary:
  'The client asks to connect. Its kernel starts the three-way handshake by sending a SYN packet, which says "I want to talk, my byte numbering starts at 1000." The client blocks until the handshake finishes.',
  kernel:
  'Picks a free ephemeral port (52814) and a random initial sequence number, builds a TCP header with the SYN flag set, then hands the packet down to IP and the NIC driver.',
  client: {
    status: 'blocked',
    note: 'Blocked inside connect()',
    line: 3,
    syscall: 'connect()',
    sockets: [cliConn({ state: 'SYN_SENT' })]
  },
  server: serverInAccept,
  packet: { from: 'client', flags: ['SYN'], seq: 1000 }
},
{
  id: 'syn-ack',
  phase: 'handshake',
  actor: 'kernel',
  call: 'kernel → SYN-ACK',
  title: 'The server’s kernel replies with SYN-ACK',
  summary:
  'The server app is still asleep. Its kernel handles the handshake alone: it records a half-open connection and replies "got your 1000, my numbering starts at 5000."',
  kernel:
  'Finds the listening socket for port 8080, adds a lightweight request entry (SYN_RCVD) to the SYN queue, and sends SYN+ACK with ack = 1001, which is the next byte it expects.',
  client: {
    status: 'blocked',
    note: 'Still blocked inside connect()',
    line: 3,
    syscall: 'connect()',
    sockets: [cliConn({ state: 'SYN_SENT' })]
  },
  server: {
    ...serverInAccept,
    note: 'Still asleep. The app isn’t involved yet',
    sockets: [listener('LISTEN', '0.0.0.0:8080', { synQueue: ['10.0.0.1:52814'] })]
  },
  packet: { from: 'server', flags: ['SYN', 'ACK'], seq: 5000, ack: 1001 }
},
{
  id: 'ack',
  phase: 'handshake',
  actor: 'client',
  call: 'kernel → ACK',
  title: 'Client ACKs, and the connection is established',
  summary:
  'The client’s kernel acknowledges the server’s SYN and connect() returns 0. On the server, the half-open entry becomes a full connection and moves to the accept queue.',
  kernel:
  'The server matches the ACK to its SYN-queue entry, creates a full child socket in ESTABLISHED, places it on the accept queue, and wakes the process sleeping in accept().',
  client: {
    status: 'running',
    note: 'connect() returned 0',
    line: 3,
    syscall: 'connect()',
    sockets: [cliConn()]
  },
  server: {
    ...serverInAccept,
    note: 'Being woken up…',
    sockets: [listener('LISTEN', '0.0.0.0:8080', { acceptQueue: ['10.0.0.1:52814'] })]
  },
  packet: { from: 'client', flags: ['ACK'], seq: 1001, ack: 5001 }
},
{
  id: 'accept-returns',
  phase: 'handshake',
  actor: 'server',
  call: 'accept() → fd 4',
  title: 'accept() returns a brand-new socket',
  summary:
  'accept() takes the connection off the queue and gives it a new file descriptor, fd 4. The listening socket on fd 3 keeps listening for other clients. One socket listens, and a separate socket handles each conversation.',
  kernel:
  'Dequeues the child socket, installs it in the server’s fd table, and returns. The child socket is identified by a 4-tuple: (10.0.0.2:8080, 10.0.0.1:52814).',
  client: { status: 'running', note: 'Connected', line: 3, sockets: [cliConn()] },
  server: {
    status: 'running',
    note: 'accept() returned fd 4',
    line: 5,
    syscall: 'accept()',
    sockets: [LISTENING, srvConn()]
  }
},
{
  id: 'cli-send',
  phase: 'transfer',
  actor: 'client',
  call: 'Send("hello server")',
  title: 'send() only copies bytes into the kernel',
  summary:
  'send() returning doesn’t mean the server has the data. All it did was copy 12 bytes from the program’s memory into the socket’s send buffer. The kernel decides when to transmit them.',
  kernel:
  'Copies the user buffer into socket buffers on the send queue. If the send buffer were full, Send() would block here. This is how TCP flow control reaches the app.',
  client: {
    status: 'running',
    note: 'Send() returned immediately',
    line: 4,
    syscall: 'send()',
    sockets: [cliConn({ sendBuf: 'hello server' })]
  },
  server: {
    status: 'blocked',
    note: 'Blocked in recv(): receive buffer is empty',
    line: 6,
    syscall: 'recv()',
    sockets: [LISTENING, srvConn()]
  }
},
{
  id: 'data-out',
  phase: 'transfer',
  actor: 'kernel',
  call: 'kernel → PSH, ACK',
  title: 'TCP puts the bytes on the wire',
  summary:
  'The client’s kernel sends the data, bytes 1001 to 1012. They arrive in the server’s receive buffer. The client keeps its copy until the server acknowledges it, in case the packet is lost and has to be resent.',
  kernel:
  'Segments the data, starts a retransmission timer, and sends. On the server, the NIC raises an interrupt, the TCP stack checks the sequence number, and the payload is appended to fd 4’s receive queue. Then the server process is woken.',
  client: {
    status: 'blocked',
    note: 'Blocked in recv(): waiting for a reply',
    line: 5,
    syscall: 'recv()',
    sockets: [cliConn({ sendBuf: 'hello server' })]
  },
  server: {
    status: 'blocked',
    note: 'Data arrived, being woken up…',
    line: 6,
    syscall: 'recv()',
    sockets: [LISTENING, srvConn({ recvBuf: 'hello server' })]
  },
  packet: { from: 'client', flags: ['PSH', 'ACK'], seq: 1001, ack: 5001, payload: 'hello server' }
},
{
  id: 'srv-recv',
  phase: 'transfer',
  actor: 'server',
  call: 'recv(1024)',
  title: 'recv() copies data out of the kernel',
  summary:
  'recv() moves the 12 bytes from the receive buffer into the server program’s memory. The server’s kernel acknowledges them, so the client can free its send buffer.',
  kernel:
  'Copies data to user space and frees the socket buffers. The ACK (ack = 1013) tells the client everything up to byte 1012 arrived, so its retransmission timer is cancelled.',
  client: {
    status: 'blocked',
    note: 'Still blocked in recv()',
    line: 5,
    syscall: 'recv()',
    sockets: [cliConn()]
  },
  server: {
    status: 'running',
    note: 'recv() returned 12 bytes',
    line: 6,
    syscall: 'recv()',
    sockets: [LISTENING, srvConn()]
  },
  packet: { from: 'server', flags: ['ACK'], seq: 5001, ack: 1013 }
},
{
  id: 'srv-send',
  phase: 'transfer',
  actor: 'server',
  call: 'Send(reply)',
  title: 'The server sends its reply',
  summary:
  'The server uppercases the message and sends it back. It follows the same path in reverse: app memory, then send buffer, then the network, then the client’s receive buffer.',
  kernel:
  'Sends bytes 5001 to 5012. When they reach the client’s receive queue, the client process asleep in recv() becomes runnable.',
  client: {
    status: 'blocked',
    note: 'Data arrived, being woken up…',
    line: 5,
    syscall: 'recv()',
    sockets: [cliConn({ recvBuf: 'HELLO SERVER' })]
  },
  server: {
    status: 'running',
    note: 'Send() queued 12 bytes',
    line: 7,
    syscall: 'send()',
    sockets: [LISTENING, srvConn({ sendBuf: 'HELLO SERVER' })]
  },
  packet: { from: 'server', flags: ['PSH', 'ACK'], seq: 5001, ack: 1013, payload: 'HELLO SERVER' }
},
{
  id: 'cli-recv',
  phase: 'transfer',
  actor: 'client',
  call: 'recv(1024)',
  title: 'The client reads the reply',
  summary:
  'recv() returns b\'HELLO SERVER\' and the client prints it. The client’s kernel acknowledges the reply, so the server frees its send buffer.',
  kernel:
  'Same as before in the other direction: copy to user space, free the buffers, send ack = 5013.',
  client: {
    status: 'running',
    note: "recv() returned b'HELLO SERVER'",
    line: 6,
    syscall: 'recv()',
    sockets: [cliConn()]
  },
  server: {
    status: 'running',
    note: 'Reply acknowledged, send buffer freed',
    line: 7,
    sockets: [LISTENING, srvConn()]
  },
  packet: { from: 'client', flags: ['ACK'], seq: 1013, ack: 5013 }
},
{
  id: 'cli-close',
  phase: 'teardown',
  actor: 'client',
  call: 'close()',
  title: 'Client closes, and its kernel sends FIN',
  summary:
  'close() releases fd 3 right away, but the kernel keeps the socket alive to close the connection properly. FIN means "I have nothing more to send."',
  kernel:
  'Drops the fd reference and moves the socket to FIN_WAIT_1. On the server, the FIN puts fd 4 in CLOSE_WAIT. The next Receive() there would return 0 (end of stream).',
  client: {
    status: 'done',
    note: 'close() returned. fd 3 released',
    line: 7,
    syscall: 'close()',
    sockets: [cliConn({ fd: null, state: 'FIN_WAIT_1' })]
  },
  server: {
    status: 'running',
    note: 'Peer sent FIN, so Receive() would return 0',
    line: 7,
    sockets: [LISTENING, srvConn({ state: 'CLOSE_WAIT' })]
  },
  packet: { from: 'client', flags: ['FIN', 'ACK'], seq: 1013, ack: 5013 }
},
{
  id: 'srv-close',
  phase: 'teardown',
  actor: 'server',
  call: 'close()',
  title: 'Server closes its side too',
  summary:
  'The server calls close() on fd 4. Its kernel acknowledges the client’s FIN and sends its own FIN in the same packet.',
  kernel:
  'fd 4 moves to LAST_ACK. Combining the ACK with the FIN lets the client skip FIN_WAIT_2 and go straight to TIME_WAIT when the packet arrives.',
  client: {
    status: 'done',
    note: 'Process finished',
    line: 7,
    sockets: [cliConn({ fd: null, state: 'FIN_WAIT_1' })]
  },
  server: {
    status: 'done',
    note: 'close() returned. fd 4 released',
    line: 8,
    syscall: 'close()',
    sockets: [LISTENING, srvConn({ fd: null, state: 'LAST_ACK' })]
  },
  packet: { from: 'server', flags: ['FIN', 'ACK'], seq: 5013, ack: 1014 }
},
{
  id: 'time-wait',
  phase: 'teardown',
  actor: 'kernel',
  call: 'kernel → final ACK',
  title: 'Final ACK, and the client waits in TIME_WAIT',
  summary:
  'The server frees its connection socket. The client stays in TIME_WAIT for a while, so delayed packets can’t mix into a new connection on the same ports. The listener on :8080 is still open for the next client.',
  kernel:
  'The client socket lingers for 2×MSL (60 s on Linux) and then is freed. The server destroys its child socket on receiving the ACK. fd 3 is still LISTEN.',
  client: {
    status: 'done',
    note: 'Process finished',
    line: 7,
    sockets: [cliConn({ fd: null, state: 'TIME_WAIT' })]
  },
  server: {
    status: 'done',
    note: 'Connection freed. Listener on :8080 is still open',
    line: 8,
    sockets: [LISTENING]
  },
  packet: { from: 'client', flags: ['ACK'], seq: 1014, ack: 5014 }
}];