import type { CodeListing } from '../types/socket';
import type { EpollPhase } from '../types/epoll';

export const epollPhases: {id: EpollPhase;label: string;}[] = [
{ id: 'setup', label: 'Set up epoll' },
{ id: 'connect', label: 'First connections' },
{ id: 'data', label: 'Data arrives' },
{ id: 'teardown', label: 'Client leaves' }];


export const wakeupHops = [
'NIC',
'TCP/IP stack',
'socket queue',
'socket wait queue',
'ep_poll_callback()',
'ready list',
'wake epoll_wait'];


/*
 * Statement numbers used by step snapshots:
 * 1 socket  2 listen  3 epoll_create  4 register listener  5 epoll_wait
 * 6 accept  7 register conn  8 recv  9 send  10 close
 */
export const epollListing: CodeListing = {
  lines: [
  'using System.Net; using System.Net.Sockets;',
  'using static Epoll;   // [DllImport("libc")] epoll_create1, epoll_ctl, epoll_wait',
  '',
  'var srv = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);',
  'srv.Bind(new IPEndPoint(IPAddress.Any, 8080)); srv.Listen(128);',
  'int ep = epoll_create1(0);',
  'var ev = new EpollEvent { events = EPOLLIN, fd = (int)srv.Handle };',
  'epoll_ctl(ep, EPOLL_CTL_ADD, (int)srv.Handle, ref ev);',
  'var conns = new Dictionary<int, Socket>();',
  'var ready = new EpollEvent[64]; var buf = new byte[1024];',
  'while (true) {',
  '    int n = epoll_wait(ep, ready, 64, -1);',
  '    for (int i = 0; i < n; i++) {',
  '        int fd = ready[i].fd;',
  '        if (fd == (int)srv.Handle) {',
  '            Socket c = srv.Accept();',
  '            ev.fd = (int)c.Handle; conns[ev.fd] = c;',
  '            epoll_ctl(ep, EPOLL_CTL_ADD, ev.fd, ref ev);',
  '        } else {',
  '            int len = conns[fd].Receive(buf);',
  '            if (len > 0) conns[fd].Send(buf, len, SocketFlags.None);',
  '            else { conns[fd].Close(); conns.Remove(fd); }   // leaves epoll too',
  '        }',
  '    }',
  '}'],

  anchors: [4, 5, 6, 8, 12, 16, 18, 20, 21, 22]
};