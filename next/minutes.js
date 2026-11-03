/* Penguins — the Minutes tab (Stage 4): pre-game, game clock, substitutions,
   undo, and the sub alert. The calculations live in gamelog.js; storage in data.js.

   Sections
     1. State and loading
     2. Recording actions (every change = events added to the log, saved at once)
     3. Pre-game screen
     4. Live-game screen (clock, on court, bench, sub queue)
     5. Final screen
     6. The once-a-quarter-second update (clock text, minutes, auto-stop at 0:00, alerts)
     7. Sub alert (flash + sound) and keeping the screen awake
     8. Menus and pop-ups (player menu, game menu, game settings)

   Uses from other files: $, ask, toast (playbook.js) · Data (data.js) · SPORTS (sports.js)
   · replayGame, formatClock, periodLabel, periodSeconds, GameClock (gamelog.js). */
'use strict';

/* =====================================================================
   1. STATE AND LOADING
   ===================================================================== */
const M = {
  team: null, roster: [], game: null,
  out: null,          // on-court player tapped to come out (waiting for a bench player)
  pairs: [],          // queued subs: [{ out, in }]
  firedAlerts: new Set(),
  wake: null, audio: null,
};

const ABSENCE = { absent: 'Absent', injured: 'Injured', sitting: 'Sitting out' };

function defaultSettings(team) {
  const sport = SPORTS[team.sport] || SPORTS.basketball;
  return { periods: sport.periods, periodMinutes: sport.periodMinutes, onCourt: sport.onCourt,
           subAlert: { mode: 'half', minutes: 3 }, ...(team.gameDefaults || {}) };
}

/** Load the team, roster and the game in progress (creating a fresh pre-game if none). */
async function loadMinutes() {
  M.team = await Data.currentTeam();
  M.roster = await Data.players(M.team.id, { includeRemoved: true });
  const id = await DB.getMeta('currentGameId');
  let game = id && await DB.get('games', id);
  if (!game || game.teamId !== M.team.id) game = await newPregame();
  M.game = game;
  markPassedAlerts();
  renderMinutes();
}
window.onTeamChanged = loadMinutes;   // called by settings.js when the team or roster changes

async function newPregame() {
  const game = await Data.saveGame({
    id: Data.newId(), teamId: M.team.id, date: Date.now(), opponent: '',
    settings: defaultSettings(M.team), absences: {}, starters: [], status: 'pregame', events: [],
  });
  await DB.setMeta('currentGameId', game.id);
  return game;
}

/** Save the game. Updates the same object in place: taps made while a save is still
 *  finishing (e.g. picking starters quickly) must never be lost. */
async function saveGame() {
  const saved = await Data.saveGame(M.game);
  M.game.created = saved.created; M.game.updated = saved.updated;
}

const playerById = id => M.roster.find(p => p.id === id);
/** Players who can play this game: on the roster, active, not marked absent/injured/sitting. */
function available() {
  return M.roster.filter(p => !p.removed && p.active && !M.game.absences[p.id]);
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowState = () => replayGame(M.game);

/* =====================================================================
   2. RECORDING ACTIONS
   Each action adds one or more events sharing an "action" id, so Undo can remove
   exactly the last action. Saved immediately.
   ===================================================================== */
async function record(events, { status } = {}) {
  const action = Data.newId(), at = GameClock.now();
  for (const e of events) M.game.events.push({ id: Data.newId(), action, at, ...e });
  if (status) M.game.status = status;
  await saveGame();
  renderMinutes();
}

async function startGame() {
  const st = M.game.starters.filter(id => available().some(p => p.id === id));
  if (st.length !== M.game.settings.onCourt) return;
  unlockSound();
  const len = periodSeconds(M.game);
  M.game.date = Date.now();
  await record(st.map(id => ({ type: 'sub_in', period: 1, clock: len, playerId: id })), { status: 'live' });
}

async function toggleClock() {
  unlockSound();
  const r = nowState();
  if (r.running) return record([{ type: 'clock_stop', period: r.period, clock: r.clock }]);
  if (r.clock <= 0) return;
  return record([{ type: 'clock_start', period: r.period, clock: r.clock }]);
}

async function nextPeriod() {
  const r = nowState(), events = [];
  if (r.running) events.push({ type: 'clock_stop', period: r.period, clock: r.clock });
  if (r.lastPeriod) {
    events.push({ type: 'game_end', period: r.period, clock: r.clock });
    return record(events, { status: 'final' });
  }
  events.push({ type: 'period_end', period: r.period, clock: r.clock });
  return record(events);
}

async function commitSubs() {
  if (!M.pairs.length) return;
  const r = nowState(), events = [];
  for (const { out, in: inn } of M.pairs) {
    events.push({ type: 'sub_out', period: r.period, clock: r.clock, playerId: out });
    events.push({ type: 'sub_in', period: r.period, clock: r.clock, playerId: inn });
  }
  M.pairs = []; M.out = null;
  await record(events);
  toast(events.length / 2 === 1 ? 'Sub made' : `${events.length / 2} subs made`);
}

/** Undo the last action (all events that share its action id). */
async function undo() {
  const ev = M.game.events;
  if (!ev.length) return;
  const last = ev[ev.length - 1].action, removed = ev.filter(e => e.action === last);
  M.game.events = ev.filter(e => e.action !== last);
  if (!M.game.events.length) M.game.status = 'pregame';
  else if (removed.some(e => e.type === 'game_end')) M.game.status = 'live';
  M.pairs = []; M.out = null;
  await saveGame(); renderMinutes();
  toast('Undone');
}

async function adjustClock() {
  const r = nowState(), len = periodSeconds(M.game);
  const v = await ask({ title: 'Adjust clock', message: `Time remaining in ${periodLabel(M.game, r.period)} (minutes:seconds).`,
    input: formatClock(r.clock), okText: 'Set' });
  if (v == null) return;
  const m = String(v).trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) { toast('Use minutes:seconds, like 4:30'); return; }
  const secs = Math.min(len, Number(m[1]) * 60 + Number(m[2] || 0));
  const now = nowState();   // read again: the clock may have run while the pop-up was open
  await record([{ type: 'clock_adjust', period: now.period, clock: secs, data: { from: now.clock } }]);
}

async function endGameEarly() {
  const ok = await ask({ title: 'End this game now?', message: 'Minutes so far are kept. You can undo this.', okText: 'End game' });
  if (!ok) return;
  const r = nowState(), events = [];
  if (r.running) events.push({ type: 'clock_stop', period: r.period, clock: r.clock });
  events.push({ type: 'game_end', period: r.period, clock: r.clock });
  await record(events, { status: 'final' });
}

async function startNewGame() {
  if (M.game.status === 'live') {
    const ok = await ask({ title: 'Leave this game?', message: 'It will be ended and kept, with the minutes so far.', okText: 'Leave game', danger: true });
    if (!ok) return;
    const r = nowState();
    M.game.events.push({ id: Data.newId(), action: Data.newId(), at: GameClock.now(), type: 'game_end', period: r.period, clock: r.clock });
    M.game.status = 'final'; await saveGame();
  }
  M.pairs = []; M.out = null; M.firedAlerts.clear();
  M.game = await newPregame(); renderMinutes();
}

async function discardGame() {
  const ok = await ask({ title: 'Discard this game?', message: 'It is deleted with its minutes. This can’t be undone.', okText: 'Discard', danger: true });
  if (!ok) return;
  await DB.del('games', M.game.id);
  M.pairs = []; M.out = null; M.firedAlerts.clear();
  M.game = await newPregame(); renderMinutes();
}

/* =====================================================================
   3. PRE-GAME SCREEN
   ===================================================================== */
function settingsSummary(s) {
  const alert = s.subAlert.mode === 'off' ? 'off' : s.subAlert.mode === 'half' ? 'halfway' : `every ${s.subAlert.minutes} min`;
  return `${s.periods} × ${s.periodMinutes} min · Sub alert ${alert}`;
}

function renderPregame(body) {
  const g = M.game, need = g.settings.onCourt;
  g.starters = g.starters.filter(id => available().some(p => p.id === id));
  const roster = M.roster.filter(p => !p.removed && p.active);
  const n = g.starters.length;
  body.innerHTML = `
    <section class="card">
      <label class="field">Opponent<input id="gOpp" type="text" maxlength="40" placeholder="Optional" autocomplete="off"></label>
      <button class="field field-btn" id="gFormat"><span>Format</span><span class="field-value">${esc(settingsSummary(g.settings))} ›</span></button>
    </section>
    <h2 class="card-title">Starters <span>${n} of ${need}</span></h2>
    <p class="hint">Tap to pick ${need} starters. Press and hold a player for Absent, Injured or Sitting out.</p>
    ${roster.length ? '<ul class="players" id="pgList"></ul>'
      : '<div class="card empty-card">No players yet.<br><button class="pill-btn primary-btn" id="gAddPlayers">Add your roster</button></div>'}
    <button class="big-btn" id="gStart" ${n === need ? '' : 'disabled'}>${n === need ? 'Start game' : `Pick ${need - n} more starter${need - n === 1 ? '' : 's'}`}</button>`;
  $('gOpp').value = g.opponent || '';
  $('gOpp').onchange = () => { g.opponent = $('gOpp').value.trim(); saveGame(); };
  $('gFormat').onclick = openGameSettings;
  $('gAddPlayers')?.addEventListener('click', openTeamSheet);
  $('gStart').onclick = startGame;
  const list = $('pgList');
  for (const p of roster) {
    const away = g.absences[p.id], picked = g.starters.includes(p.id);
    const li = playerRow(p, { tag: away ? ABSENCE[away] : picked ? 'Starter' : '', cls: away ? 'away' : picked ? 'picked' : '' });
    onTapOrHold(li, () => {
      if (away) { toast(`${p.name} is marked ${ABSENCE[away].toLowerCase()} — hold to change`); return; }
      if (picked) g.starters = g.starters.filter(id => id !== p.id);
      else if (g.starters.length < need) g.starters.push(p.id);
      else { toast(`Already ${need} starters — tap one to remove her first`); return; }
      saveGame(); renderMinutes();
    }, () => openPlayerMenu(p));
    list?.appendChild(li);
  }
}

/** One player row: jersey number, name, optional minutes and tag. Solid and high-contrast. */
function playerRow(p, { tag = '', cls = '', minutes = null } = {}) {
  const li = document.createElement('li');
  li.className = 'prow ' + cls;
  li.innerHTML = `<span class="pnum">${esc(p.number || '–')}</span><span class="pname">${esc(p.name)}</span>`
    + (tag ? `<span class="ptag">${esc(tag)}</span>` : '')
    + (minutes != null ? `<span class="pmin" data-min="${p.id}">${formatClock(minutes, { up: false })}</span>` : '');
  return li;
}

/** Tap = select; press-and-hold (0.5 s) = player menu. */
function onTapOrHold(el, onTap, onHold) {
  let timer = null, held = false, x0 = 0, y0 = 0;
  el.addEventListener('pointerdown', e => {
    held = false; x0 = e.clientX; y0 = e.clientY;
    timer = setTimeout(() => { held = true; timer = null; onHold && onHold(); }, 500);
  });
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(); });
  el.addEventListener('pointerup', cancel); el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('click', () => { if (!held) onTap(); });
}

/* =====================================================================
   4. LIVE-GAME SCREEN
   ===================================================================== */
function renderLive(body) {
  const g = M.game, r = nowState();
  const onCourt = r.onCourt.map(playerById).filter(Boolean);
  const pairedOut = new Set(M.pairs.map(x => x.out)), pairedIn = new Set(M.pairs.map(x => x.in));
  // Bench: everyone available who isn't on court, least minutes first
  const bench = available().filter(p => !r.onCourt.includes(p.id))
    .sort((a, b) => (r.played[a.id] || 0) - (r.played[b.id] || 0) || String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
  const label = periodLabel(g, r.period);
  const mainBtn = r.periodOver
    ? `<button class="clock-btn next" id="gNext">${r.lastPeriod ? 'End game' : `Start ${periodLabel(g, r.period + 1)}`}</button>`
    : `<button class="clock-btn ${r.running ? 'stop' : 'go'}" id="gClock">${r.running ? 'Stop' : 'Start'}</button>`;

  body.innerHTML = `
    <section class="scoreboard">
      <div class="sb-top">
        <span class="period-chip" id="gPeriod">${label}</span>
        <span class="sb-vs">${g.opponent ? 'vs ' + esc(g.opponent) : ''}</span>
        <button class="undo-btn" id="gUndo" ${g.events.length ? '' : 'disabled'} aria-label="Undo last action">
          <svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>Undo</button>
        <button class="round-btn glass" id="gMenu" aria-label="Game menu">
          <svg viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/></svg></button>
      </div>
      <div class="clock ${r.running ? 'running' : ''} ${r.periodOver ? 'over' : ''}" id="gClockText">${formatClock(r.clock)}</div>
      ${r.periodOver ? `<div class="period-over">End of ${label}</div>` : ''}
      ${mainBtn}
    </section>

    <h2 class="card-title">On court <span>${onCourt.length}</span></h2>
    <ul class="players" id="courtList"></ul>
    <h2 class="card-title">Bench <span>least played first</span></h2>
    <ul class="players" id="benchList"></ul>
    ${bench.length ? '' : '<p class="hint">Nobody on the bench.</p>'}`;

  $('gUndo').onclick = undo;
  $('gMenu').onclick = openGameMenu;
  $('gClock')?.addEventListener('click', toggleClock);
  $('gNext')?.addEventListener('click', nextPeriod);

  for (const p of onCourt) {
    const sel = M.out === p.id, out = pairedOut.has(p.id);
    const li = playerRow(p, { minutes: r.played[p.id] || 0, tag: out ? 'Out' : sel ? 'Out?' : '', cls: (sel ? 'selected ' : '') + (out ? 'going-out' : '') });
    onTapOrHold(li, () => tapCourt(p.id), () => toast('Sub her out first, then press and hold on the bench'));
    $('courtList').appendChild(li);
  }
  for (const p of bench) {
    const inn = pairedIn.has(p.id);
    const li = playerRow(p, { minutes: r.played[p.id] || 0, tag: inn ? 'In' : '', cls: (inn ? 'coming-in ' : '') + (M.out ? 'can-pick' : '') });
    onTapOrHold(li, () => tapBench(p.id), () => openPlayerMenu(p));
    $('benchList').appendChild(li);
  }
  renderSubBar();
}

function tapCourt(id) {
  const i = M.pairs.findIndex(x => x.out === id);
  if (i >= 0) M.pairs.splice(i, 1);            // tap a queued player again = take that sub back
  else M.out = M.out === id ? null : id;
  renderMinutes();
}
function tapBench(id) {
  const i = M.pairs.findIndex(x => x.in === id);
  if (i >= 0) { M.pairs.splice(i, 1); renderMinutes(); return; }
  if (!M.out) { toast('First tap who comes OUT (on court)'); return; }
  M.pairs.push({ out: M.out, in: id }); M.out = null;
  renderMinutes();
}

/** The sub queue: floats above the tab switcher while subs are being picked. */
function renderSubBar() {
  const bar = $('subBar');
  const live = M.game?.status === 'live' && (M.pairs.length || M.out);
  bar.hidden = !live;
  const room = () => document.documentElement.style.setProperty('--subbar-h', bar.hidden ? '0px' : bar.offsetHeight + 12 + 'px');
  if (!live) { room(); return; }
  const name = id => { const p = playerById(id); return p ? `#${esc(p.number)} ${esc(p.name)}` : '?'; };
  bar.innerHTML = `
    <div class="sub-pairs">${M.pairs.map(x => `<span class="pair"><b>${name(x.out)}</b> ↓ <b>${name(x.in)}</b> ↑</span>`).join('')}
      ${M.out ? `<span class="pair pending"><b>${name(M.out)}</b> ↓ — tap a bench player</span>` : ''}</div>
    <div class="sub-actions">
      <button class="pill-btn" id="subCancel">Cancel</button>
      <button class="pill-btn primary-btn" id="subConfirm" ${M.pairs.length ? '' : 'disabled'}>Confirm ${M.pairs.length || ''} sub${M.pairs.length === 1 ? '' : 's'}</button>
    </div>`;
  room();   // make room at the bottom of the list for the queue
  $('subCancel').onclick = () => { M.pairs = []; M.out = null; renderMinutes(); };
  $('subConfirm').onclick = commitSubs;
}

/* =====================================================================
   5. FINAL SCREEN (the timeline and season view come in Stage 5)
   ===================================================================== */
function renderFinal(body) {
  const g = M.game, r = nowState();
  const ids = Object.keys(r.played).concat(available().map(p => p.id));
  const rows = [...new Set(ids)].map(playerById).filter(Boolean)
    .sort((a, b) => (r.played[b.id] || 0) - (r.played[a.id] || 0));
  body.innerHTML = `
    <section class="scoreboard final">
      <div class="sb-top"><span class="period-chip">Final</span><span class="sb-vs">${g.opponent ? 'vs ' + esc(g.opponent) : ''}</span>
        <button class="undo-btn" id="gUndo"><svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>Undo</button></div>
      <div class="final-date">${new Date(g.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
    </section>
    <h2 class="card-title">Minutes</h2>
    <ul class="players" id="finalList"></ul>
    <button class="big-btn" id="gNew">New game</button>`;
  for (const p of rows) $('finalList').appendChild(playerRow(p, { minutes: r.played[p.id] || 0 }));
  $('gUndo').onclick = undo;
  $('gNew').onclick = startNewGame;
}

/** Draw whichever screen fits the game's status. */
function renderMinutes() {
  const body = $('mBody');
  if (!body || !M.game) return;
  if (M.game.status === 'pregame') renderPregame(body);
  else if (M.game.status === 'live') renderLive(body);
  else renderFinal(body);
  if (M.game.status !== 'live') { M.pairs = []; M.out = null; renderSubBar(); }
  updateWakeLock();
}

/* =====================================================================
   6. EVERY QUARTER SECOND: clock text, minutes, auto-stop at 0:00, alerts.
   Keeps running on every tab, so alerts work while you're in the Playbook.
   Nothing here counts time — it re-reads the log against the current time.
   ===================================================================== */
setInterval(() => {
  if (!M.game || M.game.status !== 'live') return;
  const r = nowState();
  // Reached 0:00 → stop the clock at the exact moment it hit zero
  if (r.running && r.clock <= 0 && r.runStart) {
    const at = r.runStart.at + r.runStart.clock * 1000;
    M.game.events.push({ id: Data.newId(), action: Data.newId(), at, type: 'clock_stop', period: r.period, clock: 0 });
    saveGame(); renderMinutes(); flashAlert(`End of ${periodLabel(M.game, r.period)}`);
    return;
  }
  const t = $('gClockText');
  if (t) t.textContent = formatClock(r.clock);
  for (const el of document.querySelectorAll('[data-min]')) el.textContent = formatClock(r.played[el.dataset.min] || 0, { up: false });
  if (r.running) checkSubAlert(r);
}, 250);

/* =====================================================================
   7. SUB ALERT AND SCREEN WAKE
   What works on iPhone/iPad: the flash and banner whenever the app is open on
   screen (on any tab), plus the sound if the phone isn't muted. What can't:
   alerts while the screen is locked or in another app (that needs push
   notifications from a server), and vibration (not available to web apps).
   ===================================================================== */
function alertPoints(game) {
  const len = periodSeconds(game), a = game.settings.subAlert || { mode: 'off' };
  if (a.mode === 'half') return [len / 2];
  if (a.mode === 'every' && a.minutes > 0) {
    const pts = [];
    for (let t = a.minutes * 60; t < len - 1; t += a.minutes * 60) pts.push(t);
    return pts;
  }
  return [];
}
/** On load, don't re-fire alerts for moments already past. */
function markPassedAlerts() {
  M.firedAlerts.clear();
  if (!M.game || M.game.status !== 'live') return;
  const r = nowState(), el = periodSeconds(M.game) - r.clock;
  for (const pt of alertPoints(M.game)) if (el >= pt) M.firedAlerts.add(`${r.period}:${pt}`);
}
function checkSubAlert(r) {
  const el = periodSeconds(M.game) - r.clock;
  for (const pt of alertPoints(M.game)) {
    const key = `${r.period}:${pt}`;
    if (el >= pt && !M.firedAlerts.has(key)) {
      M.firedAlerts.add(key);
      flashAlert(`Sub time · ${periodLabel(M.game, r.period)} · ${formatClock(r.clock)} left`);
    }
  }
}
function flashAlert(text) {
  const b = $('alertBanner');
  b.textContent = text; b.hidden = false;
  document.body.classList.remove('alert-flash'); void document.body.offsetWidth;   // restart the animation
  document.body.classList.add('alert-flash');
  beep();
  clearTimeout(flashAlert.t);
  flashAlert.t = setTimeout(() => { b.hidden = true; document.body.classList.remove('alert-flash'); }, 6000);
}

/** Sound needs a tap first on iPhone; Start/Stop and Start game unlock it. */
function unlockSound() {
  try {
    if (!M.audio) M.audio = new (window.AudioContext || window.webkitAudioContext)();
    if (M.audio.state === 'suspended') M.audio.resume();
    // iOS 17+: let the alert sound play even with the ring/silent switch on mute
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* no sound available — the flash still works */ }
}
function beep() {
  const ac = M.audio;
  if (!ac) return;   // sound not unlocked yet (needs a tap on Start first)
  try {
    [[880, 0], [1175, 0.2], [880, 0.4]].forEach(([f, t0]) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.2);
    });
  } catch { /* ignore */ }
}

/** Keep the screen on while a game is live (Screen Wake Lock; recent iOS supports it). */
async function updateWakeLock() {
  const want = M.game?.status === 'live' && document.visibilityState === 'visible';
  try {
    if (want && !M.wake && navigator.wakeLock) {
      M.wake = await navigator.wakeLock.request('screen');
      M.wake.addEventListener('release', () => { M.wake = null; });
    } else if (!want && M.wake) { await M.wake.release(); M.wake = null; }
  } catch { M.wake = null; }
}
document.addEventListener('visibilitychange', () => { updateWakeLock(); if (!document.hidden) renderMinutes(); });

/* =====================================================================
   8. MENUS AND POP-UPS
   ===================================================================== */
/** Press-and-hold menu: Absent / Injured / Sitting out / Reactivate — this game only. */
function openPlayerMenu(p) {
  const d = $('playerMenu');
  $('pmTitle').textContent = `#${p.number || '–'} ${p.name}`;
  const cur = M.game.absences[p.id];
  $('pmNote').textContent = cur ? `Marked ${ABSENCE[cur].toLowerCase()} for this game.` : 'For this game only.';
  for (const b of d.querySelectorAll('[data-abs]')) {
    b.classList.toggle('active', b.dataset.abs === cur);
    b.hidden = b.dataset.abs === 'reactivate' ? !cur : false;
    b.onclick = async () => {
      d.close();
      if (b.dataset.abs === 'reactivate') delete M.game.absences[p.id];
      else M.game.absences[p.id] = b.dataset.abs;
      M.game.starters = M.game.starters.filter(id => id !== p.id);
      M.pairs = M.pairs.filter(x => x.in !== p.id);
      await saveGame(); renderMinutes();
    };
  }
  $('pmCancel').onclick = () => d.close();
  d.showModal();
}

function openGameMenu() {
  const d = $('gameMenu');
  d.querySelector('#gmAdjust').onclick = () => { d.close(); adjustClock(); };
  d.querySelector('#gmSettings').onclick = () => { d.close(); openGameSettings(); };
  d.querySelector('#gmEnd').onclick = () => { d.close(); endGameEarly(); };
  d.querySelector('#gmNew').onclick = () => { d.close(); startNewGame(); };
  d.querySelector('#gmDiscard').onclick = () => { d.close(); discardGame(); };
  d.querySelector('#gmTeam').onclick = () => { d.close(); openTeamSheet(); };
  d.querySelector('#gmClose').onclick = () => d.close();
  d.showModal();
}

/** Game format and sub alert. Format is locked once the game starts; the alert can change any time. */
function openGameSettings() {
  const d = $('gameSettings'), s = structuredClone(M.game.settings), locked = M.game.status !== 'pregame';
  const draw = () => {
    for (const b of d.querySelectorAll('[data-periods]')) b.classList.toggle('active', Number(b.dataset.periods) === s.periods);
    $('gsPeriods').textContent = s.periods;
    $('gsMinutes').textContent = s.periodMinutes;
    for (const b of d.querySelectorAll('[data-alert]')) b.classList.toggle('active', b.dataset.alert === s.subAlert.mode);
    $('gsEvery').hidden = s.subAlert.mode !== 'every';
    $('gsAlertMin').textContent = s.subAlert.minutes;
    $('gsHalfNote').textContent = s.subAlert.mode === 'half' ? `At ${formatClock(s.periodMinutes * 30)} left in each period.` : '';
    d.querySelector('.format-block').classList.toggle('locked', locked);
    $('gsLockedNote').hidden = !locked;
  };
  for (const b of d.querySelectorAll('[data-periods]')) b.onclick = () => { if (!locked) { s.periods = Number(b.dataset.periods); draw(); } };
  const step = (key, delta, min, max) => () => { if (!locked) { s[key] = Math.min(max, Math.max(min, s[key] + delta)); draw(); } };
  $('gsPeriodsDown').onclick = step('periods', -1, 1, 8);  $('gsPeriodsUp').onclick = step('periods', 1, 1, 8);
  $('gsMinDown').onclick = step('periodMinutes', -1, 1, 30); $('gsMinUp').onclick = step('periodMinutes', 1, 1, 30);
  for (const b of d.querySelectorAll('[data-alert]')) b.onclick = () => { s.subAlert.mode = b.dataset.alert; draw(); };
  $('gsAlertDown').onclick = () => { s.subAlert.minutes = Math.max(1, s.subAlert.minutes - 1); draw(); };
  $('gsAlertUp').onclick = () => { s.subAlert.minutes = Math.min(20, s.subAlert.minutes + 1); draw(); };
  $('gsCancel').onclick = () => d.close();
  $('gsSave').onclick = async () => {
    d.close();
    M.game.settings = s;
    // Remember as this team's defaults for the next game
    M.team.gameDefaults = { periods: s.periods, periodMinutes: s.periodMinutes, subAlert: s.subAlert };
    M.team = await Data.saveTeam(M.team);
    markPassedAlerts();
    await saveGame(); renderMinutes();
  };
  draw(); d.showModal();
}

loadMinutes();
