import type { CodeListing } from '../types/socket';

/** Client sockets drawn in the visual. Real instances hold 10,000+ of these. */
export const redisConnections = Array.from({ length: 48 }, (_, i) => i + 7);

export const redisTotalClients = 10000;

export const redisCommands: {cmd: string;reply: string;}[] = [
{ cmd: 'GET user:42:name', reply: '"alice"' },
{ cmd: 'SET session:9f2c "{…}" EX 3600', reply: 'OK' },
{ cmd: 'INCR page:home:views', reply: '(integer) 18231' },
{ cmd: 'LPUSH queue:emails job:771', reply: '(integer) 4' },
{ cmd: 'HGET cart:1187 total', reply: '"59.90"' },
{ cmd: 'ZADD leaderboard 980 bob', reply: '(integer) 1' },
{ cmd: 'EXPIRE ratelimit:10.2.3.4 60', reply: '(integer) 1' },
{ cmd: 'PING', reply: 'PONG' },
{ cmd: 'SISMEMBER online:users 42', reply: '(integer) 1' },
{ cmd: 'GET feature:new-checkout', reply: '"on"' }];


/** Simplified from Redis src/ae.c and src/ae_epoll.c */
export const redisListing: CodeListing = {
  lines: [
  '// ae.c: the entire server is this loop',
  'void aeMain(aeEventLoop *eventLoop) {',
  '    while (!eventLoop->stop)',
  '        aeProcessEvents(eventLoop, AE_ALL_EVENTS);',
  '}',
  '',
  'int aeProcessEvents(aeEventLoop *eventLoop, int flags) {',
  '    // beforeSleep: write replies queued last round',
  '    eventLoop->beforesleep(eventLoop);',
  '',
  '    // ae_epoll.c: one syscall covers every client',
  '    int n = epoll_wait(state->epfd, state->events,',
  '                       eventLoop->setsize, timeout);',
  '',
  '    for (int j = 0; j < n; j++) {',
  '        int fd = state->events[j].data.fd;',
  '        aeFileEvent *fe = &eventLoop->events[fd];',
  '        // readQueryFromClient → processCommand → addReply',
  '        fe->rfileProc(eventLoop, fd, fe->clientData, mask);',
  '    }',
  '    return n;',
  '}'],

  anchors: [12, 15, 19, 9]
};

export const redisReasons: {title: string;body: string;}[] = [
{
  title: 'Cost follows activity, not connections',
  body: 'epoll_wait() returns only the sockets that have data. 10,000 idle clients add nothing to a loop iteration, so there’s no scanning and no thread per client.'
},
{
  title: 'Every command runs in memory',
  body: 'GET, SET and INCR touch RAM and finish in about a microsecond. One core can execute hundreds of thousands of them per second. The network runs out before the CPU does.'
},
{
  title: 'Nothing ever blocks',
  body: 'Every socket is non-blocking. The thread reads only what has arrived and queues replies. With no locks and no context switches, each command is atomic for free.'
},
{
  title: 'The catch',
  body: 'One slow command, like KEYS * on a big database, stalls every client. Redis 6+ can hand socket reads and writes to I/O threads, but commands still execute on the main thread. To go past one core, you shard with Redis Cluster.'
}];