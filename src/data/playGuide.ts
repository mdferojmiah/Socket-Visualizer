/** One instruction per entry in the play-zone tour (utils/playgroundEngine.ts → tour), in the same order. */
export const playGuide: {goal: string;why: string;}[] = [
{
  goal: 'Create the server’s socket',
  why: 'Every network program starts by asking its kernel for a socket. You’ll get back a file descriptor, a number that names it.'
},
{
  goal: 'Give the socket an address',
  why: 'bind() claims port 8080 so packets addressed to it have somewhere to go.'
},
{
  goal: 'Start listening',
  why: 'listen() turns the socket into a receptionist. From now on the kernel answers handshakes on its own.'
},
{
  goal: 'Wait for a client',
  why: 'accept() will put the server to sleep because no one has connected yet. That’s expected. Watch its status change to Blocked.'
},
{
  goal: 'Switch to the client and create its socket',
  why: 'The server is asleep and can’t do anything. The client needs its own socket in its own kernel.'
},
{
  goal: 'Connect to the server',
  why: 'Watch the Network strip: SYN, SYN-ACK, ACK. When the handshake finishes, the sleeping accept() on the server wakes up.'
},
{
  goal: 'Send a message from the client',
  why: 'Type a message (12 characters max) and press send(). Notice that send() returns before the bytes arrive.'
},
{
  goal: 'Read it on the server',
  why: 'The bytes are waiting in the server’s receive buffer. recv() copies them into the program.'
},
{
  goal: 'Reply from the server',
  why: 'Type a reply and press send() on the server. The same path runs in reverse.'
},
{
  goal: 'Read the reply on the client',
  why: 'recv() on the client returns the server’s message.'
},
{
  goal: 'Close the client',
  why: 'close() sends a FIN. The server will move to CLOSE_WAIT: it knows no more data is coming.'
},
{
  goal: 'Notice the hang-up on the server',
  why: 'recv() returns 0 bytes. That empty read is how a program learns the other side closed.'
},
{
  goal: 'Close the server’s connection',
  why: 'This finishes the four-way teardown. The listener on fd 3 stays open for the next client.'
}];