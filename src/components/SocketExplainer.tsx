import React, { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';
import { SocketWalkthrough } from './SocketWalkthrough';
import { EpollWalkthrough } from './epoll/EpollWalkthrough';
import { PlayZone } from './playground/PlayZone';
import { WebSocketWalkthrough } from './websocket/WebSocketWalkthrough';
import type { Protocol } from '../types/socket';

type Topic = Protocol | 'epoll' | 'websocket' | 'play';

const titles: Record<Topic, string> = {
  tcp: 'How a TCP socket works',
  udp: 'How a UDP socket works',
  epoll: 'How epoll watches sockets',
  websocket: 'How WebSocket works on top of a socket',
  play: 'Socket play zone'
};

const subtitles: Record<Topic, React.ReactNode> = {
  tcp:
  <>
      A connected byte stream. Follow an echo client and server through every system call, packet and kernel buffer, from{' '}
      <code className="font-mono text-ink">socket()</code> to <code className="font-mono text-ink">TIME_WAIT</code>.
    </>,

  udp:
  <>
      Datagrams with no connection. The same echo exchange with no handshake, no ACKs and no teardown, just{' '}
      <code className="font-mono text-ink">sendto()</code> and <code className="font-mono text-ink">recvfrom()</code>.
    </>,

  epoll:
  <>
      One thread, many sockets. See how <code className="font-mono text-ink">epoll_ctl()</code> puts a callback on each
      socket’s wait queue, so the kernel tells you which sockets are ready instead of you checking every one.
    </>,

  websocket:
  <>
      A long-lived, two-way message channel built on one ordinary TCP socket. See the HTTP{' '}
      <code className="font-mono text-ink">Upgrade</code>, the frames behind <code className="font-mono text-ink">SendAsync()</code>,
      how a server relays chat between users, and how online games use the same sockets.
    </>,

  play:
  <>
      Build a TCP connection yourself. Make each system call on the client and the server, then watch the packets, kernel
      queues, buffers and states respond, along with the code you’ve written so far.
    </>

};

export function SocketExplainer() {
  const [topic, setTopic] = useState<Topic>('tcp');

  return (
    <div className="min-h-screen w-full bg-canvas text-ink">
      <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-8 md:px-6">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[32px] font-semibold leading-tight tracking-tight md:text-4xl">{titles[topic]}</h1>
            <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{subtitles[topic]}</p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className="flex flex-wrap gap-2">
              <SegmentedControl
                label="Topic"
                value={topic}
                onChange={setTopic}
                options={[
                { value: 'tcp', label: 'TCP' },
                { value: 'udp', label: 'UDP' },
                { value: 'epoll', label: 'epoll' },
                { value: 'websocket', label: 'WebSocket' },
                { value: 'play', label: 'Play zone' }]
                } />
              
            </div>
            <p className={`hidden text-xs text-muted ${topic === 'play' ? '' : 'md:block'}`}>
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">←</kbd>{' '}
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">→</kbd> step ·{' '}
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">space</kbd> play
            </p>
          </div>
        </header>

        <main>
          {topic === 'play' ?
          <PlayZone /> :
          topic === 'websocket' ?
          <WebSocketWalkthrough /> :
          topic === 'epoll' ?
          <EpollWalkthrough /> :

          <SocketWalkthrough key={topic} protocol={topic} />
          }
        </main>
      </div>
    </div>);

}