import type { HostSnapshot, SocketStep, SocketView } from '../types/socket';

const datagram = (id: string, o: Partial<SocketView>): SocketView => ({
  id,
  fd: 3,
  role: 'datagram',
  state: 'BOUND',
  local: 'unbound',
  recvQueue: [],
  ...o
});

const srvSock = (o: Partial<SocketView> = {}) => datagram('srv-udp', { local: '0.0.0.0:9090', ...o });
const cliSock = (o: Partial<SocketView> = {}) => datagram('cli-udp', { local: '10.0.0.1:41022', ...o });

const clientIdle: HostSnapshot = { status: 'idle', note: 'Process not started yet', line: null, sockets: [] };

const serverWaiting: HostSnapshot = {
  status: 'blocked',
  note: 'Asleep in recvfrom(): receive queue is empty',
  line: 4,
  syscall: 'recvfrom()',
  sockets: [srvSock()]
};

export const udpSteps: SocketStep[] = [
{
  id: 'udp-srv-socket',
  phase: 'setup',
  actor: 'server',
  call: 'socket(AF_INET, SOCK_DGRAM)',
  title: 'Server creates a datagram socket',
  summary:
  'SOCK_DGRAM asks for UDP. As with TCP, you get back a kernel object and a file descriptor. But this socket will never have a connection, a state machine or a send buffer.',
  kernel:
  'Allocates a socket wired to UDP, with only a receive queue. There are no sequence numbers, retransmission timers or congestion control. That leaves out most of the kernel code TCP needs.',
  client: clientIdle,
  server: {
    status: 'running',
    note: 'Got back fd 3',
    line: 2,
    syscall: 'socket()',
    sockets: [srvSock({ state: 'UNBOUND', local: 'unbound' })]
  }
},
{
  id: 'udp-srv-bind',
  phase: 'setup',
  actor: 'server',
  call: 'Bind(IPAddress.Any, 9090)',
  title: 'bind() claims port 9090',
  summary:
  'UDP has no listen() and no accept(). Once bound, this one socket receives datagrams from every client that sends to :9090.',
  kernel: 'Adds the socket to the UDP port table. Incoming datagrams for :9090 will be delivered here. Nothing is sent.',
  client: clientIdle,
  server: { status: 'running', note: 'fd 3 is bound to :9090', line: 3, syscall: 'bind()', sockets: [srvSock()] }
},
{
  id: 'udp-srv-recvfrom',
  phase: 'setup',
  actor: 'server',
  call: 'recvfrom(1024)',
  title: 'recvfrom() waits for a datagram, not a connection',
  summary:
  'The server goes to sleep until a packet arrives. Whatever comes next, from any sender, wakes it up.',
  kernel:
  'Uses the same sleep mechanism as TCP: the process waits on the socket until a datagram lands in the receive queue.',
  client: clientIdle,
  server: serverWaiting
},
{
  id: 'udp-cli-socket',
  phase: 'setup',
  actor: 'client',
  call: 'socket(AF_INET, SOCK_DGRAM)',
  title: 'Client creates its own datagram socket',
  summary: 'The client gets fd 3 in its own fd table. It has no address yet, and it never needs to connect.',
  kernel: 'Allocates a UDP socket with an empty receive queue.',
  client: {
    status: 'running',
    note: 'Got back fd 3',
    line: 2,
    syscall: 'socket()',
    sockets: [cliSock({ state: 'UNBOUND', local: 'unbound' })]
  },
  server: serverWaiting
},
{
  id: 'udp-cli-sendto',
  phase: 'transfer',
  actor: 'client',
  call: 'sendto("hello server", 10.0.0.2:9090)',
  title: 'sendto() sends a datagram with no handshake',
  summary:
  'There’s no connect step. The destination is passed with each call. The kernel adds an 8-byte UDP header to the 12 bytes and sends them right away. If the packet is lost, nothing notices and nothing resends it.',
  kernel:
  'Assigns a free ephemeral port (41022), builds the UDP and IP headers, and passes the packet straight to the NIC. The server’s kernel finds the socket on port 9090 and appends the whole datagram to its receive queue. If that queue is full, the datagram is dropped without any error.',
  client: {
    status: 'running',
    note: 'sendto() returned. The datagram is already sent',
    line: 3,
    syscall: 'sendto()',
    sockets: [cliSock()]
  },
  server: {
    ...serverWaiting,
    note: 'Datagram arrived, being woken up…',
    sockets: [srvSock({ recvQueue: ['hello server'] })]
  },
  packet: { from: 'client', payload: 'hello server' }
},
{
  id: 'udp-srv-recv',
  phase: 'transfer',
  actor: 'server',
  call: 'recvfrom(1024) → data, addr',
  title: 'recvfrom() returns one datagram and the sender’s address',
  summary:
  'Each recvfrom() returns exactly one datagram, so message boundaries are kept. TCP gives you a continuous byte stream instead. recvfrom() also returns the sender’s address, because no connection remembers who sent it.',
  kernel:
  'Takes one datagram off the queue, copies its payload to the program, and fills in addr = 10.0.0.1:41022. Nothing is sent back, because UDP has no ACKs.',
  client: {
    status: 'blocked',
    note: 'Blocked in recvfrom(): waiting for a reply',
    line: 4,
    syscall: 'recvfrom()',
    sockets: [cliSock()]
  },
  server: {
    status: 'running',
    note: 'Got 12 bytes from 10.0.0.1:41022',
    line: 4,
    syscall: 'recvfrom()',
    sockets: [srvSock()]
  }
},
{
  id: 'udp-srv-sendto',
  phase: 'transfer',
  actor: 'server',
  call: 'SendTo(reply, peer)',
  title: 'The server replies to the address it just received',
  summary:
  'The server uses the sender’s address to reply. One socket can serve thousands of clients this way, with no extra socket for each client.',
  kernel:
  'Builds a datagram from :9090 to 10.0.0.1:41022 and sends it. The client’s kernel finds the socket on port 41022 and queues the datagram.',
  client: {
    status: 'blocked',
    note: 'Datagram arrived, being woken up…',
    line: 4,
    syscall: 'recvfrom()',
    sockets: [cliSock({ recvQueue: ['HELLO SERVER'] })]
  },
  server: {
    status: 'running',
    note: 'sendto() returned',
    line: 5,
    syscall: 'sendto()',
    sockets: [srvSock()]
  },
  packet: { from: 'server', payload: 'HELLO SERVER' }
},
{
  id: 'udp-cli-recv',
  phase: 'transfer',
  actor: 'client',
  call: 'recvfrom(1024)',
  title: 'The client reads the reply',
  summary:
  'The client gets HELLO SERVER and prints it. The whole exchange took two packets. The same echo over TCP took ten.',
  kernel:
  'Takes the datagram off the queue and copies it out. If the reply had been lost, this recvfrom() would wait forever. Real UDP apps add their own timeouts and retries.',
  client: {
    status: 'running',
    note: 'Printed HELLO SERVER',
    line: 5,
    syscall: 'recvfrom()',
    sockets: [cliSock()]
  },
  server: { status: 'running', note: 'Reply sent', line: 5, sockets: [srvSock()] }
},
{
  id: 'udp-cli-close',
  phase: 'teardown',
  actor: 'client',
  call: 'close()',
  title: 'close() frees the socket immediately',
  summary:
  'There’s no FIN and no TIME_WAIT, and nothing goes on the wire. The socket is simply gone. The server is never told, and it knows nothing about the client beyond that one datagram.',
  kernel: 'Releases the fd, discards any queued datagrams, and frees port 41022 so it can be reused right away.',
  client: { status: 'done', note: 'close() returned. Socket freed', line: 6, syscall: 'close()', sockets: [] },
  server: { status: 'running', note: 'Unaware the client is gone', line: 5, sockets: [srvSock()] }
},
{
  id: 'udp-srv-close',
  phase: 'teardown',
  actor: 'server',
  call: 'close()',
  title: 'The server closes too',
  summary:
  'The server’s socket and port are freed immediately as well. In the TCP version, closing took three packets and a 60-second TIME_WAIT.',
  kernel: 'Removes the socket from the UDP port table and frees it.',
  client: { status: 'done', note: 'Process finished', line: 6, sockets: [] },
  server: { status: 'done', note: 'close() returned. Socket freed', line: 6, syscall: 'close()', sockets: [] }
}];