import type { CodeNote, Side } from '../types/socket';

/** Index k-1 explains statement k (the `line` value in step snapshots). */
export const udpCodeNotes: Record<Side, CodeNote[]> = {
  server: [
  {
    what: 'The same namespaces as the TCP version. UDP and TCP share one Socket API; the socket type picks the protocol.',
    parts: [{ code: 'System.Net.Sockets', meaning: 'Socket, SocketType.Dgram, ProtocolType.Udp.' }]
  },
  {
    what: 'Creates a UDP socket. It has a receive queue only, with no connection state.',
    parts: [
    { code: 'SocketType.Dgram', meaning: 'Datagram socket. Each send is one self-contained packet.' },
    { code: 'ProtocolType.Udp', meaning: 'UDP. The kernel adds an 8-byte header to each datagram.' }],

    returns: 'a Socket wrapping fd 3.'
  },
  {
    what: 'Claims port 9090. That’s all the setup UDP needs, with no Listen() or Accept().',
    parts: [
    { code: 'IPAddress.Any', meaning: 'Every interface.' },
    { code: '9090', meaning: 'Datagrams sent to this port are queued on this socket.' }],

    returns: 'nothing, or SocketException if the port is taken.'
  },
  {
    what: 'Sleeps until one whole datagram arrives, then returns it and writes the sender’s address into peer.',
    parts: [
    { code: 'buf', meaning: '1024 bytes. A bigger datagram throws SocketException (MessageSize) and the extra is lost.' },
    { code: 'ref peer', meaning: 'With no connection, the sender’s address comes with each datagram. .NET fills it in here.' }],

    returns: 'the size of this one datagram.'
  },
  {
    what: 'Line 8 builds the uppercase reply, then SendTo() sends one datagram back to whoever sent the request.',
    parts: [
    { code: 'reply', meaning: 'The reply payload.' },
    { code: 'peer', meaning: 'The destination, given with every call because the socket isn’t connected.' }],

    returns: 'bytes sent. Delivery isn’t guaranteed.'
  },
  {
    what: 'Frees the socket and its port immediately. Nothing is sent on the network.',
    parts: [{ code: 'srv.Close()', meaning: 'No FIN and no TIME_WAIT. Queued datagrams are discarded.' }],
    returns: 'nothing.'
  }],

  client: [
  {
    what: 'The same namespaces the server uses.',
    parts: [{ code: 'System.Net.Sockets', meaning: 'The same API on both ends.' }]
  },
  {
    what: 'Creates the client’s UDP socket. It doesn’t need Bind() or Connect().',
    parts: [{ code: 'SocketType.Dgram', meaning: 'UDP. The kernel assigns a port on the first SendTo().' }],
    returns: 'a Socket wrapping fd 3.'
  },
  {
    what: 'Sends one datagram straight to the server endpoint built on line 4, with no handshake.',
    parts: [
    { code: 'GetBytes("hello server")', meaning: 'The 12-byte payload. The kernel adds an 8-byte UDP header.' },
    { code: 'server', meaning: 'The destination 10.0.0.2:9090, passed with every call.' }],

    returns: 'bytes sent. Success only means it left the machine.'
  },
  {
    what: 'Waits for one reply datagram.',
    parts: [
    { code: 'ref from', meaning: 'Receives the sender’s address. The code ignores it.' },
    { code: 'buf', meaning: 'Maximum datagram size to accept: 1024.' }],

    returns: 'bytes received. Waits forever if the reply is lost, unless ReceiveTimeout is set.'
  },
  {
    what: 'User space only. Prints the reply.',
    parts: [{ code: 'GetString(buf, 0, n)', meaning: '"HELLO SERVER".' }]
  },
  {
    what: 'Frees the socket immediately. The server is never told.',
    parts: [{ code: 'cli.Close()', meaning: 'Nothing goes on the network. Port 41022 is free again right away.' }],
    returns: 'nothing.'
  }]

};