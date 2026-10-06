import type { CodeNote, Side } from '../types/socket';

/** Index k-1 explains statement k (the `line` value in step snapshots). */
export const tcpCodeNotes: Record<Side, CodeNote[]> = {
  server: [
  {
    what: 'Imports .NET’s networking namespaces. System.Net.Sockets.Socket is a thin wrapper over the operating system’s socket API: on Linux, each method below becomes one system call.',
    parts: [
    { code: 'System.Net', meaning: 'IPAddress and IPEndPoint, the address types.' },
    { code: 'System.Net.Sockets', meaning: 'Socket, plus enums like AddressFamily, SocketType and ProtocolType.' },
    { code: 'System.Text', meaning: 'Encoding, to turn strings into bytes and back.' }]

  },
  {
    what: 'Asks the kernel to create a TCP socket. The Socket object wraps the file descriptor it gets back.',
    parts: [
    { code: 'AddressFamily.InterNetwork', meaning: 'IPv4 (AF_INET). InterNetworkV6 would mean IPv6.' },
    { code: 'SocketType.Stream', meaning: 'A reliable, ordered byte stream (SOCK_STREAM).' },
    { code: 'ProtocolType.Tcp', meaning: 'Use TCP for that stream.' },
    { code: 'srv', meaning: 'srv.Handle exposes the raw fd, which is 3 here.' }],

    returns: 'a Socket. Throws SocketException if the process has run out of fds.'
  },
  {
    what: 'Gives the socket a local address and port, so the kernel knows which incoming packets belong to it.',
    parts: [
    { code: 'IPAddress.Any', meaning: 'Wildcard 0.0.0.0: accept on every interface. IPAddress.Loopback would be local only.' },
    { code: '8080', meaning: 'Port number. Ports below 1024 need root on Linux.' },
    { code: 'IPEndPoint', meaning: 'An (address, port) pair, .NET’s version of struct sockaddr_in.' }],

    returns: 'nothing. Throws SocketException (AddressAlreadyInUse) if the port is taken.'
  },
  {
    what: 'Makes the socket a passive listener. From now on the kernel answers incoming SYNs on this port by itself.',
    parts: [
    { code: 'Listen', meaning: 'Marks the socket passive. It can’t Connect() anymore, only Accept().' },
    { code: '5', meaning: 'Backlog: the most completed connections that can wait for Accept(). Linux caps it at net.core.somaxconn.' }],

    returns: 'nothing.'
  },
  {
    what: 'Takes the next completed connection off the accept queue. If the queue is empty, the thread sleeps on this line.',
    parts: [
    { code: 'Socket conn', meaning: 'A new socket (fd 4) for this one client. srv keeps listening.' },
    { code: '// blocks', meaning: 'Blocking by default. AcceptAsync() would free the thread and resume later instead.' }],

    returns: 'a new Socket for the connection.'
  },
  {
    what: 'Copies up to 1024 bytes from the connection’s receive buffer in the kernel into buf.',
    parts: [
    { code: 'buf', meaning: 'A byte[] the kernel copies into. You can get fewer bytes than its length, because TCP has no message boundaries.' },
    { code: 'int n', meaning: 'Bytes read. 0 means the peer closed the connection.' }],

    returns: 'the number of bytes read. Waits if the buffer is empty.'
  },
  {
    what: 'Line 9 builds the uppercase reply in user space, then Send() copies it into the kernel send buffer.',
    parts: [
    { code: 'ToUpper()', meaning: 'Plain .NET work with no system call.' },
    { code: 'Send(reply)', meaning: 'On a blocking socket, .NET keeps calling send() until every byte is queued.' }],

    returns: 'the number of bytes queued. Queued doesn’t mean delivered.'
  },
  {
    what: 'Releases fd 4. The kernel sends a FIN and finishes the TCP teardown without the app.',
    parts: [{ code: 'conn.Close()', meaning: 'Closes only the connection socket. srv could Accept() another client.' }],
    returns: 'nothing.'
  }],

  client: [
  {
    what: 'The same namespaces the server uses. Both ends speak the same Socket API.',
    parts: [{ code: 'System.Net.Sockets', meaning: 'Socket and its enums.' }]
  },
  {
    what: 'Creates the client’s TCP socket. It has no address yet. The kernel will choose one during Connect().',
    parts: [
    { code: 'InterNetwork, Stream, Tcp', meaning: 'IPv4 and TCP, matching the server.' },
    { code: 'cli', meaning: 'Wraps fd 3 in the client’s own fd table.' }],

    returns: 'a Socket.'
  },
  {
    what: 'Starts the three-way handshake and sleeps until it succeeds or fails.',
    parts: [
    { code: 'IPAddress.Parse("10.0.0.2")', meaning: 'Turns the text IP into a 32-bit address.' },
    { code: '8080', meaning: 'The server’s port.' },
    { code: 'implicit bind', meaning: 'Bind() was never called, so the kernel picks a free ephemeral port (52814).' }],

    returns: 'nothing. Throws SocketException (ConnectionRefused or TimedOut) on failure.'
  },
  {
    what: 'Copies the message into the kernel send buffer. The kernel decides when to send it as segments.',
    parts: [
    { code: 'Encoding.ASCII.GetBytes', meaning: 'Sockets carry bytes, not strings, so the text is encoded first: 12 bytes.' },
    { code: 'Send', meaning: 'Returns once all 12 bytes are queued in the kernel.' }],

    returns: '12, the number of bytes queued.'
  },
  {
    what: 'Waits for the reply, then copies it out of the receive buffer.',
    parts: [
    { code: 'buf', meaning: 'Up to 1024 bytes. A large reply can arrive over several Receive() calls.' },
    { code: 'int n', meaning: 'Bytes received. 0 means the server closed.' }],

    returns: 'bytes read.'
  },
  {
    what: 'User space only. No system call touches the socket here.',
    parts: [{ code: 'GetString(buf, 0, n)', meaning: 'Decodes exactly n bytes: "HELLO SERVER".' }]
  },
  {
    what: 'Closes fd 3. The client closes first, so it sends the first FIN and later waits in TIME_WAIT.',
    parts: [{ code: 'cli.Close()', meaning: 'After this, using cli throws ObjectDisposedException.' }],
    returns: 'nothing.'
  }]

};