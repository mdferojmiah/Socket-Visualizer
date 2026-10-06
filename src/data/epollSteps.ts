import type { EpollSocket, EpollStep } from '../types/epoll';

const listener = (o: Partial<EpollSocket> = {}): EpollSocket => ({
  fd: 3,
  role: 'listener',
  state: 'LISTEN',
  local: '0.0.0.0:8080',
  acceptQueue: [],
  hooked: true,
  ...o
});

const conn5 = (o: Partial<EpollSocket> = {}): EpollSocket => ({
  fd: 5,
  role: 'connection',
  state: 'ESTABLISHED',
  local: '10.0.0.2:8080',
  remote: '10.0.0.7:51200',
  recvBuf: '',
  hooked: true,
  ...o
});

const conn6 = (o: Partial<EpollSocket> = {}): EpollSocket => ({
  fd: 6,
  role: 'connection',
  state: 'ESTABLISHED',
  local: '10.0.0.2:8080',
  remote: '10.0.0.9:40318',
  recvBuf: '',
  hooked: true,
  ...o
});

const waiting = (note: string) => ({ status: 'blocked' as const, note, line: 5, syscall: 'epoll_wait()' });

export const epollSteps: EpollStep[] = [
{
  id: 'ep-listen',
  phase: 'setup',
  actor: 'server',
  call: 'socket() → bind() → listen()',
  title: 'Start with an ordinary listening socket',
  summary:
  'epoll doesn’t replace sockets. It works alongside them. First the server makes the same listening socket as in the TCP walkthrough: fd 3, in LISTEN, with an empty accept queue.',
  kernel:
  'Every socket has a wait queue (sk_wq). A blocking accept() or recv() would put the process to sleep on it. epoll’s whole trick is to put something else on that queue instead.',
  process: { status: 'running', note: 'fd 3 is listening on :8080', line: 2, syscall: 'listen()' },
  epoll: false,
  interest: [],
  ready: [],
  sleeping: false,
  sockets: [listener({ hooked: false })],
  path: 0
},
{
  id: 'ep-create',
  phase: 'setup',
  actor: 'server',
  call: 'epoll_create1(0)',
  title: 'epoll_create1() makes an epoll instance, which is also a file',
  summary:
  'The kernel returns fd 4. It isn’t a socket. It’s a handle to a kernel object called eventpoll, which will keep track of other fds for you. Because it’s a file, you can close it, pass it to a child process, or even watch it with another epoll.',
  kernel:
  'ep_alloc() allocates a struct eventpoll with three empty parts: a red-black tree of the fds you want to watch (rbr), a linked list of fds that are ready (rdllist), and a wait queue for threads asleep in epoll_wait (wq). anon_inode_getfile("[eventpoll]") wraps it in a file and installs it as fd 4.',
  process: { status: 'running', note: 'Got back fd 4, an epoll instance', line: 3, syscall: 'epoll_create1()' },
  epoll: true,
  interest: [],
  ready: [],
  sleeping: false,
  sockets: [listener({ hooked: false })],
  path: 0
},
{
  id: 'ep-ctl-listen',
  phase: 'setup',
  actor: 'server',
  call: 'epoll_ctl(4, ADD, 3, EPOLLIN)',
  title: 'epoll_ctl(ADD) hooks a callback into the socket',
  summary:
  'This is where epoll and the socket connect. The kernel creates an epitem for fd 3, adds it to the interest tree, then puts a small callback entry on the socket’s own wait queue. From now on, whenever the socket wakes its waiters, epoll is notified.',
  kernel:
  'ep_insert() allocates the epitem and inserts it into rbr, keyed by file and fd. It then calls the socket’s poll function (tcp_poll) with a special poll table. That table’s queue function, ep_ptable_queue_proc, adds an eppoll_entry to sk_wq with ep_poll_callback as its wake function. The same poll call also returns the current mask. Nothing is ready yet, so the ready list stays empty.',
  process: { status: 'running', note: 'Watching fd 3 for EPOLLIN', line: 4, syscall: 'epoll_ctl()' },
  epoll: true,
  interest: [3],
  ready: [],
  sleeping: false,
  sockets: [listener()],
  hot: 3,
  path: 0
},
{
  id: 'ep-wait-1',
  phase: 'setup',
  actor: 'server',
  call: 'epoll_wait(4, events, 64, -1)',
  title: 'epoll_wait() sleeps on the epoll instance, not on the socket',
  summary:
  'Nothing is ready, so the process goes to sleep. Notice where it sleeps: on eventpoll’s wait queue, not on fd 3. That’s why one sleeping thread can wait on any number of sockets.',
  kernel:
  'ep_poll() checks rdllist. It’s empty, so the task adds itself to ep->wq and calls schedule(). Unlike select() and poll(), it doesn’t loop over the watched fds. No per-socket work happens on entry, however many fds are registered.',
  process: waiting('Asleep in epoll_wait(): ready list is empty'),
  epoll: true,
  interest: [3],
  ready: [],
  sleeping: true,
  sockets: [listener()],
  path: 0
},
{
  id: 'ep-syn',
  phase: 'connect',
  actor: 'kernel',
  call: 'SYN → SYN-ACK → ACK',
  title: 'A client connects, and the socket’s wakeup becomes an epoll event',
  summary:
  'The handshake happens entirely inside the kernel, and the new connection lands in fd 3’s accept queue. The socket then wakes everything on its wait queue. The only thing there is epoll’s callback, which puts fd 3 on the ready list and wakes the sleeping process.',
  kernel:
  'tcp_v4_rcv() completes the handshake and queues the new child socket with inet_csk_reqsk_queue_add(). The listener’s sk_data_ready (sock_def_readable) calls wake_up on sk_wq, which runs ep_poll_callback(). That adds the epitem to the end of rdllist in O(1) and calls wake_up(&ep->wq). All of this runs in softirq context while the process is still asleep.',
  process: { ...waiting('Woken: the ready list has 1 entry'), status: 'blocked' },
  epoll: true,
  interest: [3],
  ready: [3],
  sleeping: false,
  sockets: [listener({ acceptQueue: ['10.0.0.7:51200'] })],
  hot: 3,
  path: 7,
  packet: { label: 'SYN … ACK', from: '10.0.0.7:51200' }
},
{
  id: 'ep-ret-1',
  phase: 'connect',
  actor: 'server',
  call: 'epoll_wait() → 1 event',
  title: 'epoll_wait() returns only what’s ready',
  summary:
  'The process wakes up with one event: fd 3 is readable, which means a connection is waiting to be accepted. It didn’t have to check the socket. The answer was already on the ready list.',
  kernel:
  'ep_send_events() moves the ready list aside, re-polls each item for its current mask, and copies {EPOLLIN, fd 3} into the user’s array. In the default level-triggered mode, an item that’s still ready goes back on rdllist. The accept queue still has a connection, so fd 3 goes back on the list.',
  process: { status: 'running', note: 'epoll_wait() returned 1', line: 5, syscall: 'epoll_wait()' },
  epoll: true,
  interest: [3],
  ready: [3],
  sleeping: false,
  sockets: [listener({ acceptQueue: ['10.0.0.7:51200'] })],
  returned: [{ fd: 3, events: 'EPOLLIN' }],
  hot: 3,
  path: 0
},
{
  id: 'ep-accept',
  phase: 'connect',
  actor: 'server',
  call: 'accept(3) → 5',
  title: 'accept() returns a new connection socket, fd 5',
  summary:
  'accept() takes the connection off the queue and gives it its own fd. fd 5 is a brand-new socket with its own buffers and its own wait queue, and epoll doesn’t know about it yet.',
  kernel:
  'fd 3’s epitem is still on the ready list from the level-triggered re-queue. That’s harmless. The next epoll_wait re-polls it, finds the accept queue empty, and drops it without reporting anything.',
  process: { status: 'running', note: 'accept() returned fd 5', line: 6, syscall: 'accept()' },
  epoll: true,
  interest: [3],
  ready: [3],
  sleeping: false,
  sockets: [listener(), conn5({ hooked: false })],
  returned: [{ fd: 3, events: 'EPOLLIN' }],
  path: 0
},
{
  id: 'ep-ctl-5',
  phase: 'connect',
  actor: 'server',
  call: 'epoll_ctl(4, ADD, 5, EPOLLIN)',
  title: 'fd 5 is registered the same way',
  summary:
  'Another epitem and another callback, this time on fd 5’s wait queue. The interest tree now holds two different kinds of socket, and epoll handles them exactly the same way.',
  kernel:
  'ep_insert() runs again: an O(log n) tree insert, then tcp_poll() with the queueing poll table adds ep_poll_callback to fd 5’s sk_wq. epoll can watch anything whose poll function uses wait queues, including sockets, pipes, eventfds, timerfds and even other epoll fds.',
  process: { status: 'running', note: 'Watching fd 5 for EPOLLIN', line: 7, syscall: 'epoll_ctl()' },
  epoll: true,
  interest: [3, 5],
  ready: [3],
  sleeping: false,
  sockets: [listener(), conn5()],
  returned: [{ fd: 3, events: 'EPOLLIN' }],
  hot: 5,
  path: 0
},
{
  id: 'ep-ctl-6',
  phase: 'connect',
  actor: 'server',
  call: 'accept() → 6 · epoll_ctl(4, ADD, 6)',
  title: 'A second client joins as fd 6',
  summary:
  'The same cycle repeats for a second client: the listener fires, accept() returns fd 6, and epoll_ctl hooks it. Now one epoll instance is watching three sockets.',
  kernel:
  'The interest tree rebalances as it grows, so adding, changing and removing fds stays O(log n) even with 100,000 of them. Each epitem stores the fd, the event mask you asked for, its tree node, a link for the ready list, and the wait queues it’s hooked into.',
  process: { status: 'running', note: 'A second client, fd 6, is registered', line: 7, syscall: 'epoll_ctl()' },
  epoll: true,
  interest: [3, 5, 6],
  ready: [],
  sleeping: false,
  sockets: [listener(), conn5(), conn6()],
  hot: 6,
  path: 0
},
{
  id: 'ep-wait-2',
  phase: 'data',
  actor: 'server',
  call: 'epoll_wait(4, events, 64, -1)',
  title: 'Three sockets, one sleeping thread, no polling',
  summary:
  'The server waits again. It’s watching three sockets but uses no CPU on them while they’re quiet. With select(), it would rebuild a bitmap of every fd on each call, and the kernel would check every one.',
  kernel:
  'ep_poll() finds rdllist empty and sleeps on ep->wq. The cost is now split: you pay for registration once in epoll_ctl, and waiting costs O(1) plus the number of ready events. select() and poll() pay O(n) on every call.',
  process: waiting('Asleep in epoll_wait(): 3 sockets watched, none ready'),
  epoll: true,
  interest: [3, 5, 6],
  ready: [],
  sleeping: true,
  sockets: [listener(), conn5(), conn6()],
  path: 0
},
{
  id: 'ep-data',
  phase: 'data',
  actor: 'kernel',
  call: '"hello" arrives for fd 6',
  title: 'Data arrives on fd 6, and only fd 6 is marked ready',
  summary:
  'Five bytes land in fd 6’s receive buffer. The socket wakes its wait queue, epoll’s callback runs, and fd 6 joins the ready list. fd 3 and fd 5 aren’t touched at all.',
  kernel:
  'tcp_rcv_established() adds the data to sk_receive_queue and calls sk_data_ready. The wakeup includes the event mask (EPOLLIN), so ep_poll_callback can ignore events the epitem didn’t ask for. The ACK for these bytes goes out without involving the app.',
  process: waiting('Woken: fd 6 is ready'),
  epoll: true,
  interest: [3, 5, 6],
  ready: [6],
  sleeping: false,
  sockets: [listener(), conn5(), conn6({ recvBuf: 'hello' })],
  hot: 6,
  path: 7,
  packet: { label: 'PSH "hello"', from: '10.0.0.9:40318' }
},
{
  id: 'ep-ret-2',
  phase: 'data',
  actor: 'server',
  call: 'epoll_wait() → 1 event',
  title: 'The process gets fd 6 directly, without searching',
  summary:
  'epoll_wait returns one event. The work it did depended on the 1 ready socket, not the 3 being watched. With 10,000 mostly idle connections, that’s the difference between epoll and select().',
  kernel:
  'This is level-triggered again: the receive buffer still holds 5 bytes, so after the event is reported, the epitem goes back on rdllist. With EPOLLET (edge-triggered), it wouldn’t go back. You’d get one notification each time data arrives, and you’d have to keep reading until EAGAIN.',
  process: { status: 'running', note: 'epoll_wait() returned 1', line: 5, syscall: 'epoll_wait()' },
  epoll: true,
  interest: [3, 5, 6],
  ready: [6],
  sleeping: false,
  sockets: [listener(), conn5(), conn6({ recvBuf: 'hello' })],
  returned: [{ fd: 6, events: 'EPOLLIN' }],
  hot: 6,
  path: 0
},
{
  id: 'ep-recv',
  phase: 'data',
  actor: 'server',
  call: 'recv(6, 1024) → "hello"',
  title: 'recv() reads from the socket as usual',
  summary:
  'epoll only tells you which fd to read. The reading itself is still a normal recv() on the socket. The data is copied out, and the receive buffer is empty again.',
  kernel:
  'fd 6 is still on the ready list from the level-triggered re-queue. On the next epoll_wait it will be re-polled, tcp_poll will report no data, and it will be dropped. That’s why level-triggered mode is forgiving: if you hadn’t read everything, epoll would simply tell you again.',
  process: { status: 'running', note: 'Read 5 bytes from fd 6', line: 8, syscall: 'recv()' },
  epoll: true,
  interest: [3, 5, 6],
  ready: [6],
  sleeping: false,
  sockets: [listener(), conn5(), conn6()],
  returned: [{ fd: 6, events: 'EPOLLIN' }],
  hot: 6,
  path: 0
},
{
  id: 'ep-wait-3',
  phase: 'data',
  actor: 'server',
  call: 'epoll_wait(4, events, 64, -1)',
  title: 'Back to sleep, and the stale entry disappears',
  summary:
  'The loop goes back to epoll_wait. fd 6 is checked again, has nothing left to read, and is taken off the ready list without being reported. The process goes back to sleep.',
  kernel:
  'ep_send_events() re-polls each item before reporting it, so an item that’s no longer ready is never returned. With rdllist now empty, ep_poll() sleeps on ep->wq.',
  process: waiting('Asleep in epoll_wait()'),
  epoll: true,
  interest: [3, 5, 6],
  ready: [],
  sleeping: true,
  sockets: [listener(), conn5(), conn6()],
  path: 0
},
{
  id: 'ep-fin',
  phase: 'teardown',
  actor: 'kernel',
  call: 'FIN arrives for fd 5',
  title: 'A client hangs up, which also counts as readable',
  summary:
  'The client on fd 5 closes its side. The FIN moves the socket to CLOSE_WAIT and wakes its wait queue through the same callback path. epoll reports EPOLLIN, because a read would now return 0 instead of blocking.',
  kernel:
  'tcp_fin() sets RCV_SHUTDOWN and calls sk_state_change, which wakes sk_wq with EPOLLIN | EPOLLRDHUP. ep_poll_callback queues fd 5’s epitem and wakes the sleeping process. Register EPOLLRDHUP if you want to tell a hang-up apart from normal data without calling recv().',
  process: waiting('Woken: fd 5 is ready'),
  epoll: true,
  interest: [3, 5, 6],
  ready: [5],
  sleeping: false,
  sockets: [listener(), conn5({ state: 'CLOSE_WAIT' }), conn6()],
  hot: 5,
  path: 7,
  packet: { label: 'FIN', from: '10.0.0.7:51200' }
},
{
  id: 'ep-eof',
  phase: 'teardown',
  actor: 'server',
  call: 'epoll_wait() → fd 5 · recv() → 0',
  title: 'recv() returns 0, so the server knows the client has gone',
  summary:
  'The server gets fd 5 from epoll_wait, calls recv(), and gets 0 bytes, which signals the end of the stream. Time to clean up.',
  kernel:
  'Nothing new happens in the kernel: recv() sees RCV_SHUTDOWN with an empty buffer and returns 0. Because fd 5 is level-triggered, epoll would keep reporting it as readable until it’s closed.',
  process: { status: 'running', note: 'recv() returned 0: the peer closed', line: 8, syscall: 'recv()' },
  epoll: true,
  interest: [3, 5, 6],
  ready: [5],
  sleeping: false,
  sockets: [listener(), conn5({ state: 'CLOSE_WAIT' }), conn6()],
  returned: [{ fd: 5, events: 'EPOLLIN' }],
  hot: 5,
  path: 0
},
{
  id: 'ep-close',
  phase: 'teardown',
  actor: 'server',
  call: 'close(5)',
  title: 'close() also removes the socket from epoll',
  summary:
  'Closing fd 5 shuts down the socket and automatically removes its epitem from the interest tree and its callback from the wait queue. epoll is left watching fd 3 and fd 6, ready for the next loop.',
  kernel:
  'When the last reference to the file is released, __fput() calls eventpoll_release(), which runs ep_remove(). That unhooks the eppoll_entry from the socket’s wait queue, removes the epitem from rbr, and unlinks it from rdllist. One gotcha: if the fd was dup()’d or inherited by a child process, the file stays open and the epitem stays registered.',
  process: { status: 'running', note: 'fd 5 closed and removed from epoll', line: 10, syscall: 'close()' },
  epoll: true,
  interest: [3, 6],
  ready: [],
  sleeping: false,
  sockets: [listener(), conn6()],
  returned: [{ fd: 5, events: 'EPOLLIN' }],
  path: 0
}];