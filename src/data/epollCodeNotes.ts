import type { CodeNote } from '../types/socket';

/** Index k-1 explains statement k (see the statement map in epollCode.ts). */
export const epollCodeNotes: CodeNote[] = [
{
  what: 'Creates the listening TCP socket. .NET has no public epoll API, so line 2 imports the three libc functions through P/Invoke and the loop calls them directly.',
  parts: [
  { code: 'srv', meaning: 'Socket for fd 3.' },
  { code: 'using static Epoll', meaning: 'A small class of [DllImport("libc")] declarations. .NET itself uses epoll the same way inside its SocketAsyncEngine on Linux.' }],

  returns: 'a Socket.'
},
{
  what: 'Binds port 8080 and starts listening with a backlog of 128.',
  parts: [
  { code: 'IPAddress.Any', meaning: 'Every interface.' },
  { code: '128', meaning: 'Accept-queue size. Busy servers use large backlogs.' }],

  returns: 'nothing.'
},
{
  what: 'Creates the epoll instance.',
  parts: [
  { code: 'epoll_create1(0)', meaning: 'Pass EPOLL_CLOEXEC instead of 0 to close it automatically on exec().' },
  { code: 'int ep', meaning: 'fd 4, the handle to the eventpoll object.' }],

  returns: 'an fd, or -1 (check Marshal.GetLastPInvokeError()).'
},
{
  what: 'Describes what to watch (line 7), then adds the listener to the interest list.',
  parts: [
  { code: 'events = EPOLLIN', meaning: 'Report readability. For a listener that means “a connection is ready to accept”. Add EPOLLET for edge-triggered mode.' },
  { code: 'fd = (int)srv.Handle', meaning: 'Your own tag, returned unchanged with each event. srv.Handle is the raw fd.' },
  { code: 'EPOLL_CTL_ADD', meaning: 'Other operations are MOD (change the mask) and DEL (remove).' }],

  returns: '0, or -1 with EEXIST / EBADF.'
},
{
  what: 'Sleeps until something is ready, then fills ready[] with up to 64 events.',
  parts: [
  { code: 'ready, 64', meaning: 'Output array and its capacity. Anything that doesn’t fit is returned next time.' },
  { code: '-1', meaning: 'Timeout in ms. -1 means wait forever, and 0 means return immediately.' },
  { code: 'int n', meaning: 'How many entries were written. The for loop handles exactly n.' }],

  returns: 'the number of ready fds, or -1 (EINTR if a signal interrupted it).'
},
{
  what: 'The listener is readable, so Accept() returns a connection immediately instead of blocking.',
  parts: [{ code: 'Socket c', meaning: 'The new connection socket (fd 5, 6, …).' }],
  returns: 'a Socket.'
},
{
  what: 'Reuses the ev struct with the new fd (line 17), stores the Socket in conns, and registers it.',
  parts: [
  { code: 'ev.fd = (int)c.Handle', meaning: 'The tag you’ll see in ready[i].fd when this socket fires.' },
  { code: 'conns[ev.fd] = c', meaning: 'Keeps the Socket alive and lets the loop map fd → Socket.' }],

  returns: '0, or -1.'
},
{
  what: 'Reads from the ready connection. Because epoll said it’s readable, this doesn’t block.',
  parts: [
  { code: 'conns[fd]', meaning: 'Looks up the Socket for the ready fd.' },
  { code: 'int len', meaning: 'Bytes read. 0 means the peer closed.' }],

  returns: 'bytes read, or 0.'
},
{
  what: 'Echoes the bytes back.',
  parts: [{ code: 'buf, len', meaning: 'Sends exactly what arrived. With non-blocking sockets you’d register EPOLLOUT and send the rest later.' }],
  returns: 'bytes sent.'
},
{
  what: 'The peer has closed. Closing the socket also removes it from epoll, so no EPOLL_CTL_DEL is needed.',
  parts: [
  { code: 'conns[fd].Close()', meaning: 'Closes fd 5. The kernel unhooks its epitem.' },
  { code: 'conns.Remove(fd)', meaning: 'Forget the Socket. That only works if this was the last reference to the file (watch out for dup() and fork()).' }],

  returns: 'nothing.'
}];