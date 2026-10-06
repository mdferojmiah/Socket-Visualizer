import { defineSource } from '../utils/kernelSource';

const sysCreate = ['__x64_sys_epoll_create1'];
const sysCtl = ['__x64_sys_epoll_ctl'];
const sysWait = ['__x64_sys_epoll_wait'];

const createFrames = ['do_epoll_create', ...sysCreate];
const ctlFrames = ['do_epoll_ctl', ...sysCtl];
const insertFrames = ['ep_insert', ...ctlFrames];
const waitFrames = ['ep_poll', 'do_epoll_wait', ...sysWait];
const sendFrames = ['ep_send_events', ...waitFrames];

export const epollCreateSource = defineSource({
  id: 'epoll_create',
  label: 'epoll_create1()',
  file: 'fs/eventpoll.c',
  returns: '4',
  src: [
  '// fs/eventpoll.c (simplified from Linux 6.x)',
  ['SYSCALL_DEFINE1(epoll_create1, int, flags)', 'entry'],
  '{',
  ['  return do_epoll_create(flags);', 'call'],
  '}',
  '',
  'static int do_epoll_create(int flags)',
  '{',
  ['  error = ep_alloc(&ep);                 // struct eventpoll', 'alloc'],
  ['  fd = get_unused_fd_flags(O_RDWR | (flags & O_CLOEXEC));', 'fd'],
  ['  file = anon_inode_getfile("[eventpoll]", &eventpoll_fops, ep, O_RDWR);', 'file'],
  '  ep->file = file;',
  ['  fd_install(fd, file);                  // fd 4 now points at it', 'install'],
  ['  return fd;', 'ret'],
  '}',
  '',
  'static int ep_alloc(struct eventpoll **pep)',
  '{',
  ['  ep = kzalloc(sizeof(*ep), GFP_KERNEL);', 'kz'],
  ['  init_waitqueue_head(&ep->wq);          // epoll_wait() sleepers', 'wq'],
  ['  INIT_LIST_HEAD(&ep->rdllist);          // ready list: empty', 'rdl'],
  ['  ep->rbr = RB_ROOT_CACHED;              // interest tree: empty', 'rbr'],
  '  *pep = ep;',
  '  return 0;',
  '}'],

  breakpoints: ['alloc', 'install'],
  trace: [
  {
    at: 'entry',
    stack: sysCreate,
    locals: [['flags', '0']],
    note: 'Your C# code called epoll_create1(0) through P/Invoke. Execution has crossed into the kernel.'
  },
  {
    at: 'call',
    stack: sysCreate,
    locals: [['flags', '0'], ['O_CLOEXEC', 'not set']],
    note: 'The syscall is a thin wrapper. The real work happens in do_epoll_create().'
  },
  {
    at: 'alloc',
    stack: createFrames,
    locals: [['ep', '(allocating…)']],
    note: 'First build the eventpoll object, the thing the epoll fd will point to.'
  },
  {
    at: 'kz',
    stack: ['ep_alloc', ...createFrames],
    locals: [['ep', '0xffff8881_0a3c4000'], ['sizeof(*ep)', '≈ 200 bytes']],
    note: 'A zeroed struct eventpoll from kernel memory. It costs about the same however many sockets you later add.'
  },
  {
    at: 'wq',
    stack: ['ep_alloc', ...createFrames],
    locals: [['ep->wq', 'empty']],
    note: 'The wait queue where threads calling epoll_wait() will sleep. Note: on epoll, not on any socket.'
  },
  {
    at: 'rdl',
    stack: ['ep_alloc', ...createFrames],
    locals: [['ep->rdllist', '[]']],
    note: 'The ready list. ep_poll_callback() appends to it when a watched socket becomes ready.'
  },
  {
    at: 'rbr',
    stack: ['ep_alloc', ...createFrames],
    locals: [['ep->rbr', '{} (0 items)']],
    note: 'The red-black tree of watched fds. epoll_ctl(ADD) inserts here in O(log n).'
  },
  {
    at: 'fd',
    stack: createFrames,
    locals: [['fd', '4'], ['reason', 'lowest free slot (0–3 are taken)']],
    note: 'Reserve a slot in the process’s fd table. 0–2 are stdio and 3 is the listening socket, so it’s 4.'
  },
  {
    at: 'file',
    stack: createFrames,
    locals: [['file->f_op', '&eventpoll_fops'], ['file->private_data', 'ep']],
    note: 'Wrap the eventpoll in an anonymous-inode file. That’s why the epoll handle can be closed, inherited or even watched by another epoll.'
  },
  {
    at: 'install',
    stack: createFrames,
    locals: [['current->files[4]', '[eventpoll]']],
    note: 'Publish the file in the fd table. From now on fd 4 means “this epoll instance”.'
  },
  {
    at: 'ret',
    stack: createFrames,
    locals: [['return', '4']],
    note: 'Return the new fd to user space.'
  }]

});

export const epollCtlSource = defineSource({
  id: 'epoll_ctl',
  label: 'epoll_ctl()',
  file: 'fs/eventpoll.c',
  returns: '0',
  src: [
  '// fs/eventpoll.c (simplified from Linux 6.x)',
  ['SYSCALL_DEFINE4(epoll_ctl, int, epfd, int, op, int, fd, struct epoll_event __user *, event)', 'entry'],
  '{',
  ['  if (copy_from_user(&epds, event, sizeof(struct epoll_event)))', 'copy'],
  '    return -EFAULT;',
  '  return do_epoll_ctl(epfd, op, fd, &epds, false);',
  '}',
  '',
  'int do_epoll_ctl(int epfd, int op, int fd, struct epoll_event *epds, bool nonblock)',
  '{',
  ['  f = fdget(epfd); tf = fdget(fd);       // epoll file + target socket', 'files'],
  ['  if (!file_can_poll(tf.file)) return -EPERM;', 'canpoll'],
  '  ep = f.file->private_data;',
  ['  epi = ep_find(ep, tf.file, fd);        // already in the tree?', 'find'],
  '  switch (op) {',
  '  case EPOLL_CTL_ADD:',
  '    if (epi) return -EEXIST;',
  ['    error = ep_insert(ep, epds, tf.file, fd, full_check);', 'insert'],
  '    break;',
  '  }',
  ['  return error;', 'ret'],
  '}',
  '',
  'static int ep_insert(struct eventpoll *ep, const struct epoll_event *event, struct file *tfile, int fd, int full_check)',
  '{',
  ['  epi = kmem_cache_zalloc(epi_cache, GFP_KERNEL);', 'epi'],
  '  epi->ffd.file = tfile; epi->ffd.fd = fd; epi->event = *event;',
  ['  ep_rbtree_insert(ep, epi);             // O(log n)', 'tree'],
  ['  init_poll_funcptr(&epq.pt, ep_ptable_queue_proc);', 'pt'],
  ['  revents = ep_item_poll(epi, &epq.pt, 1);   // tcp_poll() hooks the wait queue', 'poll'],
  ['  if (revents && !ep_is_linked(epi))      // ready already?', 'ready'],
  '    list_add_tail(&epi->rdllink, &ep->rdllist);',
  '  return 0;',
  '}',
  '',
  'static void ep_ptable_queue_proc(struct file *file, wait_queue_head_t *whead, poll_table *pt)',
  '{',
  ['  init_waitqueue_func_entry(&pwq->wait, ep_poll_callback);', 'cb'],
  ['  add_wait_queue(whead, &pwq->wait);     // onto the socket’s sk_wq', 'addwq'],
  '}'],

  breakpoints: ['insert', 'addwq'],
  trace: [
  {
    at: 'entry',
    stack: sysCtl,
    locals: [['epfd', '4'], ['op', 'EPOLL_CTL_ADD'], ['fd', '3'], ['event', '0x7ffd2c41a0 (user)']],
    note: 'Called with “add fd 3 to epoll fd 4”. Values here are from the first call, when the listener is registered.'
  },
  {
    at: 'copy',
    stack: sysCtl,
    locals: [['epds.events', 'EPOLLIN'], ['epds.data.fd', '3']],
    note: 'Copy the epoll_event struct from your program into kernel memory.'
  },
  {
    at: 'files',
    stack: ctlFrames,
    locals: [['f.file', '[eventpoll]'], ['tf.file', 'socket:[21844]']],
    note: 'Look up both fds: fd 4 is the epoll file, fd 3 is the socket to watch.'
  },
  {
    at: 'canpoll',
    stack: ctlFrames,
    locals: [['tf.file->f_op->poll', 'sock_poll']],
    note: 'Only files with a poll method can be watched. Sockets, pipes and eventfds have one. Regular files don’t.'
  },
  {
    at: 'find',
    stack: ctlFrames,
    locals: [['epi', 'NULL (not registered yet)']],
    note: 'Search the red-black tree for (file, fd). Not found, so ADD is allowed.'
  },
  {
    at: 'insert',
    stack: ctlFrames,
    locals: [['op', 'EPOLL_CTL_ADD']],
    note: 'Hand off to ep_insert(), which does the interesting part.'
  },
  {
    at: 'epi',
    stack: insertFrames,
    locals: [['epi', '0xffff8881_0b7e2a80'], ['epi->ffd.fd', '3'], ['epi->event.events', 'EPOLLIN']],
    note: 'Allocate an epitem: one per watched fd. It remembers the fd, the events you asked for and your data tag.'
  },
  {
    at: 'tree',
    stack: insertFrames,
    locals: [['ep->rbr', '{ 3 }']],
    note: 'Insert it in the interest tree. With 100,000 sockets that’s still about 17 comparisons.'
  },
  {
    at: 'pt',
    stack: insertFrames,
    locals: [['epq.pt._qproc', 'ep_ptable_queue_proc']],
    note: 'Prepare a poll table whose queue function will plant epoll’s callback on the socket.'
  },
  {
    at: 'poll',
    stack: insertFrames,
    locals: [['tcp_poll(sk, &epq.pt)', 'called'], ['revents', '0']],
    note: 'Call the socket’s own poll function. As a side effect it calls ep_ptable_queue_proc with the socket’s wait queue…'
  },
  {
    at: 'cb',
    stack: ['ep_ptable_queue_proc', 'sock_poll_wait', 'tcp_poll', 'ep_item_poll', ...insertFrames],
    locals: [['pwq->wait.func', 'ep_poll_callback']],
    note: '…which builds a wait-queue entry whose wake function is ep_poll_callback instead of “wake this thread”.'
  },
  {
    at: 'addwq',
    stack: ['ep_ptable_queue_proc', 'sock_poll_wait', 'tcp_poll', 'ep_item_poll', ...insertFrames],
    locals: [['sk->sk_wq', '[ ep_poll_callback ]']],
    note: 'This is the hook. Whenever the socket wakes its waiters (new data, new connection, FIN), epoll gets called.'
  },
  {
    at: 'ready',
    stack: insertFrames,
    locals: [['revents', '0'], ['ep->rdllist', '[]']],
    note: 'tcp_poll() reported nothing ready yet, so the ready list stays empty.'
  },
  {
    at: 'ret',
    stack: ctlFrames,
    locals: [['error', '0']],
    note: 'Registration done. This cost is paid once per fd, not on every wait.'
  }]

});

export const epollWaitSource = defineSource({
  id: 'epoll_wait',
  label: 'epoll_wait()',
  file: 'fs/eventpoll.c',
  returns: '1',
  src: [
  '// fs/eventpoll.c (simplified from Linux 6.x)',
  ['SYSCALL_DEFINE4(epoll_wait, int, epfd, struct epoll_event __user *, events, int, maxevents, int, timeout)', 'entry'],
  '{',
  '  return do_epoll_wait(epfd, events, maxevents, ep_timeout_to_timespec(&to, timeout));',
  '}',
  '',
  'static int do_epoll_wait(int epfd, struct epoll_event __user *events, int maxevents, struct timespec64 *to)',
  '{',
  ['  f = fdget(epfd); ep = f.file->private_data;', 'ep'],
  '  return ep_poll(ep, events, maxevents, to);',
  '}',
  '',
  'static int ep_poll(struct eventpoll *ep, struct epoll_event __user *events, int maxevents, struct timespec64 *timeout)',
  '{',
  '  while (1) {',
  ['    eavail = ep_events_available(ep);    // anything on rdllist?', 'avail'],
  '    if (eavail) {',
  ['      res = ep_send_events(ep, events, maxevents);', 'send'],
  ['      if (res) return res;', 'ret'],
  '    }',
  ['    __add_wait_queue_exclusive(&ep->wq, &wait);   // sleep on epoll, not a socket', 'addwait'],
  '    __set_current_state(TASK_INTERRUPTIBLE);',
  ['    schedule_hrtimeout_range(to, slack, HRTIMER_MODE_ABS);', 'sleep'],
  ['    // ep_poll_callback() woke us: loop and look again', 'woke'],
  '  }',
  '}',
  '',
  'static int ep_send_events(struct eventpoll *ep, struct epoll_event __user *events, int maxevents)',
  '{',
  ['  ep_start_scan(ep, &txlist);             // move rdllist aside', 'scan'],
  '  list_for_each_entry_safe(epi, tmp, &txlist, rdllink) {',
  ['    revents = ep_item_poll(epi, &pt, 1);   // still ready?', 'repoll'],
  '    if (!revents) continue;',
  ['    events = epoll_put_uevent(revents, epi->event.data, events);   // copy to user', 'copy'],
  '    if (!(epi->event.events & EPOLLET))',
  ['      list_add_tail(&epi->rdllink, &ep->rdllist);   // level-triggered: re-queue', 'lt'],
  '  }',
  '  ep_done_scan(ep, &txlist);',
  '  return res;',
  '}'],

  breakpoints: ['sleep', 'copy'],
  trace: [
  {
    at: 'entry',
    stack: sysWait,
    locals: [['epfd', '4'], ['maxevents', '64'], ['timeout', '-1 (forever)']],
    note: 'The event loop asks: “which of my sockets are ready?” and is willing to wait forever for an answer.'
  },
  {
    at: 'ep',
    stack: ['do_epoll_wait', ...sysWait],
    locals: [['ep->rbr', '3 items'], ['ep->rdllist', '[]']],
    note: 'Find the eventpoll behind fd 4. Notice that nothing here loops over the watched sockets.'
  },
  {
    at: 'avail',
    stack: waitFrames,
    locals: [['eavail', 'false']],
    note: 'Check the ready list. It’s empty: no socket has woken its wait queue since the last call.'
  },
  {
    at: 'addwait',
    stack: waitFrames,
    locals: [['ep->wq', '[ pid 812 ]']],
    note: 'Join epoll’s own wait queue. One sleeping thread can stand in for any number of sockets.'
  },
  {
    at: 'sleep',
    stack: ['schedule', 'schedule_hrtimeout_range', ...waitFrames],
    locals: [['current->__state', 'TASK_INTERRUPTIBLE'], ['CPU used', '0']],
    note: 'The thread is off the CPU. When data reaches a watched socket, ep_poll_callback() adds it to rdllist and wakes ep->wq.',
    sleeps: true
  },
  {
    at: 'woke',
    stack: waitFrames,
    locals: [['current->__state', 'TASK_RUNNING'], ['ep->rdllist', '[ fd 6 ]']],
    note: 'Woken by ep_poll_callback(). Loop round and look at the ready list again.'
  },
  {
    at: 'avail',
    stack: waitFrames,
    locals: [['eavail', 'true']],
    note: 'Now there is something on rdllist.'
  },
  {
    at: 'send',
    stack: waitFrames,
    locals: [['maxevents', '64']],
    note: 'Copy the ready events out to your array.'
  },
  {
    at: 'scan',
    stack: sendFrames,
    locals: [['txlist', '[ fd 6 ]'], ['ep->rdllist', '[]']],
    note: 'Move the ready list aside so callbacks can keep adding to a fresh one while we work.'
  },
  {
    at: 'repoll',
    stack: sendFrames,
    locals: [['epi->ffd.fd', '6'], ['revents', 'EPOLLIN']],
    note: 'Re-check the socket. An item that’s no longer ready is skipped here and never reported.'
  },
  {
    at: 'copy',
    stack: sendFrames,
    locals: [['events[0]', '{ EPOLLIN, data.fd = 6 }'], ['res', '1']],
    note: 'Write { EPOLLIN, fd 6 } into the user’s array. Cost depends on ready sockets, not watched ones.'
  },
  {
    at: 'lt',
    stack: sendFrames,
    locals: [['EPOLLET', 'not set'], ['ep->rdllist', '[ fd 6 ]']],
    note: 'Level-triggered: put fd 6 back. If you don’t read all its data, the next epoll_wait reports it again.'
  },
  {
    at: 'ret',
    stack: waitFrames,
    locals: [['res', '1']],
    note: 'Return the number of events written.'
  }]

});