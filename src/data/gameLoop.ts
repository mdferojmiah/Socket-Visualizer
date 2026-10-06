export type GamePlayerColor = 'client' | 'server' | 'ok';

export interface GamePlayerMeta {
  id: string;
  name: string;
  color: GamePlayerColor;
  latencyMs: number;
  /** Player changes direction every N ticks (or when they'd hit a wall) */
  changeEvery: number;
  start: {x: number;y: number;};
}

export const gamePlayers: GamePlayerMeta[] = [
{ id: 'alice', name: 'Alice', color: 'client', latencyMs: 28, changeEvery: 3, start: { x: 20, y: 15 } },
{ id: 'bob', name: 'Bob', color: 'server', latencyMs: 41, changeEvery: 4, start: { x: 80, y: 40 } },
{ id: 'cara', name: 'Cara', color: 'ok', latencyMs: 63, changeEvery: 5, start: { x: 45, y: 50 } }];


export const ARENA = { width: 100, height: 60, min: 5, maxX: 95, maxY: 55, step: 5 };

export const TICK_RATE = 20;

export const gameServerCode: string[] = [
'// GameServer.cs — authoritative server, 20 ticks/s (ASP.NET Core)',
'var app = WebApplication.Create(args);',
'app.UseWebSockets();',
'var players = new ConcurrentDictionary<WebSocket, Player>();',
'',
'app.Map("/play", async ctx => {',
'    using var ws = await ctx.WebSockets.AcceptWebSocketAsync();',
'    var me = players[ws] = new Player();',
'    var buf = new byte[64];',
'    while (ws.State == WebSocketState.Open) {       // inputs arrive any time',
'        var r = await ws.ReceiveAsync(buf, default);',
'        me.Move = JsonSerializer.Deserialize<Move>(buf.AsSpan(0, r.Count));',
'    }',
'    players.TryRemove(ws, out _);',
'});',
'',
'_ = Task.Run(async () => {',
'    var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(50));',
'    for (int tick = 1; await timer.WaitForNextTickAsync(); tick++) {',
'        foreach (var p in players.Values) {           // simulate',
'            p.X += p.Move.Dx * 5;',
'            p.Y += p.Move.Dy * 5;',
'        }',
'        var snapshot = JsonSerializer.SerializeToUtf8Bytes(new { tick,',
'            players = players.Values.Select(p => new[] { p.X, p.Y }) });',
'        foreach (var ws in players.Keys)                // broadcast',
'            _ = ws.SendAsync(snapshot, WebSocketMessageType.Text, true, default);',
'    }',
'});',
'',
'app.Run("https://0.0.0.0:9000");'];


export const gameClientCode: string[] = [
"// GameClient.cs — Unity script on each player's machine",
'public class GameClient : MonoBehaviour {',
'    readonly ClientWebSocket ws = new();',
'    Snapshot latest;',
'    Move last;',
'',
'    async void Start() {',
'        await ws.ConnectAsync(new Uri("wss://game.example/play"), default);',
'        var buf = new byte[4096];',
'        while (ws.State == WebSocketState.Open) {',
'            var r = await ws.ReceiveAsync(buf, default);',
'            latest = JsonUtility.FromJson<Snapshot>(Encoding.UTF8.GetString(buf, 0, r.Count));',
'        }',
'    }',
'',
'    void Update() {                                   // every frame, ~60 fps',
'        var move = new Move((int)Input.GetAxisRaw("Horizontal"),',
'                            (int)Input.GetAxisRaw("Vertical"));',
'        if (!move.Equals(last)) {                     // only when keys change',
'            last = move;',
'            var bytes = Encoding.UTF8.GetBytes(JsonUtility.ToJson(move));',
'            _ = ws.SendAsync(bytes, WebSocketMessageType.Text, true, default);',
'        }',
'        Draw(latest);                                 // newest snapshot wins',
'    }',
'}'];


export const gameReasons = [
{
  title: 'The server is the referee',
  body: 'Players send intent (“moving left”), never positions. Only the server moves anyone, so a modified client can’t teleport or walk through walls.'
},
{
  title: 'A fixed tick, not a request per action',
  body: 'The loop runs on a clock: about 20 ticks/s for casual games, 64–128 for competitive shooters. Every tick ends with one snapshot broadcast to all sockets.'
},
{
  title: 'Tiny messages on sockets already open',
  body: 'Inputs are ~20 bytes and snapshots a few hundred. No handshake per message, and Nagle’s algorithm is turned off (Socket.NoDelay = true) so small frames leave immediately.'
},
{
  title: 'When TCP gets in the way',
  body: 'If one packet is lost, TCP holds back every later snapshot until it’s retransmitted. Fast shooters use UDP instead, where a stale snapshot is simply skipped. In Unity that’s typically a UDP transport such as Netcode’s Unity Transport.'
}];