import { defineSource } from '../utils/kernelSource';

const sysSocket = ['__x64_sys_socket'];
const sysBind = ['__x64_sys_bind'];
const sysListen = ['__x64_sys_listen'];
const sysAccept = ['__x64_sys_accept'];

export const socketSource = defineSource({
  id: 'socket',
  label: 'socket()',
  file: 'net/socket.c · net/ipv4/af_inet.c',
  returns: '3',
  src: [
  '// net/socket.c (simplified from Linux 6.x)',
  ['SYSCALL_DEFINE3(socket, int, family, int, type, int, protocol)', 'entry'],
  '{',
  ['  return __sys_socket(family, type, protocol);', 'call'],
  '}',
  '',
  'int __sys_socket(int family, int type, int protocol)',
  '{',
  ['  struct socket *sock = sock_create(family, type, protocol);', 'create'],
  '  if (IS_ERR(sock))',
  '    return PTR_ERR(sock);            // e.g. -EAFNOSUPPORT',
  ['  return sock_map_fd(sock, flags);   // socket → file → fd', 'map'],
  '}',
  '',
  '// net/ipv4/af_inet.c: AF_INET’s create() hook',
  'static int inet_create(struct net *net, struct socket *sock, int protocol)',
  '{',
  ['  sock->ops = &inet_stream_ops;       // SOCK_STREAM → TCP', 'ops'],
  ['  sk = sk_alloc(net, PF_INET, GFP_KERNEL, &tcp_prot);', 'skalloc'],
  ['  sock_init_data(sock, sk);           // empty send + receive queues', 'init'],
  ['  sk->sk_state = TCP_CLOSE;', 'state'],
  '  return sk->sk_prot->init(sk);       // tcp_v4_init_sock()',
  '}',
  '',
  'static int sock_map_fd(struct socket *sock, int flags)',
  '{',
  ['  int fd = get_unused_fd_flags(flags);   // lowest free slot', 'fd'],
  ['  struct file *f = sock_alloc_file(sock, flags);', 'file'],
  ['  fd_install(fd, f);', 'install'],
  ['  return fd;', 'ret'],
  '}'],

  breakpoints: ['create', 'fd'],
  trace: [
  {
    at: 'entry',
    stack: sysSocket,
    locals: [['family', 'AF_INET (2)'], ['type', 'SOCK_STREAM (1)'], ['protocol', '0']],
    note: 'The syscall instruction switched the CPU into kernel mode. The three arguments arrive in registers rdi, rsi and rdx.'
  },
  {
    at: 'call',
    stack: sysSocket,
    locals: [['family', 'AF_INET (2)'], ['type', 'SOCK_STREAM (1)'], ['protocol', '0']],
    note: 'The SYSCALL_DEFINE wrapper just unpacks registers and forwards to the real implementation.'
  },
  {
    at: 'create',
    stack: ['__sys_socket', ...sysSocket],
    locals: [['family', 'AF_INET (2)'], ['type', 'SOCK_STREAM (1)'], ['sock', '(not yet)']],
    note: 'sock_create() allocates a generic struct socket, then looks up net_families[AF_INET] to find who knows how to build an IPv4 socket.'
  },
  {
    at: 'ops',
    stack: ['inet_create', '__sock_create', '__sys_socket', ...sysSocket],
    locals: [['sock', '0xffff888104a1c000'], ['sock->type', 'SOCK_STREAM'], ['protocol', 'IPPROTO_TCP (6)']],
    note: 'protocol 0 means “the default for this type”, which for SOCK_STREAM is TCP. The socket gets TCP’s table of operations: bind, listen, accept, sendmsg…'
  },
  {
    at: 'skalloc',
    stack: ['inet_create', '__sock_create', '__sys_socket', ...sysSocket],
    locals: [['sock', '0xffff888104a1c000'], ['sk', '0xffff88810b7e2300'], ['sk->sk_prot', '&tcp_prot']],
    note: 'sk_alloc() creates the real protocol state, a struct tcp_sock of about 2 KB: sequence numbers, timers, congestion control and queues.'
  },
  {
    at: 'init',
    stack: ['inet_create', '__sock_create', '__sys_socket', ...sysSocket],
    locals: [['sk', '0xffff88810b7e2300'], ['sk->sk_sndbuf', '16384'], ['sk->sk_rcvbuf', '131072']],
    note: 'Send and receive queues start empty. Their size limits come from net.ipv4.tcp_wmem and tcp_rmem.'
  },
  {
    at: 'state',
    stack: ['inet_create', '__sock_create', '__sys_socket', ...sysSocket],
    locals: [['sk', '0xffff88810b7e2300'], ['sk->sk_state', 'TCP_CLOSE']],
    note: 'Every TCP socket starts in CLOSED. bind(), listen() and connect() move it along the state machine.'
  },
  {
    at: 'map',
    stack: ['__sys_socket', ...sysSocket],
    locals: [['sock', '0xffff888104a1c000'], ['flags', '0']],
    note: 'The socket exists, but your program can’t name it yet. It needs a file descriptor.'
  },
  {
    at: 'fd',
    stack: ['sock_map_fd', '__sys_socket', ...sysSocket],
    locals: [['fd', '3'], ['files->next_fd', '3']],
    note: 'Scans the process’s fd bitmap for the lowest free slot. 0, 1 and 2 are stdin, stdout and stderr, so it gets 3.'
  },
  {
    at: 'file',
    stack: ['sock_map_fd', '__sys_socket', ...sysSocket],
    locals: [['fd', '3'], ['f', '0xffff888106d3e900'], ['f->f_op', '&socket_file_ops']],
    note: 'Wraps the socket in a struct file. That’s why read(), write(), close() and epoll work on sockets like on any other file.'
  },
  {
    at: 'install',
    stack: ['sock_map_fd', '__sys_socket', ...sysSocket],
    locals: [['fd', '3'], ['fdt->fd[3]', '0xffff888106d3e900']],
    note: 'Publishes the file in slot 3 of the fd table. From this instant, other threads in the process could use fd 3.'
  },
  {
    at: 'ret',
    stack: ['sock_map_fd', '__sys_socket', ...sysSocket],
    locals: [['fd', '3']],
    note: 'The integer travels back up the stack and lands in rax, which libc returns to your program.'
  }]

});

export const bindSource = defineSource({
  id: 'bind',
  label: 'bind()',
  file: 'net/socket.c · net/ipv4/af_inet.c',
  returns: '0',
  src: [
  '// net/socket.c',
  ['SYSCALL_DEFINE3(bind, int, fd, struct sockaddr __user *, umyaddr, int, addrlen)', 'entry'],
  '{',
  ['  return __sys_bind(fd, umyaddr, addrlen);', 'call'],
  '}',
  '',
  'int __sys_bind(int fd, struct sockaddr __user *umyaddr, int addrlen)',
  '{',
  '  struct sockaddr_storage address;',
  ['  struct socket *sock = sockfd_lookup_light(fd, &err);   // fd → socket', 'lookup'],
  ['  err = move_addr_to_kernel(umyaddr, addrlen, &address); // copy_from_user', 'copy'],
  ['  err = sock->ops->bind(sock, (struct sockaddr *)&address, addrlen);', 'ops'],
  '  return err;',
  '}',
  '',
  '// net/ipv4/af_inet.c',
  'int __inet_bind(struct sock *sk, struct sockaddr *uaddr, int addr_len)',
  '{',
  '  struct sockaddr_in *addr = (struct sockaddr_in *)uaddr;',
  ['  unsigned short snum = ntohs(addr->sin_port);', 'port'],
  ['  if (snum < PROT_SOCK && !capable(CAP_NET_BIND_SERVICE))', 'priv'],
  '    return -EACCES;                          // ports < 1024 need privilege',
  ['  inet->inet_rcv_saddr = addr->sin_addr.s_addr;', 'addr'],
  ['  if (sk->sk_prot->get_port(sk, snum))      // inet_csk_get_port()', 'getport'],
  '    return -EADDRINUSE;                      // someone already owns it',
  ['  inet->inet_sport = htons(snum);', 'sport'],
  ['  return 0;', 'ret'],
  '}'],

  breakpoints: ['copy', 'getport'],
  trace: [
  {
    at: 'entry',
    stack: sysBind,
    locals: [['fd', '3'], ['umyaddr', '0x7ffd5b2c1a40 (user)'], ['addrlen', '16']],
    note: 'umyaddr points into your program’s memory. The kernel never trusts a user pointer directly.'
  },
  {
    at: 'call',
    stack: sysBind,
    locals: [['fd', '3'], ['addrlen', '16']],
    note: 'Forward to the real implementation.'
  },
  {
    at: 'lookup',
    stack: ['__sys_bind', ...sysBind],
    locals: [['fd', '3'], ['sock', '0xffff888104a1c000']],
    note: 'fd 3 → struct file → struct socket. A bad number here is how you get EBADF or ENOTSOCK.'
  },
  {
    at: 'copy',
    stack: ['__sys_bind', ...sysBind],
    locals: [['sock', '0xffff888104a1c000'], ['address.sin_family', 'AF_INET'], ['address.sin_port', '0x901f (8080, network order)']],
    note: 'Copies the 16-byte sockaddr_in from user space into a kernel buffer, safely, with copy_from_user().'
  },
  {
    at: 'ops',
    stack: ['__sys_bind', ...sysBind],
    locals: [['sock->ops', '&inet_stream_ops']],
    note: 'Dispatch through the protocol’s operation table, which leads to inet_bind() for IPv4.'
  },
  {
    at: 'port',
    stack: ['__inet_bind', 'inet_bind', '__sys_bind', ...sysBind],
    locals: [['snum', '8080'], ['addr->sin_addr', '0.0.0.0 (INADDR_ANY)']],
    note: 'ntohs() turns the big-endian port from the wire format back into a normal number.'
  },
  {
    at: 'priv',
    stack: ['__inet_bind', 'inet_bind', '__sys_bind', ...sysBind],
    locals: [['snum', '8080'], ['PROT_SOCK', '1024']],
    note: '8080 is above 1024, so no special privilege is needed.'
  },
  {
    at: 'addr',
    stack: ['__inet_bind', 'inet_bind', '__sys_bind', ...sysBind],
    locals: [['snum', '8080'], ['inet_rcv_saddr', '0.0.0.0']],
    note: '0.0.0.0 means “accept packets that arrive on any local interface”.'
  },
  {
    at: 'getport',
    stack: ['inet_csk_get_port', '__inet_bind', 'inet_bind', '__sys_bind', ...sysBind],
    locals: [['snum', '8080'], ['bhash bucket', 'empty → free']],
    note: 'Looks up port 8080 in the bind hash table. The bucket is empty, so the socket is added to it. A second server would get EADDRINUSE here.'
  },
  {
    at: 'sport',
    stack: ['__inet_bind', 'inet_bind', '__sys_bind', ...sysBind],
    locals: [['inet_sport', '0x901f'], ['sk_state', 'TCP_CLOSE']],
    note: 'The socket now has a local name, 0.0.0.0:8080. Its state is still CLOSED.'
  },
  {
    at: 'ret',
    stack: ['__inet_bind', 'inet_bind', '__sys_bind', ...sysBind],
    locals: [['err', '0']],
    note: 'Success. Nothing was sent on the network.'
  }]

});

export const listenSource = defineSource({
  id: 'listen',
  label: 'listen()',
  file: 'net/socket.c · net/ipv4/inet_connection_sock.c',
  returns: '0',
  src: [
  '// net/socket.c',
  ['SYSCALL_DEFINE2(listen, int, fd, int, backlog)', 'entry'],
  '{',
  ['  struct socket *sock = sockfd_lookup_light(fd, &err);', 'lookup'],
  ['  int somaxconn = sock_net(sock->sk)->core.sysctl_somaxconn;', 'somax'],
  ['  if ((unsigned int)backlog > somaxconn)', 'clamp'],
  '    backlog = somaxconn;               // capped by net.core.somaxconn',
  ['  return sock->ops->listen(sock, backlog);   // inet_listen()', 'ops'],
  '}',
  '',
  '// net/ipv4/af_inet.c',
  'int inet_listen(struct socket *sock, int backlog)',
  '{',
  ['  if (sock->state != SS_UNCONNECTED || sock->type != SOCK_STREAM)', 'check'],
  '    return -EINVAL;',
  ['  WRITE_ONCE(sk->sk_max_ack_backlog, backlog);   // accept queue limit', 'backlog'],
  ['  return inet_csk_listen_start(sk);', 'start'],
  '}',
  '',
  '// net/ipv4/inet_connection_sock.c',
  'int inet_csk_listen_start(struct sock *sk)',
  '{',
  ['  reqsk_queue_alloc(&icsk->icsk_accept_queue);   // SYN + accept queues', 'queues'],
  ['  inet_sk_state_store(sk, TCP_LISTEN);', 'state'],
  ['  sk->sk_prot->hash(sk);   // SYNs for :8080 can now find this socket', 'hash'],
  ['  return 0;', 'ret'],
  '}'],

  breakpoints: ['ops', 'state'],
  trace: [
  {
    at: 'entry',
    stack: sysListen,
    locals: [['fd', '3'], ['backlog', '5']],
    note: 'listen() takes just the fd and the backlog, the number of finished connections allowed to wait for accept().'
  },
  {
    at: 'lookup',
    stack: sysListen,
    locals: [['fd', '3'], ['sock', '0xffff888104a1c000']],
    note: 'Resolve fd 3 to its socket, as every socket syscall does.'
  },
  {
    at: 'somax',
    stack: sysListen,
    locals: [['backlog', '5'], ['somaxconn', '4096']],
    note: 'The system-wide ceiling. Asking for listen(100000) silently gives you somaxconn.'
  },
  {
    at: 'clamp',
    stack: sysListen,
    locals: [['backlog', '5'], ['somaxconn', '4096']],
    note: '5 is below the ceiling, so it’s kept.'
  },
  {
    at: 'ops',
    stack: sysListen,
    locals: [['sock->ops', '&inet_stream_ops']],
    note: 'Hand off to the IPv4 stream implementation.'
  },
  {
    at: 'check',
    stack: ['inet_listen', ...sysListen],
    locals: [['sock->state', 'SS_UNCONNECTED'], ['sock->type', 'SOCK_STREAM']],
    note: 'Only an unconnected stream socket can listen. A socket that is already connected fails here with EINVAL.'
  },
  {
    at: 'backlog',
    stack: ['inet_listen', ...sysListen],
    locals: [['sk_max_ack_backlog', '5']],
    note: 'When the accept queue holds 5 connections, new handshakes are dropped until the app calls accept().'
  },
  {
    at: 'start',
    stack: ['inet_listen', ...sysListen],
    locals: [['sk', '0xffff88810b7e2300']],
    note: 'Now set up the connection-oriented machinery.'
  },
  {
    at: 'queues',
    stack: ['inet_csk_listen_start', 'inet_listen', ...sysListen],
    locals: [['accept_queue.rskq_accept_head', 'NULL'], ['qlen (SYN queue)', '0']],
    note: 'Two queues are created: half-open handshakes (SYN_RCVD) and completed connections waiting for accept().'
  },
  {
    at: 'state',
    stack: ['inet_csk_listen_start', 'inet_listen', ...sysListen],
    locals: [['sk->sk_state', 'TCP_LISTEN']],
    note: 'The socket becomes a receptionist. It will never carry data itself.'
  },
  {
    at: 'hash',
    stack: ['inet_csk_listen_start', 'inet_listen', ...sysListen],
    locals: [['listening_hash[8080]', '→ sk']],
    note: 'Inserted into the listening hash. From now on, an incoming SYN for port 8080 is matched to this socket, and the kernel answers the handshake without waking your process.'
  },
  {
    at: 'ret',
    stack: ['inet_csk_listen_start', 'inet_listen', ...sysListen],
    locals: [['err', '0']],
    note: 'listen() never blocks. It returns as soon as the queues exist.'
  }]

});

export const acceptSource = defineSource({
  id: 'accept',
  label: 'accept()',
  file: 'net/socket.c · net/ipv4/inet_connection_sock.c',
  returns: '4',
  src: [
  '// net/socket.c',
  ['SYSCALL_DEFINE3(accept, int, fd, struct sockaddr __user *, upeer, int __user *, len)', 'entry'],
  '{',
  ['  return __sys_accept4(fd, upeer, len, 0);', 'call'],
  '}',
  '',
  'struct file *do_accept(struct file *file, ...)',
  '{',
  ['  struct socket *newsock = sock_alloc();          // empty shell for the child', 'alloc'],
  ['  int newfd = get_unused_fd_flags(flags);          // will become 4', 'newfd'],
  ['  err = sock->ops->accept(sock, newsock, flags);   // inet_accept()', 'ops'],
  '  fd_install(newfd, newfile);',
  ['  return newfd;', 'ret'],
  '}',
  '',
  '// net/ipv4/inet_connection_sock.c',
  'struct sock *inet_csk_accept(struct sock *sk, int flags, int *err)',
  '{',
  ['  if (reqsk_queue_empty(&icsk->icsk_accept_queue)) {', 'empty'],
  '    long timeo = sock_rcvtimeo(sk, flags & O_NONBLOCK);',
  '    if (!timeo) return ERR_PTR(-EAGAIN);          // non-blocking socket',
  ['    error = inet_csk_wait_for_connect(sk, timeo);', 'wait'],
  '  }',
  ['  req = reqsk_queue_remove(queue, sk);            // dequeue the child', 'dequeue'],
  ['  newsk = req->sk;                                 // ESTABLISHED, 4-tuple set', 'newsk'],
  '  return newsk;',
  '}',
  '',
  'static int inet_csk_wait_for_connect(struct sock *sk, long timeo)',
  '{',
  ['  prepare_to_wait_exclusive(sk_sleep(sk), &wait, TASK_INTERRUPTIBLE);', 'prep'],
  ['  timeo = schedule_timeout(timeo);    // give the CPU away', 'sched'],
  ['  finish_wait(sk_sleep(sk), &wait);   // woken by the final ACK', 'finish'],
  '  return 0;',
  '}'],

  breakpoints: ['empty', 'dequeue'],
  trace: [
  {
    at: 'entry',
    stack: sysAccept,
    locals: [['fd', '3 (listener)'], ['upeer', 'NULL'], ['len', 'NULL']],
    note: 'accept() is called on the listening socket. Passing NULL means “I don’t need the client’s address”.'
  },
  {
    at: 'call',
    stack: sysAccept,
    locals: [['fd', '3'], ['flags', '0']],
    note: 'accept() is accept4() with no flags.'
  },
  {
    at: 'alloc',
    stack: ['do_accept', '__sys_accept4', ...sysAccept],
    locals: [['newsock', '0xffff888104a1d400']],
    note: 'A fresh socket object is prepared up front. It will be filled in with the connection that comes off the queue.'
  },
  {
    at: 'newfd',
    stack: ['do_accept', '__sys_accept4', ...sysAccept],
    locals: [['newsock', '0xffff888104a1d400'], ['newfd', '4']],
    note: 'The fd is reserved now, but not installed. If anything fails, it’s handed back.'
  },
  {
    at: 'ops',
    stack: ['do_accept', '__sys_accept4', ...sysAccept],
    locals: [['sock->ops', '&inet_stream_ops']],
    note: 'inet_accept() → inet_csk_accept(), the TCP-specific part.'
  },
  {
    at: 'empty',
    stack: ['inet_csk_accept', 'inet_accept', 'do_accept', '__sys_accept4', ...sysAccept],
    locals: [['accept_queue', '[] (empty)'], ['timeo', 'MAX_SCHEDULE_TIMEOUT']],
    note: 'No client has finished a handshake yet, and the socket is blocking. So the process has to wait.'
  },
  {
    at: 'wait',
    stack: ['inet_csk_accept', 'inet_accept', 'do_accept', '__sys_accept4', ...sysAccept],
    locals: [['timeo', 'MAX_SCHEDULE_TIMEOUT']],
    note: 'Go to sleep until a connection arrives.'
  },
  {
    at: 'prep',
    stack: ['inet_csk_wait_for_connect', 'inet_csk_accept', 'inet_accept', 'do_accept', '__sys_accept4', ...sysAccept],
    locals: [['current->__state', 'TASK_INTERRUPTIBLE'], ['sk_sleep(sk)', '1 waiter']],
    note: 'The process adds itself to the listener’s wait queue. Exclusive means only one waiter is woken per connection, avoiding a thundering herd.'
  },
  {
    at: 'sched',
    stack: ['schedule', 'inet_csk_wait_for_connect', 'inet_csk_accept', 'inet_accept', 'do_accept', '__sys_accept4', ...sysAccept],
    locals: [['current->__state', 'TASK_INTERRUPTIBLE'], ['CPU usage', '0%']],
    note: 'schedule() switches to another task. This thread is frozen on this exact line, using no CPU, until the final ACK of a handshake wakes it.',
    sleeps: true
  },
  {
    at: 'finish',
    stack: ['inet_csk_wait_for_connect', 'inet_csk_accept', 'inet_accept', 'do_accept', '__sys_accept4', ...sysAccept],
    locals: [['current->__state', 'TASK_RUNNING'], ['accept_queue', '[10.0.0.1:52814]']],
    note: 'Woken. The TCP stack moved a finished connection onto the accept queue and called wake_up on this wait queue.'
  },
  {
    at: 'dequeue',
    stack: ['inet_csk_accept', 'inet_accept', 'do_accept', '__sys_accept4', ...sysAccept],
    locals: [['req', '0xffff88810a993c00'], ['accept_queue', '[] (empty)']],
    note: 'Take the first connection off the queue.'
  },
  {
    at: 'newsk',
    stack: ['inet_csk_accept', 'inet_accept', 'do_accept', '__sys_accept4', ...sysAccept],
    locals: [['newsk->sk_state', 'TCP_ESTABLISHED'], ['4-tuple', '10.0.0.2:8080 ↔ 10.0.0.1:52814']],
    note: 'The child socket was created by the kernel during the handshake. It’s already ESTABLISHED, with its own buffers.'
  },
  {
    at: 'ret',
    stack: ['do_accept', '__sys_accept4', ...sysAccept],
    locals: [['newfd', '4']],
    note: 'fd 4 is installed and returned. The listener on fd 3 is untouched and keeps listening.'
  }]

});