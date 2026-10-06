import type { WsChatMessage, WsLayer } from '../types/websocket';

export const wsPhases = [
{ id: 'connect', label: 'Connect' },
{ id: 'upgrade', label: 'HTTP upgrade' },
{ id: 'message', label: 'Messages' },
{ id: 'keepalive', label: 'Ping' },
{ id: 'close', label: 'Close' }] as
const;

export const wsChatMessages: WsChatMessage[] = [
{ from: 'alice', text: 'Game tonight?' },
{ from: 'bob', text: 'In. 9pm?' }];


export const wsClientCode: string[] = [
'// ChatClient.cs — the same app runs for Alice and Bob',
'using var ws = new ClientWebSocket();',
'await ws.ConnectAsync(new Uri("wss://chat.example/ws"), default);',
'SetStatus("online");',
'',
'async Task SendMessage(string text) {',
'    var json = JsonSerializer.SerializeToUtf8Bytes(new { from = me, text });',
'    await ws.SendAsync(json, WebSocketMessageType.Text, true, default);',
'    RenderBubble(me, text);',
'}',
'',
'var buf = new byte[4096];',
'while (ws.State == WebSocketState.Open) {',
'    var r = await ws.ReceiveAsync(buf, default);',
'    if (r.MessageType == WebSocketMessageType.Close) break;',
'    var msg = JsonSerializer.Deserialize<ChatMessage>(buf.AsSpan(0, r.Count))!;',
'    RenderBubble(msg.From, msg.Text);',
'}',
'',
'async Task Quit() =>',
'    await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, null, default);'];


export const wsServerCode: string[] = [
'// Server.cs — ASP.NET Core (.NET 9)',
'var app = WebApplication.Create(args);',
'var clients = new ConcurrentDictionary<WebSocket, byte>();',
'app.UseWebSockets(new() { KeepAliveInterval = TimeSpan.FromSeconds(20),',
'                          KeepAliveTimeout = TimeSpan.FromSeconds(20) });',
'',
'app.Map("/ws", async ctx => {',
'    using var ws = await ctx.WebSockets.AcceptWebSocketAsync();',
'    clients.TryAdd(ws, 0);                          // connection is open',
'    var buf = new byte[4096];',
'    try {',
'        while (true) {',
'            var r = await ws.ReceiveAsync(buf, default);   // one frame -> one message',
'            if (r.MessageType == WebSocketMessageType.Close) break;',
'            foreach (var peer in clients.Keys.Where(p => p != ws))',
'                await peer.SendAsync(buf.AsMemory(0, r.Count),',
'                    WebSocketMessageType.Text, true, default);',
'        }',
'    } finally {',
'        clients.TryRemove(ws, out _);               // closed or dropped',
'        await ws.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, default);',
'    }',
'});',
'',
'app.Run("https://0.0.0.0:443");'];


export const wsLayers: {id: WsLayer;name: string;detail: string;}[] = [
{ id: 'app', name: 'Your app', detail: 'SendAsync() · ReceiveAsync(): whole messages' },
{ id: 'ws', name: 'WebSocket', detail: 'frames, masking, ping/pong, close' },
{ id: 'http', name: 'HTTP/1.1', detail: 'used once, for the Upgrade request' },
{ id: 'tls', name: 'TLS', detail: 'encrypts the bytes for wss://' },
{ id: 'tcp', name: 'TCP socket', detail: 'socket(), connect(), send(), recv()' },
{ id: 'ip', name: 'IP', detail: 'packets between machines' }];


export const wsOverviewPoints = [
{
  title: 'It starts as one HTTP request',
  body: 'The client opens a normal TCP socket and sends GET with “Upgrade: websocket”. The server answers 101 Switching Protocols, and HTTP is finished for the life of the connection.'
},
{
  title: 'Then it’s frames on the same socket',
  body: 'Every SendAsync() becomes a small frame (a 2–14 byte header plus the payload) written into that TCP socket. TCP still does the ordering, ACKs and retransmits underneath.'
},
{
  title: 'Either side can talk at any time',
  body: 'HTTP only answers requests. Over a WebSocket the server can push to the client whenever it wants, which is why chat, live feeds and online games use it instead of polling.'
}];