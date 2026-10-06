import { defineSource } from '../utils/kernelSource';

const sysConnect = ['__x64_sys_connect'];
const sysSend = ['__x64_sys_sendto'];
const sysRecv = ['__x64_sys_recvfrom'];
const sysClose = ['__x64_sys_close'];

const connectFrames = ['inet_stream_connect', '__sys_connect', ...sysConnect];
const tcpConnectFrames = ['tcp_v4_connect', '__inet_stream_connect', ...connectFrames];
const sendFrames = ['tcp_sendmsg_locked', 'tcp_sendmsg', 'sock_sendmsg', '__sys_sendto', ...sysSend];
const recvFrames = ['tcp_recvmsg_locked', 'tcp_recvmsg', 'sock_recvmsg', '__sys_recvfrom', ...sysRecv];

export const connectSource = defineSource({
  id: 'connect',
  label: 'connect()',
  file: 'net/socket.c · net/ipv4/tcp_ipv4.c · net/ipv4/af_inet.c',
  returns: '0',
  src: [
  '// net/socket.c',
  ['SYSCALL_DEFINE3(connect, int, fd, struct sockaddr __user *, uservaddr, int, addrlen)', 'entry'],
  '{',
  ['  err = move_addr_to_kernel(uservaddr, addrlen, &address);', 'copy'],
  ['  return sock->ops->connect(sock, &address, addrlen, flags);', 'ops'],
  '}',
  '',
  '// net/ipv4/tcp_ipv4.c',
  'int tcp_v4_connect(struct sock *sk, struct sockaddr *uaddr, int addr_len)',
  '{',
  ['  rt = ip_route_connect(...);         // which interface, which source IP?', 'route'],
  ['  tcp_set_state(sk, TCP_SYN_SENT);', 'state'],
  ['  err = inet_hash_connect(&tcp_death_row, sk);   // pick an ephemeral port', 'port'],
  ['  tp->write_seq = secure_tcp_seq(saddr, daddr, sport, dport);   // random ISN', 'isn'],
  ['  return tcp_connect(sk);             // build + transmit the SYN', 'syn'],
  '}',
  '',
  '// net/ipv4/af_inet.c',
  'int __inet_stream_connect(struct socket *sock, ...)',
  '{',
  '  err = sk->sk_prot->connect(sk, uaddr, addr_len);   // ↑ tcp_v4_connect',
  ['  timeo = sock_sndtimeo(sk, flags & O_NONBLOCK);', 'timeo'],
  ['  if (!timeo) return -EINPROGRESS;    // non-blocking: epoll tells you later', 'nb'],
  ['  timeo = inet_wait_for_connect(sk, timeo);   // sleep until SYN-ACK', 'wait'],
  ['  sock->state = SS_CONNECTED;', 'connected'],
  ['  return 0;', 'ret'],
  '}'],

  breakpoints: ['syn', 'wait'],
  trace: [
  {
    at: 'entry',
    stack: sysConnect,
    locals: [['fd', '3'], ['uservaddr', '0x7ffc19e04b70 (user)'], ['addrlen', '16']],
    note: 'connect() gets the server’s address from your program’s memory.'
  },
  {
    at: 'copy',
    stack: ['__sys_connect', ...sysConnect],
    locals: [['address.sin_addr', '10.0.0.2'], ['address.sin_port', '8080']],
    note: 'Copy the sockaddr into kernel memory before using it.'
  },
  {
    at: 'ops',
    stack: ['__sys_connect', ...sysConnect],
    locals: [['sock->ops', '&inet_stream_ops']],
    note: 'inet_stream_connect() takes the socket lock and runs the TCP connect logic.'
  },
  {
    at: 'route',
    stack: tcpConnectFrames,
    locals: [['daddr', '10.0.0.2'], ['saddr', '10.0.0.1'], ['dev', 'eth0']],
    note: 'A routing table lookup decides which interface the packet leaves on, and that decides the source IP.'
  },
  {
    at: 'state',
    stack: tcpConnectFrames,
    locals: [['sk->sk_state', 'TCP_SYN_SENT']],
    note: 'The state changes before anything is sent.'
  },
  {
    at: 'port',
    stack: ['inet_hash_connect', ...tcpConnectFrames],
    locals: [['sport', '52814'], ['ip_local_port_range', '32768–60999']],
    note: 'No bind() was called, so the kernel picks a free ephemeral port and makes sure the 4-tuple is unique.'
  },
  {
    at: 'isn',
    stack: tcpConnectFrames,
    locals: [['tp->write_seq', '1000'], ['4-tuple', '10.0.0.1:52814 → 10.0.0.2:8080']],
    note: 'The initial sequence number is a keyed hash plus a clock, so attackers can’t guess it. The demo shows 1000 for readability.'
  },
  {
    at: 'syn',
    stack: ['tcp_connect', ...tcpConnectFrames],
    locals: [['skb flags', 'SYN'], ['seq', '1000'], ['retrans timer', '1 s']],
    note: 'Builds a SYN segment, queues it, transmits it through IP and the NIC driver, and arms the retransmission timer in case it’s lost.'
  },
  {
    at: 'timeo',
    stack: ['__inet_stream_connect', ...connectFrames],
    locals: [['timeo', 'MAX_SCHEDULE_TIMEOUT'], ['O_NONBLOCK', 'false']],
    note: 'Back in the generic layer. Should we wait for the handshake?'
  },
  {
    at: 'nb',
    stack: ['__inet_stream_connect', ...connectFrames],
    locals: [['timeo', 'MAX_SCHEDULE_TIMEOUT']],
    note: 'A non-blocking socket would return EINPROGRESS here. That’s how event loops like epoll connect without waiting.'
  },
  {
    at: 'wait',
    stack: ['schedule', 'inet_wait_for_connect', '__inet_stream_connect', ...connectFrames],
    locals: [['current->__state', 'TASK_INTERRUPTIBLE'], ['sk->sk_state', 'TCP_SYN_SENT']],
    note: 'The process sleeps here for one round trip. When the SYN-ACK arrives, softirq code sends the final ACK, moves the socket to ESTABLISHED, and wakes this thread.',
    sleeps: true
  },
  {
    at: 'connected',
    stack: ['__inet_stream_connect', ...connectFrames],
    locals: [['sk->sk_state', 'TCP_ESTABLISHED'], ['sock->state', 'SS_CONNECTED']],
    note: 'Woken up with the handshake complete.'
  },
  {
    at: 'ret',
    stack: ['__inet_stream_connect', ...connectFrames],
    locals: [['err', '0']],
    note: 'connect() returns 0. The connection exists, even though the server app may not have called accept() yet.'
  }]

});

export const sendSource = defineSource({
  id: 'send',
  label: 'send()',
  file: 'net/socket.c · net/ipv4/tcp.c',
  returns: '12',
  src: [
  '// net/socket.c: send() is sendto() with no address',
  ['SYSCALL_DEFINE4(send, int, fd, void __user *, buff, size_t, len, unsigned int, flags)', 'entry'],
  '{',
  ['  return __sys_sendto(fd, buff, len, flags, NULL, 0);', 'call'],
  '}',
  '',
  'int __sys_sendto(int fd, void __user *buff, size_t len, ...)',
  '{',
  ['  sock = sockfd_lookup_light(fd, &err, &fput_needed);', 'lookup'],
  ['  import_ubuf(ITER_SOURCE, buff, len, &msg.msg_iter);   // describe user buffer', 'iter'],
  ['  return sock_sendmsg(sock, &msg);          // → tcp_sendmsg()', 'sendmsg'],
  '}',
  '',
  '// net/ipv4/tcp.c',
  'int tcp_sendmsg_locked(struct sock *sk, struct msghdr *msg, size_t size)',
  '{',
  '  while (msg_data_left(msg)) {',
  ['    if (!sk_stream_memory_free(sk))         // send buffer full?', 'full'],
  '      sk_stream_wait_memory(sk, &timeo);    // …then block here',
  ['    skb = tcp_write_queue_tail(sk);         // append to the send queue', 'skb'],
  ['    copy_from_user(skb_put(skb, copy), from, copy);   // user → kernel', 'copy'],
  '    copied += copy;',
  '  }',
  ['  tcp_push(sk, flags, mss_now, ...);       // maybe transmit now', 'push'],
  ['  return copied;                           // queued, not delivered', 'ret'],
  '}'],

  breakpoints: ['copy', 'push'],
  trace: [
  {
    at: 'entry',
    stack: sysSend,
    locals: [['fd', '3'], ['buff', '0x55d0c3a2b2a0 (user)'], ['len', '12']],
    note: 'C#’s Socket.Send() and C’s send() both land in __sys_sendto. On a blocking socket, Socket.Send() keeps going until every byte is queued.'
  },
  {
    at: 'call',
    stack: sysSend,
    locals: [['fd', '3'], ['len', '12'], ['addr', 'NULL']],
    note: 'No destination address: a connected TCP socket already knows its peer.'
  },
  {
    at: 'lookup',
    stack: ['__sys_sendto', ...sysSend],
    locals: [['sock', '0xffff888104a1c000']],
    note: 'fd → socket.'
  },
  {
    at: 'iter',
    stack: ['__sys_sendto', ...sysSend],
    locals: [['msg.msg_iter', '{ base: 0x55d0c3a2b2a0, len: 12 }']],
    note: 'Nothing is copied yet. The kernel just records where your bytes are.'
  },
  {
    at: 'sendmsg',
    stack: ['__sys_sendto', ...sysSend],
    locals: [['sock->ops->sendmsg', 'inet_sendmsg']],
    note: 'Into TCP, under the socket lock.'
  },
  {
    at: 'full',
    stack: sendFrames,
    locals: [['sk_wmem_queued', '0'], ['sk_sndbuf', '16384']],
    note: 'Plenty of room. If the peer were slow and the send buffer full, send() would sleep here. That’s TCP flow control reaching your program.'
  },
  {
    at: 'skb',
    stack: sendFrames,
    locals: [['skb', '0xffff88810c41a700'], ['mss_now', '1448']],
    note: 'Grab (or allocate) the last socket buffer on the write queue to append to.'
  },
  {
    at: 'copy',
    stack: sendFrames,
    locals: [['copy', '12'], ['sk_wmem_queued', '12']],
    note: 'The only real work send() does: copy 12 bytes from your memory into kernel memory.'
  },
  {
    at: 'push',
    stack: ['tcp_push', ...sendFrames.slice(0)],
    locals: [['snd_nxt', '1001'], ['nagle', 'off (nothing in flight)']],
    note: 'TCP decides whether to transmit now. Nagle’s algorithm may hold small writes back while earlier data is unacknowledged.'
  },
  {
    at: 'ret',
    stack: sendFrames,
    locals: [['copied', '12']],
    note: 'Returns 12: bytes accepted into the send buffer. The server may not have received anything yet.'
  }]

});

export const recvSource = defineSource({
  id: 'recv',
  label: 'recv()',
  file: 'net/socket.c · net/ipv4/tcp.c',
  returns: '12',
  src: [
  '// net/socket.c: recv() is recvfrom() with no address',
  ['SYSCALL_DEFINE4(recv, int, fd, void __user *, ubuf, size_t, size, unsigned int, flags)', 'entry'],
  '{',
  ['  return __sys_recvfrom(fd, ubuf, size, flags, NULL, NULL);', 'call'],
  '}',
  '',
  '// net/ipv4/tcp.c',
  'int tcp_recvmsg_locked(struct sock *sk, struct msghdr *msg, size_t len, ...)',
  '{',
  '  do {',
  ['    skb = skb_peek(&sk->sk_receive_queue);    // anything queued?', 'peek'],
  '    if (skb) goto found_ok_skb;',
  ['    if (copied || sock_flag(sk, SOCK_DONE))   // FIN seen → return 0', 'done'],
  '      break;',
  ['    sk_wait_data(sk, &timeo, last);           // sleep until data or FIN', 'wait'],
  '    continue;',
  'found_ok_skb:',
  ['    skb_copy_datagram_msg(skb, offset, msg, used);   // kernel → user', 'copy'],
  ['    copied += used;', 'copied'],
  ['    sk_eat_skb(sk, skb);                      // free the buffer', 'eat'],
  '  } while (len > copied && skb_queue_len(&sk->sk_receive_queue));',
  ['  tcp_cleanup_rbuf(sk, copied);   // maybe ACK / open the window', 'ack'],
  ['  return copied;', 'ret'],
  '}'],

  breakpoints: ['peek', 'copy'],
  trace: [
  {
    at: 'entry',
    stack: sysRecv,
    locals: [['fd', '4'], ['ubuf', '0x7ffe3d6a0f10 (user)'], ['size', '1024']],
    note: 'size is the most you’re willing to take. TCP returns whatever is available, up to that.'
  },
  {
    at: 'call',
    stack: sysRecv,
    locals: [['size', '1024'], ['addr', 'NULL']],
    note: 'Into __sys_recvfrom → sock_recvmsg → tcp_recvmsg.'
  },
  {
    at: 'peek',
    stack: recvFrames,
    locals: [['sk_receive_queue', '[] (empty)'], ['copied', '0']],
    note: 'Nothing has arrived yet.'
  },
  {
    at: 'done',
    stack: recvFrames,
    locals: [['copied', '0'], ['SOCK_DONE', 'false']],
    note: 'No FIN either, so returning 0 would be wrong. 0 is reserved for “the peer closed”.'
  },
  {
    at: 'wait',
    stack: ['schedule', 'sk_wait_data', ...recvFrames],
    locals: [['current->__state', 'TASK_INTERRUPTIBLE'], ['sk_sleep(sk)', '1 waiter']],
    note: 'Sleep on the socket’s wait queue. When a segment arrives, tcp_data_queue() appends it and calls sk_data_ready(), which wakes this thread.',
    sleeps: true
  },
  {
    at: 'peek',
    stack: recvFrames,
    locals: [['sk_receive_queue', '[skb: 12 bytes]'], ['copied', '0']],
    note: 'Woken, loop again: now there’s a buffer on the queue. (If data had already been waiting, recv() would have come straight here.)'
  },
  {
    at: 'copy',
    stack: ['skb_copy_datagram_msg', ...recvFrames],
    locals: [['used', '12'], ['payload', '"hello server"']],
    note: 'copy_to_user: the bytes move from kernel memory into your buffer.'
  },
  {
    at: 'copied',
    stack: recvFrames,
    locals: [['copied', '12']],
    note: 'Count what we delivered.'
  },
  {
    at: 'eat',
    stack: recvFrames,
    locals: [['sk_receive_queue', '[] (empty)'], ['sk_rmem_alloc', '0']],
    note: 'The buffer is freed, so the receive window grows again.'
  },
  {
    at: 'ack',
    stack: ['tcp_cleanup_rbuf', ...recvFrames],
    locals: [['rcv_nxt', '1013'], ['ACK', 'scheduled']],
    note: 'Because the app consumed data, TCP may send an ACK or a window update so the sender can continue.'
  },
  {
    at: 'ret',
    stack: recvFrames,
    locals: [['copied', '12']],
    note: 'recv() returns 12. Your program now has the bytes.'
  }]

});

export const closeSource = defineSource({
  id: 'close',
  label: 'close()',
  file: 'fs/open.c · net/ipv4/tcp.c',
  returns: '0',
  src: [
  '// fs/open.c',
  ['SYSCALL_DEFINE1(close, unsigned int, fd)', 'entry'],
  '{',
  ['  struct file *file = file_close_fd(fd);      // remove from the fd table', 'remove'],
  ['  return filp_close(file, current->files);    // drop the reference', 'fput'],
  '}',
  '',
  '// net/ipv4/tcp.c: runs when the last reference is gone',
  'void __tcp_close(struct sock *sk, long timeout)',
  '{',
  ['  if (sk->sk_state == TCP_LISTEN) {', 'listen'],
  '    tcp_set_state(sk, TCP_CLOSE);  inet_csk_listen_stop(sk);',
  '    return;',
  '  }',
  ['  data_was_unread = __skb_queue_purge(&sk->sk_receive_queue);', 'purge'],
  ['  if (tcp_close_state(sk))         // ESTABLISHED → FIN_WAIT_1', 'state'],
  ['    tcp_send_fin(sk);              // queue a FIN', 'fin'],
  ['  sock_orphan(sk);   // no fd, no process: the kernel finishes the teardown', 'orphan'],
  '}'],

  breakpoints: ['fin'],
  trace: [
  {
    at: 'entry',
    stack: sysClose,
    locals: [['fd', '3']],
    note: 'close() is a file operation, not a socket one. It lives in fs/, not net/.'
  },
  {
    at: 'remove',
    stack: sysClose,
    locals: [['fd', '3'], ['fdt->fd[3]', 'NULL']],
    note: 'The slot is freed immediately. The next socket() or open() can reuse fd 3.'
  },
  {
    at: 'fput',
    stack: sysClose,
    locals: [['file->f_count', '1 → 0']],
    note: 'If another fd (from dup() or fork()) still referenced this file, nothing more would happen. This was the last one.'
  },
  {
    at: 'listen',
    stack: ['__tcp_close', 'tcp_close', 'inet_release', '__sock_release', '__fput', ...sysClose],
    locals: [['sk->sk_state', 'TCP_ESTABLISHED']],
    note: 'Closing a listener would just drop its queues. This one is a connection.'
  },
  {
    at: 'purge',
    stack: ['__tcp_close', 'tcp_close', 'inet_release', '__sock_release', '__fput', ...sysClose],
    locals: [['data_was_unread', '0']],
    note: 'Unread data in the receive buffer would make the kernel send RST instead of a polite FIN.'
  },
  {
    at: 'state',
    stack: ['tcp_close_state', '__tcp_close', 'tcp_close', 'inet_release', '__sock_release', '__fput', ...sysClose],
    locals: [['sk->sk_state', 'TCP_FIN_WAIT1']],
    note: 'ESTABLISHED becomes FIN_WAIT_1 (or CLOSE_WAIT becomes LAST_ACK on the side that closes second).'
  },
  {
    at: 'fin',
    stack: ['tcp_send_fin', '__tcp_close', 'tcp_close', 'inet_release', '__sock_release', '__fput', ...sysClose],
    locals: [['skb flags', 'FIN | ACK'], ['write_seq', '+1']],
    note: 'A FIN goes out after any data still in the send buffer. FIN consumes one sequence number.'
  },
  {
    at: 'orphan',
    stack: ['__tcp_close', 'tcp_close', 'inet_release', '__sock_release', '__fput', ...sysClose],
    locals: [['sk->sk_socket', 'NULL'], ['orphan_count', '+1']],
    note: 'The socket no longer belongs to any process. Timers in the kernel finish the handshake and TIME_WAIT on their own.'
  }]

});