// Am Mây · chánh điện online (2.5D).
import { STAGE, FLOOR, SEATS, FILL_ORDER, SKINS, SUTRA, OFFERINGS, scaleAtY } from './seats.js';
import { Sound } from './audio.js';
import { lunarAt, solarToLunar } from './lunar.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const ROOM = (params.get('room') || 'am-1').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'am-1';
const FORCE_EVENT = params.get('event');
const FORCE_FESTIVAL = ['trungthu', 'vulan'].includes(params.get('festival')) ? params.get('festival') : null;
const store = {
  get: (k) => localStorage.getItem(`ammay.${k}`),
  set: (k, v) => localStorage.setItem(`ammay.${k}`, v),
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const SW = STAGE.W, SH = STAGE.H;
const canvas = $('#c');
const ctx = canvas.getContext('2d');
canvas.width = SW;
canvas.height = SH;

// On PC the stage is wider than the 9:16 painting. The painting grows as large as the height allows (cropping
// only the ceiling: VIEW_TOP..VIEW_BOTTOM keeps the statue, altar and every cushion), sits in the middle, and
// mirrored strips of its own edges continue the hall on either side.
const VIEW_TOP = 330, VIEW_BOTTOM = 1760;
const wings = $('#wings');
function fitCanvas() {
  const r = $('#stage').getBoundingClientRect();
  if (!r.width) return;
  const k = Math.min(r.height / (VIEW_BOTTOM - VIEW_TOP), r.width / SW); // screen px per painting px
  const pw = SW * k, visible = r.height / k;
  const top = Math.max(0, Math.min(SH - visible, VIEW_BOTTOM - visible));
  const left = (r.width - pw) / 2;
  Object.assign(canvas.style, { width: `${pw}px`, height: `${SH * k}px`, left: `${left}px`, top: `${-top * k}px` });
  drawWings(r, k, left, top, visible);
}
function drawWings(r, k, left, top, visible) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  wings.width = Math.round(r.width * dpr);
  wings.height = Math.round(r.height * dpr);
  const w = wings.getContext('2d');
  if (left < 1 || !A.hall?.naturalWidth) return;
  w.scale(dpr, dpr);
  const strip = Math.min(SW, left / k); // painting columns mirrored into each wing
  w.filter = 'brightness(.95)';
  w.save();
  w.translate(left, 0);
  w.scale(-1, 1);
  w.drawImage(A.hall, 0, top, strip, visible, 0, 0, strip * k, r.height);
  w.restore();
  w.save();
  w.translate(left + SW * k, 0);
  w.scale(-1, 1);
  w.drawImage(A.hall, SW - strip, top, strip, visible, -strip * k, 0, strip * k, r.height);
  w.restore();
  w.filter = 'none';
  // Fade into darkness away from the painting, plus a soft seam shadow.
  for (const [x0, x1] of [[left, 0], [left + SW * k, r.width]]) {
    const g = w.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(20,9,4,0)');
    g.addColorStop(0.4, 'rgba(20,9,4,.35)');
    g.addColorStop(1, 'rgba(20,9,4,.85)');
    w.fillStyle = g;
    w.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), r.height);
  }
}
new ResizeObserver(fitCanvas).observe($('#stage'));

// ---------- Assets ----------
const ASSET_FILES = {
  hall: 'hall.jpg',
  monk: 'c_monk.webp', nun: 'c_nun.webp', granny: 'c_granny.webp', man: 'c_man.webp', woman: 'c_woman.webp', child: 'c_child.webp',
  anim_man: 'anim_man.webp', anim_woman: 'anim_woman.webp', anim_granny: 'anim_granny.webp',
  lotus: 'fx_lotus.webp', halo: 'fx_halo.webp', bell: 'fx_bell.webp', incense: 'fx_incense.webp', petal: 'fx_petal.webp',
  mo: 'fx_mo.webp', banner: 'fx_banner.webp', scroll: 'fx_scroll.webp',
  p_nun: 'p_nun.webp', p_monk: 'p_monk.webp', p_child: 'p_child.webp',
};
const A = {};
for (const [k, f] of Object.entries(ASSET_FILES)) {
  A[k] = new Image();
  A[k].src = `/assets/${f}`;
}
A.hall.addEventListener('load', fitCanvas);
// Walk strips: 4 walking frames, standing, two sitting-down frames, seated with the sutra book.
const ANIM = { man: { fw: 212, fh: 300, seatH: 210 }, woman: { fw: 212, fh: 300, seatH: 220 }, granny: { fw: 195, fh: 300, seatH: 222 } };
const SKIN_LABELS = { man: 'Nam áo lam', woman: 'Nữ áo lam', granny: 'Áo nâu', nun: 'Ni cô', monk: 'Sư thầy', child: 'Chú tiểu' };
const DOOR = { x: SW / 2, y: SH + 120 };
// Objects painted on the altar that can be tapped.
const MO_SPOT = { x: 262, y: 1010, r: 70 };
const BOWL_SPOT = { x: 818, y: 1005, r: 70 };

// ---------- Sound, music, voice ----------
const sound = new Sound({ outdoor: false });
const MUSIC = [
  { key: 't1', name: 'Trăng trên rừng trúc', src: '/assets/music/music1.mp3' },
  { key: 't2', name: 'Hơi thở ban mai', src: '/assets/music/music2.mp3' },
  { key: 'sao', name: 'Sáo trúc (tổng hợp)' },
  { key: 'bau', name: 'Đàn bầu (tổng hợp)' },
  { key: 'off', name: 'Tắt nhạc' },
];
const track = new Audio();
track.loop = true;
track.volume = 0.35;
let musicKey = store.get('music2') || 't1';
function applyMusic() {
  const m = MUSIC.find((x) => x.key === musicKey) ?? MUSIC[0];
  $('#musicBtn').textContent = m.name;
  if (m.src) {
    sound.setInstrument('off');
    if (!track.src.endsWith(m.src)) track.src = m.src;
    if (!sound.muted && started) track.play().catch(() => {});
  } else {
    track.pause();
    sound.setInstrument(m.key === 'off' ? 'off' : m.key);
  }
}
$('#musicBtn').addEventListener('click', () => {
  const i = MUSIC.findIndex((x) => x.key === musicKey);
  musicKey = MUSIC[(i + 1) % MUSIC.length].key;
  store.set('music2', musicKey);
  applyMusic();
});
function toggleSound() {
  unlockAudio();
  sound.setMuted(!sound.muted);
  if (sound.muted) { track.pause(); speechSynthesis?.cancel(); }
  else applyMusic();
  $('#soundBtn').textContent = sound.muted ? 'Đang tắt' : 'Đang bật';
  $('#quickSound').classList.toggle('muted', sound.muted);
  $('#quickSound').setAttribute('aria-label', sound.muted ? 'Bật âm thanh' : 'Tắt âm thanh');
}
$('#soundBtn').addEventListener('click', toggleSound);
$('#quickSound').addEventListener('click', toggleSound);
document.addEventListener('visibilitychange', () => {
  if (!started) return;
  if (document.hidden) { sound.ctx?.suspend(); track.pause(); }
  else { sound.ctx?.resume(); if (!sound.muted) applyMusic(); }
});

let voiceOn = store.get('voice') !== 'off';
let viVoice = null;
function pickViVoice() {
  const voices = speechSynthesis?.getVoices?.() ?? [];
  viVoice = voices.find((v) => /^vi/i.test(v.lang)) ?? null;
  $('#voiceInfo').textContent = viVoice ? `Giọng đọc: ${viVoice.name}` : 'Máy này chưa có giọng đọc tiếng Việt, lời tụng chỉ hiện chữ.';
}
if ('speechSynthesis' in window) {
  pickViVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickViVoice);
}
function renderVoiceBtn() { $('#voiceBtn').textContent = voiceOn ? 'Đang bật' : 'Đang tắt'; }
renderVoiceBtn();
$('#voiceBtn').addEventListener('click', () => {
  voiceOn = !voiceOn;
  store.set('voice', voiceOn ? 'on' : 'off');
  renderVoiceBtn();
  if (!voiceOn) speechSynthesis?.cancel();
});
/** Speak Vietnamese text, ducking the music while the voice plays. */
function speak(text) {
  if (!voiceOn || !viVoice || sound.muted || !('speechSynthesis' in window)) return;
  if (speechSynthesis.speaking && speechSynthesis.pending) return; // keep the queue short
  const u = new SpeechSynthesisUtterance(text);
  u.voice = viVoice;
  u.lang = viVoice.lang;
  u.rate = 0.85;
  track.volume = 0.12;
  u.onend = u.onerror = () => { if (!speechSynthesis.speaking) track.volume = 0.35; };
  speechSynthesis.speak(u);
}

// ---------- People in the hall ----------
const visitors = new Map();
const fx = [];
const floaters = [];
let myId = null;
let haloPulse = 0;

function addVisitor(p, fromDoor) {
  const seat = SEATS[p.seat];
  const v = {
    id: p.id, name: p.name, skin: p.skin, seat: p.seat, merit: p.merit || 0, isMe: p.id === myId,
    x: fromDoor ? DOOR.x : seat.x, y: fromDoor ? DOOR.y : seat.y,
    state: fromDoor ? 'walk' : 'sit', frame: fromDoor ? 0 : 7, ft: 0, sitT: 0, fade: fromDoor ? 1 : 0,
    flip: false, bow: 0, prostrate: 0, glow: 0, phase: Math.random() * 6, bubble: null, knock: 0,
  };
  visitors.set(p.id, v);
  updateCount();
  renderBoard();
  return v;
}
function removeVisitor(id) {
  visitors.delete(id);
  updateCount();
  renderBoard();
}
function moveVisitor(v, seat) {
  v.seat = seat;
  if (ANIM[v.skin]) { v.state = 'walk'; v.frame = 0; }
  else { v.state = 'sit'; v.x = SEATS[seat].x; v.y = SEATS[seat].y; }
}
const updateCount = () => ($('#count').textContent = visitors.size);
function renderBoard() {
  // Phones show the top 3 (CSS), PC shows the whole list.
  const top = [...visitors.values()].filter((v) => v.merit > 0).sort((a, b) => b.merit - a.merit).slice(0, 10);
  const ol = $('#boardList');
  ol.innerHTML = '';
  for (const v of top) {
    const li = document.createElement('li');
    li.classList.toggle('me', v.isMe);
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = v.name;
    const s = document.createElement('span');
    s.className = 'm';
    s.textContent = v.merit;
    li.append(n, s);
    ol.append(li);
  }
  $('#board').classList.toggle('empty', top.length === 0);
}

// ---------- Feed, toast, dedication banner ----------
function feed(name, text, gift = false) {
  const d = document.createElement('div');
  d.className = 'msg' + (gift ? ' gift' : '');
  const b = document.createElement('b');
  b.textContent = name;
  d.append(b, ' ', text);
  const el = $('#feed');
  el.append(d);
  while (el.children.length > 30) el.firstChild.remove();
  el.scrollTop = el.scrollHeight;
}
let toastTimer;
function toast(text, ms = 3200) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
// Dedications queue up so every wish gets its moment on the banner.
const dedQueue = [];
let dedBusy = false;
function dedicate(name, kind, wish) {
  dedQueue.push({ name, kind, wish });
  if (dedQueue.length > 6) dedQueue.shift();
  if (!dedBusy) nextDedication();
}
function nextDedication() {
  const el = $('#dedication');
  const d = dedQueue.shift();
  if (!d) { dedBusy = false; el.hidden = true; return; }
  dedBusy = true;
  $('#dedName').textContent = `${d.name} · ${OFFERINGS[d.kind].label.toLowerCase()} hồi hướng`;
  $('#dedWish').textContent = d.wish;
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  speak(`${d.name} hồi hướng: ${d.wish}`);
  setTimeout(nextDedication, dedQueue.length ? 4500 : 7000);
}

// ---------- Effects for actions (local or from the network) ----------
function headOf(v) {
  const s = SEATS[v.seat]?.scale ?? 0.4;
  return { x: v.x, y: v.y - 230 * s, s };
}
function onChant(v, line) {
  v.bow = 1;
  v.bubble = { text: SUTRA[line], t: 4 };
  if (v.isMe) speak(SUTRA[line]);
}
// Lễ Phật: kneel (book put away), settle, three prostrations, settle, then sit back with the book.
// Seen from behind, a prostration is the head sinking out of sight behind a rounding back, so the pose
// is built from the sprite in three bands (head, back, legs) rather than squashing the whole figure.
const BOW_RAISE = 0.6, BOW_LEN = 1.9, BOW_COUNT = 3, BOW_LOWER = 0.4;
const BOW_TOTAL = BOW_RAISE + BOW_COUNT * BOW_LEN + BOW_LOWER;
// Rows in each source image: top of the head, neck, hips.
// The walking strips kneel without the book in frame 6; p_*.webp are the seated sprites with the book removed.
const BOW_POSE = {
  man: { img: 'anim_man', frame: 6, top: 58, neck: 108, hip: 230 },
  woman: { img: 'anim_woman', frame: 6, top: 52, neck: 108, hip: 232 },
  granny: { img: 'anim_granny', frame: 6, top: 64, neck: 120, hip: 236 },
  nun: { img: 'p_nun', top: 2, neck: 78, hip: 172 },
  monk: { img: 'p_monk', top: 2, neck: 70, hip: 172 },
  child: { img: 'p_child', top: 2, neck: 78, hip: 168 },
};
// Drawn prayer poses (tools/import_pray.py): 1 kneel, palms joined · 2 palms at the forehead · 3 bending · 4 forehead
// on the floor. Outfits without a full set keep the banded bow below.
const PRAY = {};
// Fetched only once the hall and the sprites are in, so the poses never hold up the first paint.
Promise.all(Object.values(A).map((im) => im.decode().catch(() => {})))
  .then(() => fetch('/assets/pray/manifest.json'))
  .then((r) => (r.ok ? r.json() : {}))
  .then(({ outfits = [] }) => {
    for (const k of outfits) {
      if (!SKINS.includes(k)) continue;
      const frames = [1, 2, 3, 4].map((n) => {
        const im = new Image();
        im.src = `/assets/pray/${k}_${n}.webp`;
        return im;
      });
      Promise.all(frames.map((im) => im.decode())).then(() => (PRAY[k] = frames.map(measurePose))).catch(() => {});
    }
  })
  .catch(() => {});
/** The cushion (the widest opaque row near the bottom), so the pose can be scaled and centred on the painted one. */
function measurePose(im) {
  const c = document.createElement('canvas');
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  const { data } = g.getImageData(0, 0, c.width, c.height);
  let cushion = 0, mid = c.width / 2;
  for (let y = Math.floor(c.height * 0.8); y < c.height; y++) {
    let a = -1, b = -1;
    for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3] > 100) { if (a < 0) a = x; b = x; }
    if (b - a > cushion) { cushion = b - a; mid = (a + b) / 2; }
  }
  return { im, cushion: cushion || c.width, mid };
}
function onBow(v) {
  if (v.prostrate > 0) return;
  v.prostrate = BOW_TOTAL;
  v.bowN = -1;
  v.glow = Math.max(v.glow, 0.6);
  feed(v.name, 'đảnh lễ Phật');
  if (v.isMe && v.state !== 'sit') toast('An tọa xong sẽ lễ');
}
const smooth = (t) => t * t * (3 - 2 * t);
/** Where in the ritual we are: which prostration (n) and how far the back is bent (lay). */
function bowState(v) {
  const e = BOW_TOTAL - v.prostrate;
  if (e < BOW_RAISE) return { n: -1, lay: 0, pose: e < BOW_RAISE / 2 ? 1 : 2 };
  const b = e - BOW_RAISE;
  if (b >= BOW_COUNT * BOW_LEN) return { n: BOW_COUNT, lay: 0, pose: 1 };
  const ph = b % BOW_LEN;
  const lay = ph < 0.5 ? smooth(ph / 0.5) : ph < 1 ? 1 : ph < 1.6 ? 1 - smooth((ph - 1) / 0.6) : 0;
  return { n: Math.floor(b / BOW_LEN), lay, pose: lay < 0.35 ? 2 : lay < 0.8 ? 3 : 4 };
}
/** Draw the praying figure with its feet at (0, y0); returns how tall it currently stands. */
function drawPrayer(v, scale, y0, lay, pose) {
  const drawn = PRAY[v.skin]?.[pose - 1];
  if (drawn) {
    // Match the drawn cushion to the painted one under this seat.
    const k = (SEATS[v.seat].scale * 260) / 0.95 / drawn.cushion;
    const w = drawn.im.naturalWidth * k, h = drawn.im.naturalHeight * k;
    ctx.drawImage(drawn.im, -drawn.mid * k, y0 - h, w, h); // a figure leaning to one side stays on its cushion
    return h;
  }
  const P = BOW_POSE[v.skin], anim = ANIM[v.skin], im = A[P.img];
  const sw = anim ? anim.fw : im.naturalWidth, sh = anim ? anim.fh : im.naturalHeight, sx = anim ? P.frame * anim.fw : 0;
  const ox = (-sw * scale) / 2, oy = -sh * scale + y0;
  const backH = (P.hip - P.neck) * (1 - 0.38 * lay);
  const sink = (P.hip - backH * 0.95 - P.top) * lay; // the head ends just behind the top of the back
  const fade = 1 - Math.max(0, (lay - 0.45) / 0.55);
  const headTop = fade > 0.3 ? P.top + sink : P.hip - backH;
  if (fade > 0) {
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * fade;
    ctx.drawImage(im, sx, 0, sw, P.neck, ox, oy + sink * scale, sw * scale, P.neck * scale);
    ctx.globalAlpha = base;
  }
  ctx.drawImage(im, sx, P.neck, sw, P.hip - P.neck, ox, oy + (P.hip - backH) * scale, sw * scale, backH * scale);
  ctx.drawImage(im, sx, P.hip, sw, sh - P.hip, ox, oy + P.hip * scale, sw * scale, (sh - P.hip) * scale);
  return (sh - headTop) * scale;
}
function onMo(v) {
  v.knock = 0.2;
  const h = headOf(v);
  fx.push({ kind: 'mo', x: h.x, y: h.y + 40 * h.s, scale: h.s * 0.45, t: 0, life: 0.9 });
  const vol = v.isMe ? 1 : 0.35;
  sound.mo(vol);
}
function onOffer(v, kind, wish) {
  v.glow = 1;
  v.bow = 1;
  const h = headOf(v);
  if (kind === 'petal') {
    for (let i = 0; i < 14; i++) floaters.push(newPetal(h.x + (Math.random() - 0.5) * 200, h.y - 200 - Math.random() * 300));
    sound.plop(0.5);
  } else {
    fx.push({ kind, x: h.x, y: h.y, scale: h.s * 1.1, t: 0, life: 2.6 });
    if (kind === 'bell') { sound.bigBell(0.9); haloPulse = 1; }
    else sound.bell(0.35);
  }
  feed(v.name, OFFERINGS[kind].label.toLowerCase() + (wish ? ` · “${wish}”` : ''), true);
  if (wish) dedicate(v.name, kind, wish);
}
function newPetal(x, y) {
  return { x, y, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 40, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2, s: 0.12 + Math.random() * 0.1, life: 0 };
}

// ---------- Networking ----------
let ws = null;
let online = false;
let started = false;
let serverOffset = 0;
const serverNow = () => Date.now() + serverOffset;
const me = () => visitors.get(myId);

function connect(name, skin) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?room=${ROOM}`);
  let opened = false;
  ws.onopen = () => { opened = true; ws.send(JSON.stringify({ t: 'hello', name, skin })); };
  ws.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch (err) { console.warn('bad message', err); } };
  ws.onclose = () => {
    online = false;
    if (!opened || !myId) { goSolo(name, skin); return; }
    for (const id of [...visitors.keys()]) if (id !== myId) removeVisitor(id);
    toast('Mất kết nối, đang thử lại…');
    setTimeout(() => connect(name, skin), 3000);
  };
}
function goSolo(name, skin) {
  if (myId) return;
  myId = 'me';
  addVisitor({ id: 'me', name, skin, seat: FILL_ORDER[0] }, true);
  toast('Không có máy chủ — bạn đang ở chánh điện một mình');
}
function send(m) { if (online && ws?.readyState === 1) ws.send(JSON.stringify(m)); }
/** Server-authoritative actions; offline we apply them locally. */
function act(m) {
  if (online) { send(m); return; }
  const v = me();
  if (!v) return;
  if (m.t === 'seat') moveVisitor(v, m.seat);
  if (m.t === 'chant') { v.merit += 1; onChant(v, m.line); renderBoard(); }
  if (m.t === 'offer') { v.merit += OFFERINGS[m.kind].merit; onOffer(v, m.kind, m.wish); renderBoard(); }
}

function handle(m) {
  const v = visitors.get(m.id);
  switch (m.t) {
    case 'welcome': {
      online = true;
      const reconnect = !!myId;
      myId = m.id;
      serverOffset = m.now - Date.now();
      for (const id of [...visitors.keys()]) removeVisitor(id);
      for (const p of m.peers) addVisitor(p, false);
      addVisitor({ id: m.id, name: myName, skin: mySkin, seat: m.seat }, !reconnect);
      if (!reconnect) toast(m.peers.length ? `Có ${m.peers.length} phật tử đang ngồi tụng` : 'Chánh điện tĩnh lặng. Mời an tọa.');
      break;
    }
    case 'join':
      addVisitor(m.p, true);
      feed(m.p.name, 'vào chánh điện');
      break;
    case 'leave':
      if (v) { feed(v.name, 'đã rời'); removeVisitor(m.id); }
      break;
    case 'seat':
      if (v) moveVisitor(v, m.seat);
      break;
    case 'chant':
      if (!v) break;
      v.merit = m.merit;
      if (m.id !== myId) onChant(v, m.line); // my own chant already played locally
      renderBoard();
      break;
    case 'bow':
      if (v) onBow(v);
      break;
    case 'mo':
      if (v) onMo(v);
      break;
    case 'offer':
      if (v) { v.merit = m.merit; onOffer(v, m.kind, m.wish); renderBoard(); }
      break;
    case 'full':
      toast(`${roomLabel(m.room)} đã kín chỗ. Mời chọn phòng khác trong Cài đặt.`, 6000);
      openMenu();
      break;
  }
}

// ---------- Actions ----------
let chantIndex = 0;
const cooldownUntil = {};
function doChant() {
  const v = me();
  if (!v) return;
  const line = chantIndex++ % SUTRA.length;
  act({ t: 'chant', line });
  if (online) onChant(v, line); // instant feedback; the echo only updates merit
}
function doBow() {
  const v = me();
  if (!v) return;
  onBow(v);
  send({ t: 'bow' });
}
function doMo() {
  const v = me();
  if (!v) return;
  onMo(v);
  send({ t: 'mo' });
}
function doOffer(kind, wish = '') {
  const v = me();
  if (!v) return;
  const now = performance.now();
  if ((cooldownUntil[kind] || 0) > now) { toast('Xin đợi một chút rồi dâng tiếp'); return; }
  cooldownUntil[kind] = now + OFFERINGS[kind].cooldown;
  act({ t: 'offer', kind, wish });
}
function renderCooldowns() {
  const now = performance.now();
  document.querySelectorAll('[data-offer]').forEach((b) => {
    const k = b.dataset.offer, left = (cooldownUntil[k] || 0) - now;
    b.classList.toggle('cool', left > 0);
    if (left > 0) b.style.setProperty('--left', `${(left / OFFERINGS[k].cooldown) * 100}%`);
  });
}
document.querySelectorAll('[data-offer]').forEach((b) => b.addEventListener('click', () => { unlockAudio(); doOffer(b.dataset.offer); }));
document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
  unlockAudio();
  ({ chant: doChant, bow: doBow, mo: doMo, wish: openWish })[b.dataset.act]();
}));
const OFFER_KEYS = { q: 'petal', w: 'incense', e: 'lotus', r: 'bell' };
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeWish(); $('#menu').hidden = true; return; }
  if (!myId || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === ' ') { e.preventDefault(); doMo(); }
  else if (e.key === '1') doChant();
  else if (e.key === '2') doBow();
  else if (e.key === '3') { e.preventDefault(); openWish(); }
  else if (OFFER_KEYS[e.key.toLowerCase()] && !e.metaKey && !e.ctrlKey) { unlockAudio(); doOffer(OFFER_KEYS[e.key.toLowerCase()]); }
});

// Taps on the painting: mõ, bell bowl, a free cushion, or anywhere else to chant one line.
function hitAt(e) {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * SW, y = ((e.clientY - r.top) / r.height) * SH;
  if (Math.hypot(x - MO_SPOT.x, y - MO_SPOT.y) < MO_SPOT.r) return { kind: 'mo', tip: 'Gõ mõ' };
  if (Math.hypot(x - BOWL_SPOT.x, y - BOWL_SPOT.y) < BOWL_SPOT.r) return { kind: 'bell', tip: 'Thỉnh chuông' };
  const taken = new Set([...visitors.values()].map((v) => v.seat));
  const seat = SEATS.filter((s) => !taken.has(s.i))
    .map((s) => ({ s, d: Math.hypot(x - s.x, y - (s.y - 60 * s.scale)) }))
    .filter(({ s, d }) => d < 140 * s.scale + 20)
    .sort((a, b) => a.d - b.d)[0];
  if (seat) return { kind: 'seat', seat: seat.s.i, tip: 'Ngồi chỗ này' };
  return { kind: 'chant', tip: 'Tụng một câu' };
}
canvas.addEventListener('click', (e) => {
  if (!myId) return;
  unlockAudio();
  const h = hitAt(e);
  if (h.kind === 'mo') doMo();
  else if (h.kind === 'bell') doOffer('bell');
  else if (h.kind === 'seat') act({ t: 'seat', seat: h.seat });
  else doChant();
});
// Mouse hover: tell PC users what a click will do.
canvas.addEventListener('pointermove', (e) => {
  const tip = $('#tip');
  if (!myId || e.pointerType !== 'mouse') { tip.hidden = true; return; }
  const r = $('#stage').getBoundingClientRect();
  tip.textContent = hitAt(e).tip;
  tip.style.left = `${e.clientX - r.left}px`;
  tip.style.top = `${e.clientY - r.top}px`;
  tip.hidden = false;
});
canvas.addEventListener('pointerleave', () => { $('#tip').hidden = true; });

// ---------- Wish panel ----------
const WISH_PRESETS = {
  default: ['Nguyện cho gia đình bình an', 'Cầu cho cha mẹ mạnh khỏe', 'Nguyện mọi loài bớt khổ đau'],
  trungthu: ['Nguyện gia đình đoàn viên', 'Cầu cho các em nhỏ vui khỏe'],
  vulan: ['Con nhớ ơn cha mẹ', 'Nguyện cha mẹ hiện tiền an lạc', 'Hồi hướng cho cha mẹ đã khuất'],
};
let wishKind = 'incense';
function openWish() {
  if (!myId) return;
  const presets = $('#wishPresets');
  presets.innerHTML = '';
  for (const p of WISH_PRESETS[festival ?? 'default']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = p;
    b.addEventListener('click', () => { $('#wishText').value = p; $('#wishCount').textContent = p.length; });
    presets.append(b);
  }
  $('#wishTitle').textContent = festival === 'vulan' ? 'Hồi hướng mùa Vu Lan' : 'Lời nguyện hồi hướng';
  $('#wishPanel').hidden = false;
  $('#wishText').focus();
}
function closeWish() { $('#wishPanel').hidden = true; }
document.querySelectorAll('#wishKind button').forEach((b) => b.addEventListener('click', () => {
  wishKind = b.dataset.kind;
  document.querySelectorAll('#wishKind button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
}));
$('#wishCancel').addEventListener('click', closeWish);
$('#wishText').addEventListener('input', () => ($('#wishCount').textContent = $('#wishText').value.length));
$('#wishText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#wishSend').click(); } });
$('#wishSend').addEventListener('click', () => {
  const wish = $('#wishText').value.trim().slice(0, 80);
  if (!wish) { $('#wishText').focus(); return; }
  closeWish();
  $('#wishText').value = '';
  $('#wishCount').textContent = 0;
  doOffer(wishKind, wish);
});

// ---------- Menu & rooms ----------
const roomLabel = (r) => r.replace(/^am-/, 'Phòng ');
$('#roomName').textContent = roomLabel(ROOM);
async function openMenu() {
  $('#menu').hidden = false;
  const ul = $('#roomList');
  ul.innerHTML = '<li class="hint">Đang xem các phòng…</li>';
  try {
    const list = await (await fetch('/api/rooms')).json();
    ul.innerHTML = '';
    for (const r of list) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<span></span><span></span>';
      b.children[0].textContent = roomLabel(r.room);
      b.children[1].textContent = `${r.count}/${r.capacity}${r.room === ROOM ? ' · đang ở đây' : ''}`;
      b.disabled = r.room === ROOM || r.count >= r.capacity;
      b.addEventListener('click', () => { const q = new URLSearchParams(location.search); q.set('room', r.room); location.search = q; });
      li.append(b);
      ul.append(li);
    }
  } catch {
    ul.innerHTML = '<li class="hint">Không lấy được danh sách phòng.</li>';
  }
}
$('#menuBtn').addEventListener('click', openMenu);
$('#roomBtn').addEventListener('click', openMenu);
$('#menuClose').addEventListener('click', () => ($('#menu').hidden = true));
for (const m of document.querySelectorAll('.modal')) m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; });
$('#leaveBtn').addEventListener('click', () => { ws?.close(); location.reload(); });

// ---------- Lunar calendar, festivals, daily schedule ----------
const FESTIVALS = {
  trungthu: { name: 'Rằm Trung Thu', lunarMonth: 8, banner: 'Rằm Trung Thu · trăng tròn, nguyện gia đình đoàn viên' },
  vulan: { name: 'Mùa Vu Lan', lunarMonth: 7, banner: 'Mùa Vu Lan · dâng hương nhớ ơn cha mẹ' },
};
const EVENTS = [
  { key: 'bell', label: 'Chuông sớm', start: 6 * 60, len: 10 },
  { key: 'calm', label: 'Tụng kinh chung', start: 20 * 60 + 30, len: 20 },
];
let festival = null;
function festivalNow() {
  if (FORCE_FESTIVAL) return FORCE_FESTIVAL;
  const l = lunarAt(serverNow());
  if (l.leap || l.day < 13 || l.day > 16) return null;
  return Object.keys(FESTIVALS).find((k) => FESTIVALS[k].lunarMonth === l.month) ?? null;
}
function eventState() {
  const vn = new Date(serverNow() + 7 * 3600e3);
  const mins = vn.getUTCHours() * 60 + vn.getUTCMinutes() + vn.getUTCSeconds() / 60;
  const forced = EVENTS.find((e) => e.key === FORCE_EVENT);
  if (forced) return { active: forced, left: forced.len };
  let next = null, until = Infinity;
  for (const e of EVENTS) {
    if (mins >= e.start && mins < e.start + e.len) return { active: e, left: e.start + e.len - mins };
    const u = (e.start - mins + 1440) % 1440;
    if (u < until) { until = u; next = e; }
  }
  return { active: null, next, until };
}
const festivalDays = {};
function daysUntil(key) {
  const start = new Date(serverNow() + 7 * 3600e3);
  const ck = `${key}-${start.toISOString().slice(0, 10)}`;
  if (ck in festivalDays) return festivalDays[ck];
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
    const l = solarToLunar(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear());
    if (!l.leap && l.day === 15 && l.month === FESTIVALS[key].lunarMonth) return (festivalDays[ck] = i);
  }
  return (festivalDays[ck] = null);
}
let bellRungFor = null;
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function renderEvent() {
  festival = festivalNow();
  const s = eventState();
  const l = lunarAt(serverNow());
  const el = $('#event');
  el.hidden = !started;
  el.classList.toggle('live', !!s.active || !!festival);
  if (s.active?.key === 'bell' && started) {
    const day = new Date(serverNow() + 7 * 3600e3).toISOString().slice(0, 10);
    if (bellRungFor !== day) {
      bellRungFor = day;
      [0, 7000, 14000].forEach((ms) => setTimeout(() => { sound.bigBell(0.8); haloPulse = 1; }, ms));
      toast('Chuông sớm · ba hồi chuông', 5000);
    }
  }
  if (festival && !s.active) el.textContent = FESTIVALS[festival].banner;
  else if (s.active) el.textContent = `${s.active.label} · còn ${Math.ceil(s.left)} phút`;
  else if (l.day === 1 || l.day === 15) el.textContent = `Âm lịch ${l.day}/${l.month} · hôm nay ${l.day === 1 ? 'mùng Một' : 'ngày Rằm'}`;
  else {
    const [k, d] = Object.keys(FESTIVALS).map((k) => [k, daysUntil(k)]).sort((a, b) => a[1] - b[1])[0];
    el.textContent = s.until <= 60
      ? `${s.next.label} lúc ${hhmm(s.next.start)} · còn ${Math.ceil(s.until)} phút`
      : `Âm lịch ${l.day}/${l.month} · ${FESTIVALS[k].name} sau ${d} ngày`;
  }
}
setInterval(renderEvent, 1000);

// ---------- Gate ----------
let myName = store.get('name') || '';
let mySkin = SKINS.includes(store.get('skin')) ? store.get('skin') : 'man';
$('#dharma').value = myName;
for (const k of SKINS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.skin = k;
  b.setAttribute('aria-pressed', String(k === mySkin));
  b.innerHTML = `<img src="/assets/${ASSET_FILES[k]}" alt=""><span></span>`;
  b.lastChild.textContent = SKIN_LABELS[k];
  b.addEventListener('click', () => {
    mySkin = k;
    document.querySelectorAll('#skins button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });
  $('#skins').append(b);
}
function unlockAudio() {
  sound.start();
  if (!sound.muted) applyMusic();
}
$('#gate').addEventListener('submit', (e) => {
  e.preventDefault();
  myName = $('#dharma').value.trim().slice(0, 20) || 'Phật tử';
  store.set('name', myName);
  store.set('skin', mySkin);
  $('#gate').hidden = true;
  started = true;
  unlockAudio();
  renderEvent();
  connect(myName, mySkin);
});

// ---------- Drawing ----------
function drawSprite(im, x, y, s, anchorY = 1) {
  if (!im?.naturalWidth) return;
  const w = im.naturalWidth * s, h = im.naturalHeight * s;
  ctx.drawImage(im, x - w / 2, y - h * anchorY, w, h);
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function nameTag(text, x, y, s, isMe) {
  ctx.font = `600 ${Math.round(26 * s + 8)}px Georgia, serif`;
  const w = ctx.measureText(text).width + 16, h = 30 * s + 10;
  ctx.fillStyle = isMe ? 'rgba(138,42,30,.88)' : 'rgba(18,10,7,.62)';
  roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  if (isMe) { ctx.strokeStyle = 'rgba(217,164,65,.9)'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = '#f1e3c8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}
function bubble(text, x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'italic 26px Georgia, serif';
  const w = Math.min(520, ctx.measureText(text).width + 30), h = 46;
  ctx.fillStyle = 'rgba(255,244,220,.92)';
  roundRect(x - w / 2, y - h, w, h, 16);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x, y + 12);
  ctx.lineTo(x + 10, y);
  ctx.fill();
  ctx.fillStyle = '#6a2a10';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - h / 2, w - 20);
  ctx.restore();
}

let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;

  ctx.clearRect(0, 0, SW, SH);
  if (A.hall.naturalWidth) ctx.drawImage(A.hall, 0, 0, SW, SH);
  else { ctx.fillStyle = '#1a0d08'; ctx.fillRect(0, 0, SW, SH); }

  // Halo over the painted statue; flares when the bell is rung.
  haloPulse = Math.max(0, haloPulse - dt * 0.45);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.22 + 0.08 * Math.sin(t * 1.2) + haloPulse * 0.5 + (festival === 'trungthu' ? 0.1 : 0);
  drawSprite(A.halo, SW / 2, 520, 2.6 + haloPulse * 0.4, 0.5);
  ctx.restore();
  // Incense smoke from the altar bowl.
  ctx.save();
  ctx.fillStyle = '#e8dcc6';
  for (let i = 0; i < 14; i++) {
    const a = (t * 0.09 + i * 0.071) % 1;
    ctx.globalAlpha = 0.3 * (1 - a);
    ctx.beginPath();
    ctx.arc(SW / 2 + Math.sin(a * 7 + i) * 18 * a, 1000 - a * 260, 4 + a * 14, 0, 6.28);
    ctx.fill();
  }
  ctx.restore();
  // Candle flicker.
  if (!reduceMotion) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.06 + 0.04 * Math.sin(t * 9) * Math.sin(t * 13.3);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(0, 300, SW, 900);
    ctx.restore();
  }

  // People, back to front.
  for (const v of [...visitors.values()].sort((a, b) => a.y - b.y)) {
    const anim = ANIM[v.skin];
    const seat = SEATS[v.seat];
    if (v.state === 'walk') {
      if (!anim) { v.x = seat.x; v.y = seat.y; v.state = 'sit'; }
      else {
        // Up the aisle first, then sideways into the row; speed grows with depth.
        const depth = (v.y - FLOOR.yTop) / (FLOOR.yBot - FLOOR.yTop);
        const sp = (150 + 170 * Math.max(0, Math.min(1.4, depth))) * dt;
        const dx = seat.x - v.x, dy = seat.y - v.y;
        if (Math.abs(dy) > 3) { v.y += Math.max(-sp, Math.min(sp, dy)); v.x += (SW / 2 - v.x) * Math.min(1, dt * 6); v.flip = false; }
        else { v.x += Math.max(-sp, Math.min(sp, dx)); v.flip = dx < 0; }
        v.ft += dt;
        if (v.ft > 0.16) { v.ft = 0; v.frame = (v.frame + 1) % 4; }
        if (Math.abs(v.x - seat.x) < 2 && Math.abs(v.y - seat.y) < 3) {
          v.x = seat.x; v.y = seat.y; v.state = 'sitting'; v.sitT = 0; v.flip = false;
        }
      }
    } else if (v.state === 'sitting') {
      v.sitT += dt;
      v.frame = 4 + Math.min(3, Math.floor(v.sitT / 0.22));
      if (v.sitT > 0.9) { v.state = 'sit'; v.frame = 7; if (v.isMe) toast('Đã an tọa. Nam mô A Di Đà Phật.'); }
    }
    v.fade = Math.min(1, v.fade + dt * 2);
    const s = v.state === 'walk' ? scaleAtY(v.y) : seat.scale;
    v.bow = Math.max(0, v.bow - dt * 0.7);
    v.glow = Math.max(0, v.glow - dt * 0.5);
    v.knock = Math.max(0, v.knock - dt);
    // Lễ Phật: three slow, deep bows.
    let bowK = v.state === 'sit' ? Math.sin(Math.min(1, v.bow) * Math.PI) * 0.04 : 0;
    let pray = null;
    if (v.prostrate > 0 && v.state === 'sit') {
      v.prostrate = Math.max(0, v.prostrate - dt);
      pray = bowState(v);
      if (pray.n >= 0 && pray.n < BOW_COUNT && pray.n !== v.bowN) {
        v.bowN = pray.n;
        sound.bell(v.isMe ? 0.3 : 0.1);
        v.bubble = { text: `Đảnh lễ ${pray.n + 1}/${BOW_COUNT}`, t: BOW_LEN };
      }
      if (!v.prostrate) pray = null;
    }
    if (v.knock > 0) bowK = Math.max(bowK, v.knock * 0.06);
    const breathe = reduceMotion || v.state !== 'sit' ? 0 : Math.sin(t * 1.1 + v.phase) * 2 * s;
    if (v.glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = v.glow * 0.7;
      const g = ctx.createRadialGradient(v.x, v.y - 90 * s, 10, v.x, v.y - 90 * s, 170 * s);
      g.addColorStop(0, 'rgba(255,200,110,.9)');
      g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(v.x - 200 * s, v.y - 300 * s, 400 * s, 340 * s);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = v.fade;
    ctx.translate(v.x, v.y);
    if (bowK > 0) ctx.transform(1, 0, 0, 1 - bowK, 0, 0);
    let tagH;
    if (pray) {
      tagH = drawPrayer(v, anim ? (s * 1.05 * 260) / anim.seatH : s * 1.05, breathe, pray.lay, pray.pose);
    } else if (anim) {
      const k = (s * 1.05 * 260) / anim.seatH;
      if (v.flip) ctx.scale(-1, 1);
      ctx.drawImage(A[`anim_${v.skin}`], v.frame * anim.fw, 0, anim.fw, anim.fh, (-anim.fw * k) / 2, -anim.fh * k + breathe, anim.fw * k, anim.fh * k);
      tagH = (v.state === 'sit' ? anim.seatH : anim.fh * 0.97) * k;
    } else {
      drawSprite(A[v.skin] || A.man, 0, breathe, s * 1.05, 1);
      tagH = 268 * s;
    }
    ctx.restore();
    nameTag(v.name, v.x, v.y - tagH - 10 * s, s, v.isMe);
    if (v.bubble) {
      v.bubble.t -= dt;
      if (v.bubble.t <= 0) v.bubble = null;
      else bubble(v.bubble.text, v.x, v.y - tagH - 40 * s - 14, Math.min(1, v.bubble.t));
    }
  }

  // Offering sprites rising and fading.
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    const k = f.t / f.life;
    if (k >= 1) { fx.splice(i, 1); continue; }
    const ease = 1 - Math.pow(1 - Math.min(1, f.t * 4), 3);
    ctx.save();
    ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25;
    drawSprite(A[f.kind], f.x, f.y - k * 160, f.scale * (0.6 + 0.4 * ease) * 0.9, 1);
    ctx.restore();
  }
  // Floating lotus petals (more of them during festivals).
  if (!reduceMotion && festival && Math.random() < dt * 0.8) floaters.push(newPetal(Math.random() * SW, -40));
  for (let i = floaters.length - 1; i >= 0; i--) {
    const p = floaters[i];
    p.life += dt;
    p.x += (p.vx + Math.sin(p.life * 2 + p.rot) * 20) * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.y > SH + 40 || p.life > 30) { floaters.splice(i, 1); continue; }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.min(1, p.life * 2) * 0.9;
    drawSprite(A.petal, 0, 0, p.s, 0.5);
    ctx.restore();
  }
  renderCooldowns();
}
requestAnimationFrame(tick);
renderEvent();

if (params.has('debug')) window.__cd = { visitors, get me() { return me(); }, handle, SEATS };
