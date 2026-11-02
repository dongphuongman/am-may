import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { SEATS, FILL_ORDER, SKINS, SUTRA, OFFERINGS } from './public/seats.js';

const PORT = Number(process.env.PORT) || 5173;
const PROD = process.env.NODE_ENV === 'production';
const CAPACITY = SEATS.length;
const DEFAULT_ROOMS = ['am-1', 'am-2', 'am-3', 'am-4', 'am-5', 'am-6'];
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

/** room name -> { clients: Map<id, {ws, me}> } ; seats are read off the clients. */
const rooms = new Map();
function getRoom(name) {
  let room = rooms.get(name);
  if (!room) {
    room = { clients: new Map() };
    rooms.set(name, room);
  }
  return room;
}
const takenSeats = (room) => new Set([...room.clients.values()].map((c) => c.me.seat));

const cleanRoom = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || 'Phật tử';
// Minimal profanity filter for wishes; extend as needed.
const BLOCKED = /(?<!\p{L})(địt|đụ|lồn|cặc|buồi|đéo|dm|đm|vcl|vl|fuck|shit|bitch)(?!\p{L})/giu;
const cleanWish = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f<>]/g, '')
  .replace(/\s+/g, ' ').trim().slice(0, 80).replace(BLOCKED, '***');
const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));

function broadcast(room, msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const [id, c] of room.clients) if (id !== exceptId && c.ws.readyState === 1) c.ws.send(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  if (url.pathname === '/api/rooms') {
    const names = new Set([...DEFAULT_ROOMS, ...rooms.keys()]);
    const list = [...names].map((room) => ({ room, count: rooms.get(room)?.clients.size ?? 0, capacity: CAPACITY }));
    res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
    res.end(JSON.stringify(list));
    return;
  }
  try {
    const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const file = normalize(join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC)) throw new Error('outside');
    const data = await readFile(file);
    const headers = { 'content-type': MIME[extname(file)] || 'application/octet-stream' };
    // Prayer poses get re-imported while drawing them, so locally always check for a newer file; deployed, let the
    // CDN keep them for an hour.
    if (rel.startsWith('/assets/pray/')) headers['cache-control'] = PROD ? 'public, max-age=3600' : 'no-cache';
    else if (rel.startsWith('/assets/')) headers['cache-control'] = 'public, max-age=86400';
    res.writeHead(200, headers);
    res.end(data);
  } catch {
    // never let the CDN keep a 404: during a redeploy the old container briefly answers for files only the new one has
    res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    res.end('Not found');
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });
let nextId = 1;

wss.on('connection', (ws, req) => {
  const roomName = cleanRoom(new URL(req.url, 'http://local').searchParams.get('room')) || DEFAULT_ROOMS[0];
  const room = getRoom(roomName);
  if (room.clients.size >= CAPACITY) {
    send(ws, { t: 'full', room: roomName });
    ws.close();
    return;
  }

  const id = String(nextId++);
  const me = { id, name: 'Phật tử', skin: 'man', seat: -1, merit: 0 };
  let joined = false;
  const last = {};
  const rateOk = (key, ms) => {
    const now = Date.now();
    if (now - (last[key] || 0) < ms) return false;
    last[key] = now;
    return true;
  };

  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (!joined) {
      if (m.t !== 'hello') return;
      const taken = takenSeats(room);
      const seat = FILL_ORDER.find((i) => !taken.has(i));
      if (seat === undefined) { send(ws, { t: 'full', room: roomName }); ws.close(); return; }
      joined = true;
      me.name = cleanName(m.name);
      me.skin = SKINS.includes(m.skin) ? m.skin : 'man';
      me.seat = seat;
      room.clients.set(id, { ws, me });
      send(ws, {
        t: 'welcome', id, seat, room: roomName, capacity: CAPACITY, now: Date.now(),
        peers: [...room.clients.values()].filter((c) => c.me.id !== id).map((c) => c.me),
      });
      broadcast(room, { t: 'join', p: me }, id);
      return;
    }

    switch (m.t) {
      case 'seat': {
        const seat = Number(m.seat);
        if (!Number.isInteger(seat) || !SEATS[seat] || takenSeats(room).has(seat) || !rateOk('seat', 1500)) break;
        me.seat = seat;
        broadcast(room, { t: 'seat', id, seat });
        break;
      }
      case 'chant': {
        const line = Number(m.line);
        if (!Number.isInteger(line) || !SUTRA[line] || !rateOk('chant', 2000)) break;
        me.merit += 1;
        broadcast(room, { t: 'chant', id, line, merit: me.merit });
        break;
      }
      case 'bow':
        if (rateOk('bow', 2500)) broadcast(room, { t: 'bow', id }, id);
        break;
      case 'mo':
        if (rateOk('mo', 150)) broadcast(room, { t: 'mo', id }, id);
        break;
      case 'offer': {
        const o = OFFERINGS[m.kind];
        if (!o || !rateOk(`offer-${m.kind}`, o.cooldown)) break;
        me.merit += o.merit;
        broadcast(room, { t: 'offer', id, kind: m.kind, wish: cleanWish(m.wish), merit: me.merit });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!joined) return;
    room.clients.delete(id);
    broadcast(room, { t: 'leave', id });
    if (!room.clients.size && !DEFAULT_ROOMS.includes(roomName)) rooms.delete(roomName);
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

server.listen(PORT, () => console.log(`Am Mây · Chánh điện: http://localhost:${PORT}`));
