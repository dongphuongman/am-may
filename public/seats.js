// Shared by the browser and the server: stage size and the seats on the painted cushions.
// Hall painting from "Chánh Điện Tịnh Tâm" by Kent Juno (MIT); one seat per painted cushion.

export const STAGE = { W: 1080, H: 1920 };

// The 16 cushions painted in hall.jpg, measured on the 1080×1920 image: [centre x, centre y, width].
// (Two more at the left/right edge of the 4th row are cut off by the frame, so nobody sits there.)
const CUSHIONS = [
  [259, 1248, 100], [428, 1248, 100], [652, 1248, 100], [821, 1248, 100],
  [195, 1313, 120], [403, 1313, 120], [678, 1313, 120], [886, 1313, 120],
  [116, 1403, 148], [368, 1403, 148], [712, 1403, 148], [964, 1403, 148],
  [316, 1535, 188], [765, 1535, 188],
  [248, 1715, 236], [832, 1715, 236],
];
/** Sprite scale on the floor at a given depth, so a seated sprite's cushion matches the painted one. */
export const scaleAtY = (y) => Math.max(0.2, Math.min(0.95, 0.365 + (y - 1248) * 0.00106));
// Floor depth range, used for walking speed.
export const FLOOR = { yTop: 1248, yBot: 1715 };

const rowYs = [...new Set(CUSHIONS.map((c) => c[1]))];
export const SEATS = CUSHIONS.map(([x, cy, w], i) => {
  const scale = (w * 0.95) / 260; // seated sprites carry a cushion ~260·scale px wide
  // Sprites are anchored at their feet; the cushion centre is ~44·scale px above that.
  return { i, x, y: Math.round(cy + 44 * scale), scale, r: rowYs.indexOf(cy) };
});

/** Seats fill from the front rows nearest the aisle, so the hall always looks full near the viewer. */
export const FILL_ORDER = [...SEATS]
  .sort((a, b) => b.r - a.r || Math.abs(a.x - STAGE.W / 2) - Math.abs(b.x - STAGE.W / 2))
  .map((s) => s.i);

export const SKINS = ['man', 'woman', 'granny', 'nun', 'monk', 'child'];

export const SUTRA = [
  'Nam mô A Di Đà Phật',
  'Nam mô Bổn Sư Thích Ca Mâu Ni Phật',
  'Nam mô Đại Bi Quán Thế Âm Bồ Tát',
  'Nguyện cầu bình an cho gia đình',
  'Cầu cho cha mẹ được khỏe mạnh',
  'Nguyện đem công đức này hướng về khắp tất cả',
];

/** Offerings: cooldown (ms) and how much each adds to the "tấm lòng thành" tally. */
export const OFFERINGS = {
  petal: { label: 'Rải cánh sen', cooldown: 1500, merit: 1 },
  incense: { label: 'Dâng hương', cooldown: 8000, merit: 5 },
  lotus: { label: 'Dâng hoa sen', cooldown: 15000, merit: 10 },
  bell: { label: 'Thỉnh chuông', cooldown: 10000, merit: 20 },
};
