import type { CodeListing, Protocol, Side } from '../types/socket';

type ListingPair = Record<Side, CodeListing>;

const USINGS = 'using System.Net; using System.Net.Sockets; using System.Text;';

const tcp: ListingPair = {
  server: {
    lines: [
    USINGS,
    '',
    'var srv = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);',
    'srv.Bind(new IPEndPoint(IPAddress.Any, 8080));',
    'srv.Listen(5);',
    'Socket conn = srv.Accept();          // blocks',
    'var buf = new byte[1024];',
    'int n = conn.Receive(buf);',
    'var reply = Encoding.ASCII.GetBytes(Encoding.ASCII.GetString(buf, 0, n).ToUpper());',
    'conn.Send(reply);',
    'conn.Close();'],

    anchors: [1, 3, 4, 5, 6, 8, 10, 11]
  },
  client: {
    lines: [
    USINGS,
    '',
    'var cli = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);',
    'cli.Connect(new IPEndPoint(IPAddress.Parse("10.0.0.2"), 8080));',
    'cli.Send(Encoding.ASCII.GetBytes("hello server"));',
    'var buf = new byte[1024];',
    'int n = cli.Receive(buf);',
    'Console.WriteLine(Encoding.ASCII.GetString(buf, 0, n));   // HELLO SERVER',
    'cli.Close();'],

    anchors: [1, 3, 4, 5, 7, 8, 9]
  }
};

const udp: ListingPair = {
  server: {
    lines: [
    USINGS,
    '',
    'var srv = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, ProtocolType.Udp);',
    'srv.Bind(new IPEndPoint(IPAddress.Any, 9090));',
    'var buf = new byte[1024];',
    'EndPoint peer = new IPEndPoint(IPAddress.Any, 0);',
    'int n = srv.ReceiveFrom(buf, ref peer);   // blocks',
    'var reply = Encoding.ASCII.GetBytes(Encoding.ASCII.GetString(buf, 0, n).ToUpper());',
    'srv.SendTo(reply, peer);',
    'srv.Close();'],

    anchors: [1, 3, 4, 7, 9, 10]
  },
  client: {
    lines: [
    USINGS,
    '',
    'var cli = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, ProtocolType.Udp);',
    'var server = new IPEndPoint(IPAddress.Parse("10.0.0.2"), 9090);',
    'cli.SendTo(Encoding.ASCII.GetBytes("hello server"), server);',
    'var buf = new byte[1024]; EndPoint from = new IPEndPoint(IPAddress.Any, 0);',
    'int n = cli.ReceiveFrom(buf, ref from);',
    'Console.WriteLine(Encoding.ASCII.GetString(buf, 0, n));   // HELLO SERVER',
    'cli.Close();'],

    anchors: [1, 3, 5, 7, 8, 9]
  }
};

export const listings: Record<Protocol, ListingPair> = { tcp, udp };

export const endpoints: Record<Protocol, Record<Side, {name: string;ip: string;port: number;}>> = {
  tcp: {
    client: { name: 'Client', ip: '10.0.0.1', port: 52814 },
    server: { name: 'Server', ip: '10.0.0.2', port: 8080 }
  },
  udp: {
    client: { name: 'Client', ip: '10.0.0.1', port: 41022 },
    server: { name: 'Server', ip: '10.0.0.2', port: 9090 }
  }
};

export const phases = [
{ id: 'setup', label: 'Setup' },
{ id: 'handshake', label: 'Handshake' },
{ id: 'transfer', label: 'Data transfer' },
{ id: 'teardown', label: 'Teardown' }] as
const;