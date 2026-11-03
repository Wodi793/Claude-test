/* Penguins — the Playbook tab: court drawing, tools, saving, backup.
   (Moved unchanged from index.html in Stage 2. Sections 2–14 below are the original code.) */
'use strict';

/* =====================================================================
   2. SETTINGS
   The easiest things to change: team name, colors, marker sizes.
   ===================================================================== */
const TEAM_NAME = 'PENGUINS';
const SCHOOL_NAME = 'BURNS PARK';   // written opposite the team name
const PURPLE = '#4e2a84';

// Two board styles. "ink" is the board-color marker: white on purple, purple on white.
// Lines drawn with it switch color when you switch boards; picked colors stay as picked.
const THEMES = {
  purple: { floor: PURPLE, band: '#ffffff', lines: '#ffffff', lettering: PURPLE, ink: '#ffffff',
            oldPens: ['#ffffff', '#ffd84d', '#ff6b6b', '#7fd3ff'] },   // for plays saved before v2
  white:  { floor: '#fbfafd', band: PURPLE, lines: PURPLE, lettering: '#ffffff', ink: PURPLE,
            oldPens: [PURPLE, '#1c1b22', '#d62839', '#1f6fd1'] },
};

const DEFAULT_WIDTH = 0.35;      // marker thickness for new lines, in feet on the court
const MIN_WIDTH = 0.15, MAX_WIDTH = 1.2;   // range of the Line slider in the ••• menu
const APP_VERSION = '21 preview';   // the preview copy (next/) — see BUILD-LOG.md
const DB_NAME = 'penguins-playbook-preview';   // preview keeps its own plays, separate from the live app           // shown in the ••• menu; bump with each update
const ZOOM_MAX = 6;              // how far you can zoom in (6× the fitted size)
const ERASER_RADIUS_PX = 14;     // how close the eraser must come to a line, in screen points
const PLAIN_BAND = 0.75;         // minimum border (feet) around the court: thin, but not zero
const MIN_BORDER_LETTERS = 2;    // letter size (feet) needed to write PENGUINS in the border;
                                 // with less room, it goes on the court floor instead
const MAX_LETTERS = 4.5;         // biggest letter size (feet) in the border
const FLOOR_LETTERS = 3.5;       // letter size (feet) of the wordmark on the floor

/* =====================================================================
   3. COURT GEOMETRY  (U.S. high-school / NFHS dimensions, in feet)
   Drawings are stored in "court feet", measured from the court's own corner,
   so the court can be turned or bordered differently without moving them.
     Full court: x 0–50 across, y 0–84 from one baseline to the other.
     Half court: x 0–42 from the baseline (basket side), y 0–50 across.
   ===================================================================== */
const HS = {
  length: 84, width: 50,
  laneWidth: 12, laneDepth: 19,        // free-throw line is 19 ft from the baseline
  ftRadius: 6, centerRadius: 6,
  backboardFromBaseline: 4, backboardWidth: 6,
  rimCenter: 5.25, rimRadius: 0.75,    // rim center: 4 ft + 15 in from the baseline
  threeRadius: 19.75,                  // 19 ft 9 in from the center of the basket
};
const LINE = 0.2;   // court line thickness (about 2.4 inches)

const COURTS = {
  full: { w: HS.width, h: HS.length, label: 'Full court' },
  half: { w: HS.length / 2, h: HS.width, label: 'Half court' },
};

/** One end of the court: lane, free-throw circle, 3-point line, backboard, rim.
 *  Local frame: baseline along y = 0, court runs toward +y, x runs 0..50 across. */
function drawCourtEnd(ctx) {
  const mid = HS.width / 2;
  const laneLeft = mid - HS.laneWidth / 2, laneRight = mid + HS.laneWidth / 2;

  ctx.strokeRect(laneLeft, 0, HS.laneWidth, HS.laneDepth);   // lane (the "key")

  // Lane marks: the solid block 7–8 ft up, then small ticks at 11 and 14 ft
  const tick = 0.67;
  ctx.fillRect(laneLeft - tick, 7, tick, 1);
  ctx.fillRect(laneRight, 7, tick, 1);
  for (const y of [11, 14]) {
    line(ctx, laneLeft - tick, y, laneLeft, y);
    line(ctx, laneRight, y, laneRight + tick, y);
  }

  // Free-throw circle: solid half outside the lane, dashed half inside
  ctx.beginPath(); ctx.arc(mid, HS.laneDepth, HS.ftRadius, 0, Math.PI); ctx.stroke();
  ctx.save(); ctx.setLineDash([1.1, 0.9]);
  ctx.beginPath(); ctx.arc(mid, HS.laneDepth, HS.ftRadius, Math.PI, 2 * Math.PI); ctx.stroke();
  ctx.restore();

  // 3-point line: straight from the baseline to level with the rim, then the arc
  const r = HS.threeRadius, cy = HS.rimCenter;
  ctx.beginPath();
  ctx.moveTo(mid - r, 0); ctx.lineTo(mid - r, cy);
  ctx.arc(mid, cy, r, Math.PI, 0, true);
  ctx.lineTo(mid + r, 0);
  ctx.stroke();

  // Backboard, the bracket to the rim, and the rim
  ctx.save(); ctx.lineWidth = LINE * 1.8;
  line(ctx, mid - HS.backboardWidth / 2, HS.backboardFromBaseline, mid + HS.backboardWidth / 2, HS.backboardFromBaseline);
  ctx.restore();
  line(ctx, mid, HS.backboardFromBaseline, mid, HS.rimCenter - HS.rimRadius);
  ctx.beginPath(); ctx.arc(mid, HS.rimCenter, HS.rimRadius, 0, 2 * Math.PI); ctx.stroke();
}

/** The court itself (floor and lines), in court feet. */
function drawCourt(ctx, courtKey, t) {
  const c = COURTS[courtKey];
  ctx.fillStyle = t.floor;
  ctx.fillRect(0, 0, c.w, c.h);
  ctx.strokeStyle = t.lines; ctx.fillStyle = t.lines;
  ctx.lineWidth = LINE; ctx.lineCap = 'butt';

  ctx.save();
  if (courtKey === 'half') ctx.transform(0, 1, 1, 0, 0, 0);   // basket on the left
  const len = courtKey === 'full' ? HS.length : HS.length / 2;
  ctx.strokeRect(LINE / 2, LINE / 2, HS.width - LINE, len - LINE);   // boundary
  drawCourtEnd(ctx);
  if (courtKey === 'full') {
    line(ctx, 0, HS.length / 2, HS.width, HS.length / 2);           // half-court line
    ctx.beginPath(); ctx.arc(HS.width / 2, HS.length / 2, HS.centerRadius, 0, 2 * Math.PI); ctx.stroke();
    ctx.translate(0, HS.length); ctx.scale(1, -1);                 // flip for the other end
    drawCourtEnd(ctx);
  } else {
    ctx.beginPath(); ctx.arc(HS.width / 2, len, HS.centerRadius, Math.PI, 2 * Math.PI); ctx.stroke();
  }
  ctx.restore();
}

/** Big spaced-out letters, centered on (x, y), `size` feet tall. Drawn at a large
 *  font size and scaled down, because some browsers handle tiny font sizes badly. */
const TEAM_FONT = '900 36px -apple-system, system-ui, "Helvetica Neue", Arial, sans-serif';
const TEAM_SPACING = 7;   // gap between letters, at the 36px drawing size
function drawTeamName(ctx, x, y, rotation, color, size, text = TEAM_NAME) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(size / 36, size / 36);
  ctx.fillStyle = color;
  ctx.font = TEAM_FONT;
  ctx.textBaseline = 'middle';
  const widths = [...text].map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, w) => a + w, 0) + TEAM_SPACING * (text.length - 1);
  let cx = -total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, cx, 1); cx += widths[i] + TEAM_SPACING; });
  ctx.restore();
}

/** How long a name is when written `size` feet tall. */
const nameRatios = new Map();
function nameLength(size, text = TEAM_NAME) {
  if (!nameRatios.has(text)) {
    const m = document.createElement('canvas').getContext('2d');
    m.font = TEAM_FONT;
    const total = [...text].reduce((a, ch) => a + m.measureText(ch).width, 0)
                + TEAM_SPACING * (text.length - 1);
    nameRatios.set(text, total / 36);
  }
  return nameRatios.get(text) * size;
}
const longestName = () => Math.max(nameLength(1, TEAM_NAME), nameLength(1, SCHOOL_NAME));

/** Faint names painted on the floor (used when the border is too thin for letters). */
function drawFloorNames(ctx, courtKey, t) {
  ctx.save();
  ctx.globalAlpha = 0.17;
  if (courtKey === 'full') {
    // In the open floor between each 3-point line and the center circle
    const mid = HS.threeRadius + HS.rimCenter + (HS.length / 2 - HS.centerRadius - HS.threeRadius - HS.rimCenter) / 2;
    drawTeamName(ctx, HS.width / 2, mid, 0, t.lines, FLOOR_LETTERS, SCHOOL_NAME);
    drawTeamName(ctx, HS.width / 2, HS.length - mid, 0, t.lines, FLOOR_LETTERS, TEAM_NAME);
  } else {
    // Centered along each sideline, in the open strip outside the 3-point line
    const size = 2.2, cx = HS.length / 4;
    drawTeamName(ctx, cx, 0.9 + size / 2, 0, t.lines, size, SCHOOL_NAME);
    drawTeamName(ctx, cx, HS.width - 0.9 - size / 2, 0, t.lines, size, TEAM_NAME);
  }
  ctx.restore();
}

/* ----- Center-court logo: the same basketball-and-penguin drawing as the app icon -----
   Coordinates are copied from icon.svg (a 100×100 square, ball centered at 50,50 with
   radius 40). If you change one, change the other so the branding stays matched. */
const LOGO_SEAMS = new Path2D('M50 10V90M10 50H90M17 28Q50 46 83 28M17 72Q50 54 83 72');  // center lines + curved seams
const LOGO_PENGUIN_AT = [50, 51, 4.3];   // penguin position and scale inside the logo
const PENGUIN_BODY = new Path2D(
  'M0 -5C1.6 -5 2.4 -3.8 2.3 -2.4C2.2 -1.6 2.6 -.6 3 .6C3.4 2 3.2 3.6 2.2 4.4' +
  'C1.4 5 -1.4 5 -2.2 4.4C-3.2 3.6 -3.4 2 -3 .6C-2.6 -.6 -2.2 -1.6 -2.3 -2.4C-2.4 -3.8 -1.6 -5 0 -5Z');
const PENGUIN_BELLY = new Path2D(
  'M0 -2.4C1.3 -2.4 1.9 -.5 1.9 1.4C1.9 3.1 1.1 3.9 0 3.9C-1.1 3.9 -1.9 3.1 -1.9 1.4C-1.9 -.5 -1.3 -2.4 0 -2.4Z');
const PENGUIN_LIMBS = new Path2D(   // flippers and feet
  'M2.85 .1C3.9 .9 4.4 2.3 4.25 3.2M-2.85 .1C-3.9 .9 -4.4 2.3 -4.25 3.2' +
  'M-2 4.85Q-1.2 5.45 -.4 4.85M.4 4.85Q1.2 5.45 2 4.85');

/** The logo fills the full court's center circle, which serves as the ball's outline
 *  (and the half-court line as its horizontal line). The half court has no logo. */
function drawPenguin(ctx, courtKey, t) {
  if (courtKey !== 'full') return;
  const k = HS.centerRadius / 40;                         // icon units → feet
  ctx.save();
  ctx.translate(HS.width / 2, HS.length / 2);
  if (layout.turned) ctx.rotate(-Math.PI / 2);            // court turned sideways: keep the penguin upright
  ctx.scale(k, k); ctx.translate(-50, -50);
  ctx.strokeStyle = ctx.fillStyle = t.lines;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = LINE / k;                               // seams: same weight as court lines
  ctx.stroke(LOGO_SEAMS);

  const [px, py, ps] = LOGO_PENGUIN_AT;
  ctx.translate(px, py); ctx.scale(ps, ps);
  ctx.lineWidth = LINE * 1.7 / (k * ps);                  // penguin: bolder, like the icon
  ctx.stroke(PENGUIN_LIMBS);
  ctx.fillStyle = t.floor; ctx.fill(PENGUIN_BODY);        // body hides the seams behind it
  ctx.stroke(PENGUIN_BODY);
  ctx.stroke(PENGUIN_BELLY);
  ctx.fillStyle = t.lines;
  for (const ex of [-.8, .8]) { ctx.beginPath(); ctx.arc(ex, -3.6, .36, 0, 2 * Math.PI); ctx.fill(); }   // eyes
  ctx.beginPath(); ctx.moveTo(-.6, -3.1); ctx.lineTo(.6, -3.1); ctx.lineTo(0, -2.45); ctx.closePath(); ctx.fill();   // beak
  ctx.restore();
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

/* =====================================================================
   4. LAYOUT: make the court as big as the screen allows
   1. The court always runs the same way: the full court along the long side
      of the screen, the half court with its basket on the short side.
      It gets as big as fits, keeping just a thin border.
   2. The names go in the leftover border — ends or sides, whichever fits
      bigger letters. If neither has room, they're painted faintly on the floor.
   ===================================================================== */
function chooseLayout(courtKey, availW, availH) {
  const c = COURTS[courtKey];
  const turned = availW > availH;                              // screen held sideways
  const dw = turned ? c.h : c.w, dh = turned ? c.w : c.h;      // court size as shown
  const scale = Math.min(availW / (dw + 2 * PLAIN_BAND), availH / (dh + 2 * PLAIN_BAND));
  const L = { scale, turned, dw, dh };
  L.W = availW / L.scale; L.H = availH / L.scale;            // whole area, in feet
  L.ox = (L.W - L.dw) / 2; L.oy = (L.H - L.dh) / 2;           // court centered in it
  L.ch = c.h;

  // Biggest letters that fit: in the top/bottom border, or in the side borders
  const fit = (band, room) => Math.min((band - 0.5) / 0.85, (room * 0.85) / longestName());
  const ends = fit(L.oy, L.dw), sides = fit(L.ox, L.dh);
  const size = Math.min(MAX_LETTERS, Math.max(ends, sides));
  L.letters = size >= MIN_BORDER_LETTERS ? (ends >= sides ? 'ends' : 'sides') : 'floor';
  L.letterSize = size;
  return L;
}

/* =====================================================================
   5. APP STATE
   A stroke is { c: color, w: width 0|1, p: [x, y, x, y, ...] in court feet }.
   c is 0 for the board-color marker, or a color like "#ff6b6b".
   ===================================================================== */
const state = {
  court: 'full', theme: 'purple',
  strokes: [],
  playId: null, name: '', created: null, dirty: false,
  color: 0, customColor: '#ffd84d', width: DEFAULT_WIDTH, tool: 'pen',   // tool: 'pen' or 'eraser'
  undo: [], redo: [],                                        // snapshots of the strokes list
};

/* =====================================================================
   6. VIEW: fitting the board to the screen, plus zoom and pan
   "Board feet" = the court plus its border, as shown on screen.
   Screen point = board feet × k + (tx, ty)
   ===================================================================== */
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const view = { k: 1, tx: 0, ty: 0, fitK: 1, cw: 0, ch: 0, dpr: 1 };
let layout = chooseLayout('full', 1, 1);

const isStandalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;

/** Home-screen apps on iPhone can be given a viewport shorter than the screen
 *  (by the height of the status bar), and iOS won't show the app's content below
 *  it. So the app fills exactly the area iOS shows; the strip below is painted in
 *  the border color so the board looks continuous. */
function sizeApp() {
  const h = window.innerHeight, root = document.documentElement.style;
  root.setProperty('--app-h', h + 'px');
  // Tool buttons: 44pt, smaller only if the whole rail wouldn't fit this height.
  // (Measured here, because CSS screen-height units are unreliable in the home-screen app.)
  root.setProperty('--b', Math.max(20, Math.min(44, (h - 80) / 9.5)) + 'px');
}

/** The phone's real screen height, if iOS has cut the bottom off the app's area
 *  (see sizeApp); otherwise null.
 *  Measured with a hidden 100lvh-tall element ("large viewport" = the full screen).
 *  The Screen check (2026-11-01, owner's foldable) showed this reaches the true bottom,
 *  while screen.width/height report unrelated numbers there — so they aren't used. */
function physicalHeight() {
  if (!isStandalone) return null;
  const full = document.getElementById('lvhProbe').getBoundingClientRect().height;
  return full - window.innerHeight >= 8 ? full : null;
}

function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  view.cw = r.width; view.ch = r.height;
  view.dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * view.dpr);
  canvas.height = Math.round(r.height * view.dpr);
  fitView();
}

// Watch the court's own size, not just the window. iOS sometimes changes the
// layout after start-up without telling the window; if we missed that, the
// picture would be stretched and lines would land away from your finger.
new ResizeObserver(() => resizeCanvas()).observe(canvas);

/** Notch / home-bar margins, in screen points. */
function safeInsets() {
  const s = getComputedStyle(document.getElementById('safe'));
  const px = v => parseFloat(v) || 0;
  return { top: px(s.paddingTop), right: px(s.paddingRight), bottom: px(s.paddingBottom), left: px(s.paddingLeft) };
}

/** Show the whole board, as big as fits, centered on the phone's actual screen.
 *  The usable area isn't centered: iOS reserves room for the clock (top when upright,
 *  one side when sideways) and can cut off the bottom of home-screen apps. So we take
 *  the biggest area that is symmetric around the real screen's center and still
 *  clear of all of those, and fit the court inside it. */
function fitView() {
  const ins = safeInsets(), pad = 2;
  const physH = physicalHeight();
  if (physH) ins.bottom = 0;   // the home bar is already below the area iOS shows
  const screenW = view.cw, screenH = physH || view.ch;   // the real screen, in points

  // Biggest span around a center that stays inside [lo, hi]
  const centered = (lo, hi, mid) => {
    const half = Math.min(mid - lo, hi - mid);
    return half > 40 ? [mid - half, mid + half] : [lo, hi];   // (fallback for odd cases)
  };
  const [left, right] = centered(ins.left + pad, view.cw - ins.right - pad, screenW / 2);
  const [top, bottom] = centered(ins.top + pad, view.ch - ins.bottom - pad, screenH / 2);

  const w = right - left, h = bottom - top;
  layout = chooseLayout(state.court, w, h);
  view.fitK = view.k = layout.scale;
  view.tx = left + (w - layout.W * view.k) / 2;
  view.ty = top + (h - layout.H * view.k) / 2;
  requestRender();
}

function clampZoom(k) { return Math.min(Math.max(k, view.fitK), view.fitK * ZOOM_MAX); }

/** Keep the board on screen: centered if smaller than the screen, otherwise no gaps at the edges. */
function clampPan() {
  const bw = layout.W * view.k, bh = layout.H * view.k;
  view.tx = bw <= view.cw ? (view.cw - bw) / 2 : Math.min(0, Math.max(view.cw - bw, view.tx));
  view.ty = bh <= view.ch ? (view.ch - bh) / 2 : Math.min(0, Math.max(view.ch - bh, view.ty));
  if (view.k === view.fitK) fitView();   // fully zoomed out: snap back to the fitted position
}

/** Screen point → board feet → court feet (undoing any turn of the court). */
function toBoard(pt) { return [(pt.x - view.tx) / view.k, (pt.y - view.ty) / view.k]; }
function toCourt(pt) {
  const [X, Y] = toBoard(pt);
  const bx = X - layout.ox, by = Y - layout.oy;
  return layout.turned ? [by, layout.ch - bx] : [bx, by];
}

/* =====================================================================
   7. RENDERING
   The whole picture is redrawn (at most once per screen refresh) whenever
   something changes. Fast enough for hundreds of strokes.
   ===================================================================== */
let renderQueued = false;
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function render() {
  const d = view.dpr, t = THEMES[state.theme], L = layout;

  // The border color fills the whole screen, so the board runs edge to edge
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = t.band;
  ctx.fillRect(0, 0, view.cw, view.ch);

  // Board feet: team name in the border
  ctx.setTransform(d * view.k, 0, 0, d * view.k, d * view.tx, d * view.ty);
  if (L.letters === 'ends') {
    drawTeamName(ctx, L.W / 2, L.oy / 2, 0, t.lettering, L.letterSize, SCHOOL_NAME);
    drawTeamName(ctx, L.W / 2, L.H - L.oy / 2, 0, t.lettering, L.letterSize, TEAM_NAME);
  } else if (L.letters === 'sides') {
    drawTeamName(ctx, L.ox / 2, L.H / 2, -Math.PI / 2, t.lettering, L.letterSize, TEAM_NAME);
    drawTeamName(ctx, L.W - L.ox / 2, L.H / 2, Math.PI / 2, t.lettering, L.letterSize, SCHOOL_NAME);
  }

  // Court feet: the court and the drawings, turned if the layout says so
  ctx.translate(L.ox, L.oy);
  if (L.turned) ctx.transform(0, 1, -1, 0, L.ch, 0);
  drawCourt(ctx, state.court, t);
  if (L.letters === 'floor') drawFloorNames(ctx, state.court, t);
  drawPenguin(ctx, state.court, t);
  for (const s of state.strokes) drawStroke(ctx, s, t);
  if (input.current) drawStroke(ctx, input.current, t);
}

/** Line thickness in feet. Plays saved before version 16 stored 0 (thin, 0.55 ft) or 1 (thick, 1 ft). */
function strokeWidth(s) { return s.w === 0 ? 0.55 : s.w; }

function strokeColor(s, t) {
  if (typeof s.c === 'string') return s.c;
  return s.c === 0 ? t.ink : t.oldPens[s.c] || t.ink;
}

/** Marker look: solid color, round ends, smoothed through the midpoints. */
function drawStroke(ctx, s, t) {
  const p = s.p, w = strokeWidth(s);
  ctx.strokeStyle = ctx.fillStyle = strokeColor(s, t);
  if (p.length <= 2) {   // a single tap = a dot
    ctx.beginPath(); ctx.arc(p[0], p[1], w * 0.75, 0, 2 * Math.PI); ctx.fill();
    return;
  }
  ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length - 2; i += 2) {
    ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
  }
  ctx.lineTo(p[p.length - 2], p[p.length - 1]);
  ctx.stroke();
}

/* =====================================================================
   8. TOUCH, PENCIL AND MOUSE INPUT
   • iPhone: one finger draws; two fingers pinch-zoom and pan.
     If a second finger lands mid-stroke, that stroke is cancelled.
   • iPad: once an Apple Pencil is seen, the Pencil draws and fingers
     only zoom/pan (so a resting palm never leaves marks).
   • Mouse (for testing on a computer): drag draws, scroll wheel zooms.
   ===================================================================== */
const input = {
  drawId: null, drawType: null,   // the pointer currently drawing or erasing
  current: null, lastPt: null,    // stroke in progress
  eraseSnap: null, erased: false, lastErase: null,
  touches: new Map(),             // fingers on the screen
  nav: null, navLock: false,      // pinch/pan gesture in progress
  penSeen: false,
};

function localPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

let edgeSwipeId = null;   // finger that started at the right edge: it pulls out the tools

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const pt = localPoint(e);
  // One finger starting at the right edge pulls out the tools instead of drawing
  if (e.pointerType !== 'pen' && !toolsOpen() && input.touches.size === 0 &&
      input.drawId === null && pt.x >= view.cw - EDGE_ZONE) {
    edgeSwipeId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not critical */ }
    swipeStart(e.clientX);
    return;
  }
  hideTools();   // touching the court puts the tools away (and still draws)
  if (e.pointerType === 'touch') {
    input.touches.set(e.pointerId, pt);
    if (input.penSeen || input.touches.size > 1 || input.navLock) {
      if (input.drawType === 'touch') cancelDrawing();
      input.navLock = true;     // stays a gesture until every finger lifts
      startNav();
      return;
    }
  } else if (e.pointerType === 'pen') {
    input.penSeen = true;
  } else if (e.button !== 0) {
    return;
  }
  if (input.drawId !== null) return;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* not critical */ }
  beginDraw(e.pointerId, e.pointerType, pt);
});

canvas.addEventListener('pointermove', e => {
  if (e.pointerId === edgeSwipeId) { swipeMove(e.clientX); return; }
  if (e.pointerType === 'touch' && input.touches.has(e.pointerId)) {
    input.touches.set(e.pointerId, localPoint(e));
    if (input.nav) { updateNav(); return; }
  }
  if (e.pointerId !== input.drawId) return;
  // Pencil reports extra in-between points; use them for smoother lines
  let events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  if (!events.length) events = [e];
  for (const ev of events) extendDraw(localPoint(ev));
});

function pointerEnd(e) {
  if (e.pointerId === edgeSwipeId) { edgeSwipeId = null; swipeEnd(e.clientX); return; }
  if (e.pointerType === 'touch' && input.touches.delete(e.pointerId) && input.nav) {
    if (input.touches.size === 0) { input.nav = null; input.navLock = false; }
    else startNav();   // re-anchor on the remaining finger(s)
  }
  if (e.pointerId === input.drawId) endDraw();
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);

// Mouse wheel / trackpad zoom, centered on the cursor (computer testing)
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const pt = localPoint(e), b = toBoard(pt);
  view.k = clampZoom(view.k * Math.exp(-e.deltaY * 0.002));
  view.tx = pt.x - b[0] * view.k; view.ty = pt.y - b[1] * view.k;
  clampPan(); requestRender();
}, { passive: false });

// Stop Safari's own page pinch-zoom and any page scrolling outside lists
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => {
  if (!e.target.closest('.scrollable, input')) e.preventDefault();
}, { passive: false });

/* ----- pinch / pan ----- */
function touchCenter() {
  const pts = [...input.touches.values()];
  const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const spread = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
  return { x, y, spread, count: pts.length };
}
function startNav() {
  const c = touchCenter();
  // Remember which board point is under the fingers; keep it there while moving
  input.nav = { k0: view.k, spread0: c.spread || 1, anchor: toBoard(c), count: c.count };
}
function updateNav() {
  const c = touchCenter(), n = input.nav;
  if (c.count !== n.count) { startNav(); return; }
  if (c.count > 1) view.k = clampZoom(n.k0 * c.spread / n.spread0);
  view.tx = c.x - n.anchor[0] * view.k;
  view.ty = c.y - n.anchor[1] * view.k;
  clampPan(); requestRender();
}

/* ----- drawing and erasing ----- */
const round2 = v => Math.round(v * 100) / 100;   // 0.01 ft is plenty precise; keeps saves small

function beginDraw(id, type, pt) {
  input.drawId = id; input.drawType = type;
  if (state.tool === 'eraser') {
    input.eraseSnap = state.strokes.slice(); input.erased = false; input.lastErase = null;
    eraseAt(pt);
  } else {
    const [x, y] = toCourt(pt);
    input.current = { c: state.color, w: state.width, p: [round2(x), round2(y)] };
    input.lastPt = pt;
  }
  requestRender();
}

function extendDraw(pt) {
  if (state.tool === 'eraser') { eraseAt(pt); return; }
  if (!input.current) return;
  if (Math.hypot(pt.x - input.lastPt.x, pt.y - input.lastPt.y) < 1.5) return;  // skip tiny wiggles
  const [x, y] = toCourt(pt);
  input.current.p.push(round2(x), round2(y));
  input.lastPt = pt;
  requestRender();
}

function endDraw() {
  if (state.tool === 'eraser') {
    if (input.erased) pushHistory(input.eraseSnap);
  } else if (input.current) {
    pushHistory(state.strokes.slice());
    state.strokes = [...state.strokes, input.current];
  }
  resetDrawing();
}

/** A second finger landed: throw away the half-drawn stroke (or undo the half-done erase). */
function cancelDrawing() {
  if (state.tool === 'eraser' && input.erased) state.strokes = input.eraseSnap;
  resetDrawing();
}

function resetDrawing() {
  input.drawId = input.drawType = input.current = input.lastPt = null;
  input.eraseSnap = null; input.erased = false;
  requestRender();
}

/** Remove every stroke the eraser touches (checks along the path, so fast swipes don't skip). */
function eraseAt(pt) {
  const from = input.lastErase || pt;
  const steps = Math.max(1, Math.ceil(Math.hypot(pt.x - from.x, pt.y - from.y) / 4));
  const radius = ERASER_RADIUS_PX / view.k;
  const before = state.strokes.length;
  for (let i = 1; i <= steps; i++) {
    const [x, y] = toCourt({ x: from.x + (pt.x - from.x) * i / steps, y: from.y + (pt.y - from.y) * i / steps });
    state.strokes = state.strokes.filter(s => !strokeHit(s, x, y, radius + strokeWidth(s) / 2));
  }
  if (state.strokes.length !== before) { input.erased = true; requestRender(); }
  input.lastErase = pt;
}

function strokeHit(s, x, y, r) {
  const p = s.p;
  if (p.length <= 2) return Math.hypot(p[0] - x, p[1] - y) <= r;
  for (let i = 0; i < p.length - 2; i += 2) {
    if (segmentDistance(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= r) return true;
  }
  return false;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/* =====================================================================
   9. UNDO / REDO / CLEAR
   Before each change we keep a copy of the strokes list.
   ===================================================================== */
function pushHistory(snapshot) {
  state.undo.push(snapshot);
  if (state.undo.length > 200) state.undo.shift();
  state.redo = [];
  markDirty();
}
function undo() {
  if (!state.undo.length) return;
  state.redo.push(state.strokes);
  state.strokes = state.undo.pop();
  markDirty();
}
function redo() {
  if (!state.redo.length) return;
  state.undo.push(state.strokes);
  state.strokes = state.redo.pop();
  markDirty();
}
function clearAll() {
  if (!state.strokes.length) return;
  pushHistory(state.strokes.slice());   // Clear can be undone, so no "are you sure?"
  state.strokes = [];
  toast('Cleared — Undo brings it back');
}

/* =====================================================================
   10. STORAGE (IndexedDB)
   "plays" holds saved plays; "meta" holds the work-in-progress drawing,
   so nothing is lost if iOS closes the app in the background.
   Version 2 (Stage 3) adds "teams", "players" and "games" for the Minutes tab
   (see data.js). Existing plays are untouched by the upgrade.
   ===================================================================== */
const DB = (() => {
  let dbPromise = null;
  function open() {
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        // Create whatever is missing, so an existing database keeps its plays
        const db = req.result, has = n => db.objectStoreNames.contains(n);
        if (!has('plays')) db.createObjectStore('plays', { keyPath: 'id' });
        if (!has('meta')) db.createObjectStore('meta');
        if (!has('teams')) db.createObjectStore('teams', { keyPath: 'id' });
        if (!has('players')) db.createObjectStore('players', { keyPath: 'id' }).createIndex('teamId', 'teamId');
        if (!has('games')) db.createObjectStore('games', { keyPath: 'id' }).createIndex('teamId', 'teamId');
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onclose = () => { dbPromise = null; };   // iOS sometimes drops the connection
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }
  async function run(storeName, mode, fn, retry = true) {
    try {
      const db = await open();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const req = fn(tx.objectStore(storeName));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      if (!retry) throw err;
      dbPromise = null;                // reconnect once and try again
      return run(storeName, mode, fn, false);
    }
  }
  return {
    allPlays:   ()       => run('plays', 'readonly',  s => s.getAll()),
    getPlay:    id       => run('plays', 'readonly',  s => s.get(id)),
    putPlay:    play     => run('plays', 'readwrite', s => s.put(play)),
    deletePlay: id       => run('plays', 'readwrite', s => s.delete(id)),
    getMeta:    key      => run('meta',  'readonly',  s => s.get(key)),
    setMeta:    (key, v) => run('meta',  'readwrite', s => s.put(v, key)),
    // General-purpose, for teams / players / games (used by data.js)
    all:        store            => run(store, 'readonly',  s => s.getAll()),
    get:        (store, id)      => run(store, 'readonly',  s => s.get(id)),
    put:        (store, obj)     => run(store, 'readwrite', s => s.put(obj)),
    del:        (store, id)      => run(store, 'readwrite', s => s.delete(id)),
    byTeam:     (store, teamId)  => run(store, 'readonly',  s => s.index('teamId').getAll(teamId)),
  };
})();

// Ask the browser to keep our data even when storage is low (helps, not guaranteed)
navigator.storage?.persist?.().catch(() => {});

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Plays saved before version 2 measured from the border's corner, not the court's. */
const FORMAT = 2;
const OLD_OFFSETS = { full: [3, 6], half: [6, 3] };
function upgradeStrokes(strokes, court, format) {
  if (format >= FORMAT || !OLD_OFFSETS[court]) return strokes;
  const [dx, dy] = OLD_OFFSETS[court];
  return strokes.map(s => ({ ...s, p: s.p.map((v, i) => round2(v - (i % 2 ? dy : dx))) }));
}

/** Save the work in progress (called shortly after every change). */
let draftTimer = null;
function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const { court, theme, strokes, playId, name, created, dirty, customColor, width } = state;
    DB.setMeta('draft', { v: FORMAT, court, theme, strokes, playId, name, created, dirty, customColor, penWidth: width })
      .catch(() => {});
  }, 400);
}

/* =====================================================================
   11. PLAYS: new, save, save as, open, rename, delete
   ===================================================================== */
function markDirty() { state.dirty = true; updateUI(); scheduleDraftSave(); requestRender(); }

/** OK to throw away the current drawing? Only asks if there are unsaved changes. */
async function okToDiscard(what) {
  if (!state.dirty || !state.strokes.length) return true;
  return !!(await ask({
    title: 'Discard changes?',
    message: `This drawing has unsaved changes. ${what}`,
    okText: 'Discard', danger: true,
  }));
}

function loadIntoState(p) {
  Object.assign(state, {
    court: p.court, theme: p.theme || state.theme,
    strokes: upgradeStrokes(p.strokes || [], p.court, p.v || 1),
    playId: p.playId ?? p.id ?? null, name: p.name || '', created: p.created || null,
    dirty: !!p.dirty, undo: [], redo: [],
  });
  if (p.customColor) state.customColor = p.customColor;
  if (p.penWidth) state.width = p.penWidth;
  fitView(); updateUI(); scheduleDraftSave();
}

async function newPlay(court = state.court) {
  if (!(await okToDiscard('Start a new play anyway?'))) return false;
  loadIntoState({ v: FORMAT, court, strokes: [], dirty: false });
  return true;
}

async function save() {
  if (!state.playId) return saveAsNew();
  await writePlay(state.playId, state.name);
}

async function saveAsNew() {
  const name = await ask({
    title: state.playId ? 'Save as new play' : 'Save play',
    message: 'Give this play a name.',
    input: state.playId ? `${state.name} copy` : '',
    placeholder: 'e.g. Box inbound',
    okText: 'Save',
  });
  if (name == null) return;
  state.created = null;
  await writePlay(newId(), name.trim() || 'Untitled play');
  closePlays();
}

async function writePlay(id, name) {
  const now = Date.now();
  const play = {
    v: FORMAT, id, name, court: state.court, theme: state.theme, strokes: state.strokes,
    created: state.created || now, updated: now,
  };
  try {
    await DB.putPlay(play);
  } catch (err) {
    ask({ title: 'Could not save', message: String(err && err.message || err), okText: 'OK', noCancel: true });
    return;
  }
  Object.assign(state, { playId: id, name, created: play.created, dirty: false });
  updateUI(); scheduleDraftSave();
  toast(`Saved “${name}”`);
}

async function openPlay(id) {
  if (id === state.playId) { closePlays(); return; }
  if (!(await okToDiscard('Open the other play anyway?'))) return;
  const p = await DB.getPlay(id);
  if (!p) return;
  loadIntoState({ ...p, dirty: false });
  closePlays();
}

async function renamePlay(id) {
  const p = await DB.getPlay(id);
  const name = await ask({ title: 'Rename play', input: p.name, okText: 'Rename' });
  if (name == null || !name.trim()) return;
  p.name = name.trim(); p.updated = Date.now();
  await DB.putPlay(p);
  if (state.playId === id) { state.name = p.name; updateUI(); scheduleDraftSave(); }
  renderPlayList();
}

async function deletePlay(id) {
  const p = await DB.getPlay(id);
  const ok = await ask({
    title: 'Delete play?',
    message: `“${p.name}” will be permanently deleted. This can't be undone.`,
    okText: 'Delete', danger: true,
  });
  if (!ok) return;
  await DB.deletePlay(id);
  if (state.playId === id) {   // keep the drawing on screen, but as an unsaved play
    Object.assign(state, { playId: null, created: null, dirty: true });
    updateUI(); scheduleDraftSave();
  }
  renderPlayList();
}

/* ----- the Playbook screen ----- */
const playsSheet = document.getElementById('plays');
function openPlays() { hideTools(); renderPlayList(); playsSheet.hidden = false; }
function closePlays() { playsSheet.hidden = true; }

async function renderPlayList() {
  const list = document.getElementById('playList');
  const plays = (await DB.allPlays()).sort((a, b) => b.updated - a.updated);
  list.innerHTML = '';
  if (!plays.length) {
    list.innerHTML = '<li class="empty" style="background:none">No saved plays yet.<br>Draw something and tap Save.</li>';
    return;
  }
  for (const p of plays) {
    const li = document.createElement('li');
    if (p.id === state.playId) li.className = 'current';
    const date = new Date(p.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    li.innerHTML = `
      <button class="open"><div><div class="name"></div><div class="meta"></div></div></button>
      <button class="pill-btn rename">Rename</button>
      <button class="pill-btn delete" aria-label="Delete">
        <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
      </button>`;
    li.querySelector('.name').textContent = p.name;   // textContent: names are shown as plain text
    li.querySelector('.meta').textContent = `${COURTS[p.court]?.label || ''} · ${date}`;
    li.querySelector('.open').onclick = () => openPlay(p.id);
    li.querySelector('.rename').onclick = () => renamePlay(p.id);
    li.querySelector('.delete').onclick = () => deletePlay(p.id);
    list.appendChild(li);
  }
}

/* =====================================================================
   12. BACKUP: one file with everything — plays, teams, rosters, games —
   and import it back. (Version 1 files, from before Stage 3, had plays only;
   they still import.)
   ===================================================================== */
const TEAM_STORES = ['teams', 'players', 'games'];

async function exportBackup() {
  const plays = await DB.allPlays();
  const team = {};
  for (const st of TEAM_STORES) team[st] = await DB.all(st);
  const total = plays.length + team.teams.length + team.players.length + team.games.length;
  if (!total) { toast('Nothing to back up yet'); return; }
  const data = { app: 'penguins-playbook', version: 2, exported: new Date().toISOString(), plays, ...team };
  const fileName = `penguins-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data)], fileName, { type: 'application/json' });

  // On iPhone/iPad, the share sheet ("Save to Files", AirDrop…) is the reliable way to save a file
  const isTouchDevice = navigator.maxTouchPoints > 0;
  if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Penguins Playbook backup' }); }
    catch (err) { if (err.name !== 'AbortError') toast('Sharing failed: ' + err.message); }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Backup exported');
}

/** Import merges: new items are added; an item already here is replaced only if the backup's copy is newer. */
async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { data = null; }
  if (!data || !Array.isArray(data.plays)) {
    ask({ title: 'Not a backup file', message: 'That file isn’t a Penguins backup.', okText: 'OK', noCancel: true });
    return;
  }
  const counts = [];
  const merge = async (store, items, isValid, label) => {
    if (!Array.isArray(items)) return;
    const existing = new Map((await DB.all(store)).map(x => [x.id, x]));
    let added = 0, updated = 0;
    for (const x of items) {
      if (!x || typeof x.id !== 'string' || !isValid(x)) continue;
      const mine = existing.get(x.id);
      if (!mine) { await DB.put(store, x); added++; }
      else if ((x.updated || 0) > (mine.updated || 0)) { await DB.put(store, x); updated++; }
    }
    if (added || updated) counts.push(`${label}: ${added} added, ${updated} updated`);
  };
  await merge('plays', data.plays, p => COURTS[p.court] && Array.isArray(p.strokes), 'Plays');
  await merge('teams', data.teams, t => typeof t.name === 'string', 'Teams');
  await merge('players', data.players, p => typeof p.teamId === 'string', 'Players');
  await merge('games', data.games, g => typeof g.teamId === 'string' && Array.isArray(g.events), 'Games');
  renderPlayList();
  window.onBackupImported?.();   // lets the Minutes tab refresh (see data.js)
  ask({
    title: 'Backup imported',
    message: (counts.length ? counts.join('. ') + '.' : 'Nothing new in that file.') + ' What you already had was kept.',
    okText: 'OK', noCancel: true,
  });
}

/* =====================================================================
   13. SCREEN UPDATES, POP-UPS, BUTTON WIRING
   ===================================================================== */
const $ = id => document.getElementById(id);

function currentInk() {
  return state.color === 0 ? THEMES[state.theme].ink : state.color;
}

function updateUI() {
  const t = THEMES[state.theme], root = document.documentElement.style;
  root.setProperty('--ink', currentInk());
  root.setProperty('--custom', state.customColor);
  $('btnInk').querySelector('.dot').style.background = t.ink;
  $('btnInk').classList.toggle('active', state.tool === 'pen' && state.color === 0);
  $('btnColor').classList.toggle('active', state.tool === 'pen' && state.color !== 0);
  $('btnEraser').classList.toggle('active', state.tool === 'eraser');
  $('btnUndo').disabled = !state.undo.length;
  $('btnRedo').disabled = !state.redo.length;
  $('btnSave').classList.toggle('unsaved', state.dirty && state.strokes.length > 0);
  $('playName').textContent = state.name || 'Untitled play';
  $('version').textContent = `Penguins Playbook · version ${APP_VERSION}`;
  widthRange.value = state.width;
  $('widthPreview').style.height = Math.max(1, state.width * view.k) + 'px';
  document.querySelectorAll('[data-court]').forEach(b => b.classList.toggle('active', b.dataset.court === state.court));
  $('courtSeg').classList.toggle('half', state.court === 'half');
  document.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === state.theme));
  // Whatever peeks out around the app (rare) matches the border
  document.documentElement.style.background = document.body.style.background = t.band;
  $('scrim').classList.toggle('show', t.band === '#ffffff');   // shade behind the clock on a white border
  document.body.classList.toggle('light-band', t.band === '#ffffff');
  requestRender();
}

let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/** One pop-up for everything. Resolves to: the typed text (if input), true (OK), or null (Cancel). */
function ask({ title, message = '', input, placeholder = '', okText = 'OK', danger = false, noCancel = false }) {
  const dlg = $('modal'), inp = $('modalInput'), okBtn = $('modalOk'), cancelBtn = $('modalCancel');
  $('modalTitle').textContent = title;
  $('modalMsg').textContent = message;
  $('modalMsg').hidden = !message;
  inp.hidden = input === undefined;
  inp.value = input || ''; inp.placeholder = placeholder;
  okBtn.textContent = okText;
  okBtn.className = danger ? 'danger' : 'primary';
  cancelBtn.hidden = noCancel;
  return new Promise(resolve => {
    const finish = result => {
      $('modalForm').onsubmit = cancelBtn.onclick = dlg.oncancel = null;
      dlg.close();
      resolve(result);
    };
    $('modalForm').onsubmit = e => { e.preventDefault(); finish(input === undefined ? true : inp.value); };
    cancelBtn.onclick = () => finish(null);
    dlg.oncancel = e => { e.preventDefault(); finish(null); };
    dlg.showModal();
    if (!inp.hidden) { inp.focus(); inp.select(); }
  });
}

// Toolbar open/close
/* ----- Tools rail: swipe in from the right edge, swipe back to hide ----- */
const drawer = $('drawer');
const EDGE_ZONE = 24;   // a finger starting this close to the right edge opens the tools

function toolsOpen() { return !drawer.classList.contains('closed'); }
/** How far right the rail moves to hide, leaving only the tab peeking out. */
function hideDistance() { return $('rail').offsetWidth + 6 + 10 + safeInsets().right; }
function showTools() { settleDrawer(true); }
function hideTools() { settleDrawer(false); }
function settleDrawer(open) {
  drawer.style.transition = drawer.style.transform = '';   // hand back to the CSS spring
  drawer.style.setProperty('--hide', hideDistance() + 'px');
  drawer.classList.toggle('closed', !open);
  if (!open) $('more').hidden = true;
}

// A swipe in progress: the rail follows the finger, then springs open or closed
let swipe = null, swallowClick = false;
function swipeStart(x) {
  const hide = hideDistance();
  swipe = { x0: x, base: toolsOpen() ? 0 : hide, hide, pos: null, moved: false, t0: performance.now() };
}
function swipeMove(x) {
  if (!swipe) return;
  const dx = x - swipe.x0;
  if (Math.abs(dx) > 6) swipe.moved = true;
  if (!swipe.moved) return;
  swipe.pos = Math.min(swipe.hide, Math.max(0, swipe.base + dx));
  drawer.style.transition = 'none';
  drawer.style.transform = `translate(${swipe.pos}px, -50%)`;
  $('more').hidden = true;
}
/** Returns true if this was a swipe (not a tap). */
function swipeEnd(x) {
  if (!swipe) return false;
  const s = swipe; swipe = null;
  if (!s.moved) return false;
  const speed = (x - s.x0) / Math.max(1, performance.now() - s.t0);   // points per ms; + = rightward
  const open = speed < -0.4 ? true : speed > 0.4 ? false : s.pos < s.hide / 2;
  settleDrawer(open);
  return true;
}

// Swiping on the rail or its tab (a quick flick right puts it away; a tap still works normally)
drawer.addEventListener('pointerdown', e => {
  swipeStart(e.clientX);
  const move = ev => swipeMove(ev.clientX);
  const up = ev => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    if (swipeEnd(ev.clientX)) {   // a swipe shouldn't also press a button…
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 400);   // …but the next real tap should work
    }
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
});
drawer.addEventListener('click', e => {
  if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); }
}, true);
$('grab').onclick = () => (toolsOpen() ? hideTools() : showTools());
$('btnMore').onclick = () => { $('more').hidden = !$('more').hidden; };

// Ink, color picker, eraser
$('btnInk').onclick = () => { state.color = 0; state.tool = 'pen'; updateUI(); };
$('colorInput').addEventListener('click', () => {   // tapping the rainbow selects the picked color too
  state.color = state.customColor; state.tool = 'pen';
  $('colorInput').value = state.customColor; updateUI();
});
$('colorInput').addEventListener('input', e => {
  state.customColor = state.color = e.target.value; state.tool = 'pen';
  updateUI(); scheduleDraftSave();
});
$('btnEraser').onclick = () => { state.tool = state.tool === 'eraser' ? 'pen' : 'eraser'; updateUI(); };

// Actions
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('btnClear').onclick = clearAll;
$('btnSave').onclick = save;

// More menu
document.querySelectorAll('[data-court]').forEach(b => b.onclick = async () => {
  if (b.dataset.court !== state.court) { await newPlay(b.dataset.court); }
});
document.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => {
  if (b.dataset.theme !== state.theme) { state.theme = b.dataset.theme; markDirty(); }
});
const widthRange = $('widthRange');
Object.assign(widthRange, { min: MIN_WIDTH, max: MAX_WIDTH, step: 0.05 });
widthRange.addEventListener('input', () => {
  state.width = round2(+widthRange.value); state.tool = 'pen';
  updateUI(); scheduleDraftSave();
});
$('btnPlays').onclick = openPlays;
$('btnFit').onclick = () => { fitView(); hideTools(); };

// Playbook screen
$('btnClosePlays').onclick = closePlays;
$('btnNew').onclick = async () => { if (await newPlay()) closePlays(); };
$('btnSaveAs').onclick = saveAsNew;
$('btnExport').onclick = exportBackup;
$('btnImport').onclick = () => $('importFile').click();
$('importFile').onchange = e => {
  const f = e.target.files[0];
  e.target.value = '';   // so the same file can be picked again later
  if (f) importBackup(f);
};

/* =====================================================================
   14. START-UP
   ===================================================================== */
/** Re-measure the screen and refit the court. iOS can report the old screen shape
 *  for a moment when the app wakes or rotates, so check again shortly after. */
function refreshLayout() { sizeApp(); resizeCanvas(); settleDrawer(toolsOpen()); }
function refreshSoon() { refreshLayout(); for (const ms of [150, 500, 1200]) setTimeout(refreshLayout, ms); }
window.addEventListener('resize', refreshSoon);
window.addEventListener('orientationchange', () => { $('more').hidden = true; refreshSoon(); });
window.addEventListener('pageshow', refreshSoon);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSoon(); });
screen.orientation?.addEventListener?.('change', refreshSoon);

(async function start() {
  sizeApp();
  resizeCanvas();
  updateUI();
  settleDrawer(false);
  try {
    const draft = await DB.getMeta('draft');
    if (draft && COURTS[draft.court]) loadIntoState(draft);
    else toast('Tip: pinch with two fingers to zoom');
  } catch { /* storage unavailable: app still works, just can't save */ }

  // Offline support (only works on a real web address, not when opening the file directly)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
