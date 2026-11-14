/* Penguins — the Stats tab (stage S1): record box-score stats during a game.

   How it works
   - Player first, then stat: tap a girl, then tap "+2", "D-Reb", "Foul"…
   - Stats are entries in the same game log as Minutes: { type: 'stat', period, playerId, data: { stat } }.
     Minutes ignores them (replayGame skips unknown types) and has its own Undo; Stats only looks at
     its own entries. A game can have minutes, stats, both, or neither — nothing depends on the other.
   - No clock on the stats phone: each stat is tagged with the quarter picked at the top
     (or, if this phone is also running the game clock, that game's quarter).
   - Which buttons appear is set per team in Stats settings (the ••• menu).

   Sections
     1. The stat catalog and the team's choices
     2. Totals (used here; the reports in stage S2 will use them too)
     3. Recording and Undo
     4. The screen
     5. Stats settings sheet */
'use strict';

/* =====================================================================
   1. STAT CATALOG — order here = order on the pad. Add new kinds by adding a line;
      games recorded before simply have none of them.
   ===================================================================== */
const STAT_TYPES = [
  { key: 'pts2', label: '2 points', pad: '+2', group: 'score', pts: 2 },
  { key: 'pts3', label: '3 points', pad: '+3', group: 'score', pts: 3 },
  { key: 'pts1', label: 'Free throw', pad: '+1 FT', group: 'score', pts: 1 },
  { key: 'miss2', label: 'Missed 2', pad: 'Miss 2', group: 'miss' },
  { key: 'miss3', label: 'Missed 3', pad: 'Miss 3', group: 'miss' },
  { key: 'miss1', label: 'Missed free throw', pad: 'Miss FT', group: 'miss' },
  { key: 'oreb', label: 'Offensive rebound', pad: 'O-Reb', group: 'other' },
  { key: 'dreb', label: 'Defensive rebound', pad: 'D-Reb', group: 'other' },
  { key: 'ast', label: 'Assist', pad: 'Assist', group: 'other' },
  { key: 'stl', label: 'Steal', pad: 'Steal', group: 'other' },
  { key: 'blk', label: 'Block', pad: 'Block', group: 'other' },
  { key: 'tov', label: 'Turnover', pad: 'Turnover', group: 'other' },
  { key: 'pf', label: 'Personal foul', pad: 'Foul', group: 'other' },
  { key: 'tf', label: 'Technical foul', pad: 'Tech', group: 'other' },
];
const STAT_BY_KEY = Object.fromEntries(STAT_TYPES.map(t => [t.key, t]));
const OPP_PAD = [{ key: 'opp2', pad: 'Them +2', pts: 2 }, { key: 'opp3', pad: '+3', pts: 3 }, { key: 'opp1', pad: '+1', pts: 1 }];
// Owner's starting set: points, both rebounds, assists, fouls. Misses and live opponent scoring start off.
// courtRow: 'auto' = show the five in the pad when this phone runs the game clock, all players otherwise;
//           'always' = always show the five (a stats-only keeper sets them with Change); 'off' = all players.
const STAT_DEFAULTS = { shown: ['pts2', 'pts3', 'pts1', 'oreb', 'dreb', 'ast', 'pf'], misses: false, opponentLive: false, courtRow: 'auto' };

function statSettings(team = M.team) { return { ...STAT_DEFAULTS, ...(team?.stats || {}) }; }
/** The buttons on the pad, in catalog order. Misses come as a set, only when "Track misses" is on. */
function padStats(team = M.team) {
  const s = statSettings(team);
  return STAT_TYPES.filter(t => (t.group === 'miss' ? s.misses : s.shown.includes(t.key)));
}

/* =====================================================================
   2. TOTALS — from the log; nothing stored. Players with no entries simply aren't in byPlayer.
   ===================================================================== */
function statTotals(game) {
  const blank = () => ({ pts: 0, reb: 0 });
  const byPlayer = {}, team = blank();
  let oppLive = 0;
  for (const e of game.events || []) {
    if (e.type !== 'stat') continue;
    const k = e.data?.stat;
    if (k?.startsWith('opp')) { oppLive += +k.slice(3) || 0; continue; }
    const t = STAT_BY_KEY[k]; if (!t || !e.playerId) continue;
    for (const s of [byPlayer[e.playerId] ||= blank(), team]) {
      s[k] = (s[k] || 0) + 1;
      if (t.pts) s.pts += t.pts;
      if (k === 'oreb' || k === 'dreb') s.reb += 1;
    }
  }
  // Opponent: a typed final score wins; otherwise whatever was tapped live (or nothing)
  const opp = game.oppScore != null && game.oppScore !== '' ? +game.oppScore : (oppLive || null);
  return { byPlayer, team, opp };
}
const hasStats = game => (game.events || []).some(e => e.type === 'stat');

/* =====================================================================
   3. RECORDING AND UNDO
   ===================================================================== */
const S = { sel: null, editCourt: false };   // the player tapped (waiting for a stat); setting the five?

/** Who's on the floor, for the top row. If this phone is also running the game clock, Minutes knows;
 *  otherwise the stats keeper sets the five with "Change" (saved with the game as statsCourt). */
function statsCourtLinked(g = M.game) { return g.status !== 'pregame' && g.events.some(isMinutesEvent); }
function statsCourt(g = M.game) {
  const ok = id => M.roster.some(p => p.id === id && !p.removed && p.active && !g.absences?.[id]);
  return (statsCourtLinked(g) ? replayGame(g).onCourt : (g.statsCourt || [])).filter(ok).slice(0, g.settings.onCourt);
}

/** Quarter for new entries. If this phone is running the game clock, the clock decides — Stats and
 *  Minutes always agree on the time and on who's on court. Otherwise, the quarter picked here. */
function statPeriod(game = M.game) {
  if (statsCourtLinked(game)) return replayGame(game).period;
  return game.statPeriod || 1;
}

async function recordStat(key) {
  const g = M.game, opp = key.startsWith('opp');
  if (!opp && !S.sel) { toast('Tap a player first'); return; }
  const p = opp ? null : playerById(S.sel);
  g.events.push({ id: Data.newId(), action: Data.newId(), at: GameClock.now(), type: 'stat',
    period: statPeriod(g), clock: statsCourtLinked(g) ? replayGame(g).clock : null,   // game-clock time when there is one
    playerId: opp ? null : S.sel, data: { stat: key } });
  S.sel = null;
  await saveGame();
  renderStats();
  toast(opp ? `Them +${key.slice(3)}` : `${p.name} · ${STAT_BY_KEY[key].label}`);
}

async function undoStat() {
  const ev = M.game.events;
  let i = ev.length - 1; while (i >= 0 && ev[i].type !== 'stat') i--;
  if (i < 0) return;
  const [e] = ev.splice(i, 1);
  await saveGame(); renderStats();
  const k = e.data?.stat;
  toast('Undone: ' + (k?.startsWith('opp') ? `them +${k.slice(3)}` : `${playerById(e.playerId)?.name || '?'} · ${STAT_BY_KEY[k]?.label || k}`));
}

/* =====================================================================
   4. THE SCREEN
   Game (quarter, score) → Team totals → Players (tap one) ; the stat pad sits by the thumb.
   ===================================================================== */
/** "6 pts · 3 reb · 1 ast" — only what she has, in pad order. */
function statLine(s, shown) {
  if (!s) return '';
  const parts = [];
  if (s.pts) parts.push(`${s.pts} pts`);
  if (s.reb && (shown.includes('oreb') || shown.includes('dreb'))) parts.push(`${s.reb} reb`);
  for (const k of ['ast', 'stl', 'blk', 'tov', 'pf', 'tf']) if (s[k] && shown.includes(k)) parts.push(`${s[k]} ${{ ast: 'ast', stl: 'stl', blk: 'blk', tov: 'to', pf: 'f', tf: 'tech' }[k]}`);
  return parts.join(' · ');
}

function renderStats() {
  const body = document.getElementById('sBody');
  if (!body || !M.game || !M.team) return;
  const g = M.game, set = statSettings(), pad = padStats(), shown = pad.map(t => t.key);
  const tot = statTotals(g), periods = g.settings.periods, q = statPeriod(g), linked = statsCourtLinked(g);
  const roster = M.roster.filter(p => !p.removed && p.active && !g.absences?.[p.id]);
  if (S.sel && !roster.some(p => p.id === S.sel)) S.sel = null;

  // Team totals beside the score: rebounds (with O/D), then each other stat on the pad
  const cells = [];
  if (shown.includes('oreb') || shown.includes('dreb'))
    cells.push(`<div class="tt"><b>${tot.team.reb}</b><span>Reb</span><i>${tot.team.oreb || 0}O · ${tot.team.dreb || 0}D</i></div>`);
  for (const k of ['ast', 'stl', 'blk', 'tov', 'pf', 'tf']) if (shown.includes(k))
    cells.push(`<div class="tt"><b>${tot.team[k] || 0}</b><span>${{ ast: 'Ast', stl: 'Stl', blk: 'Blk', tov: 'TO', pf: 'Fouls', tf: 'Tech' }[k]}</span></div>`);

  // The five on court sit in the pad, right above the stat buttons (owner: short reach from girl to stat)
  const showRow = set.courtRow === 'always' || (set.courtRow === 'auto' && linked);
  if (!showRow) S.editCourt = false;
  const court = showRow ? statsCourt(g) : [], need = g.settings.onCourt;
  if (linked) S.editCourt = false;
  const bench = roster.filter(p => !court.includes(p.id));
  const when = new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  body.innerHTML = `
    <div class="stats">
      <section class="sec-game">
        <h2 class="card-title">Game <span>${g.opponent ? 'vs ' + esc(g.opponent) + ' · ' : ''}${when}</span>
          <button class="mini-btn" id="sMenu" aria-label="Stats menu">•••</button></h2>
        <div class="card game-card">
          <div class="gc-top">
            <div class="q-sel ${linked ? 'linked' : ''}" role="group" aria-label="Quarter">
              ${Array.from({ length: periods }, (_, i) => `<button class="${q === i + 1 ? 'on' : ''}" data-q="${i + 1}" ${linked ? 'disabled' : ''}>${periodLabel(g, i + 1)}</button>`).join('')}
            </div>
            <div class="score"><span class="us"><b>${tot.team.pts}</b><i>Us</i></span><span class="dash">–</span>
              <label class="them"><input id="sOpp" inputmode="numeric" maxlength="3" placeholder="–" value="${g.oppScore ?? (tot.opp ?? '')}"><i>Them</i></label></div>
          </div>
          ${cells.length ? `<div class="team-totals">${cells.join('')}</div>` : ''}
        </div>
      </section>
      <section class="sec-players">
        <h2 class="card-title">${showRow ? 'Bench' : 'Players'}</h2>
        ${roster.length ? '<ul class="sgrid" id="sGrid"></ul>' : '<div class="card empty-card">No players yet — add them in Team.</div>'}
      </section>
    </div>`;

  const tile = (p, cls) => {
    const li = document.createElement('li');
    li.className = cls + (S.sel === p.id && !S.editCourt ? ' sel' : '') + (S.editCourt && court.includes(p.id) ? ' oncourt' : '');
    li.innerHTML = `<span class="pnum">${esc(p.number || '–')}</span><span class="sname">${esc(p.name)}</span>
      <span class="sline">${statLine(tot.byPlayer[p.id], shown) || '&nbsp;'}</span>`;
    li.onclick = async () => {
      if (S.editCourt) {   // setting the five: tap toggles on court / bench
        const cur = statsCourt(g), has = cur.includes(p.id);
        if (!has && cur.length >= need) { toast(`Already ${need} on court — tap one to take her off`); return; }
        g.statsCourt = has ? cur.filter(x => x !== p.id) : [...cur, p.id];
        await saveGame(); renderStats(); return;
      }
      S.sel = S.sel === p.id ? null : p.id; renderStats();
    };
    return li;
  };
  const grid = document.getElementById('sGrid');
  for (const p of bench) grid?.appendChild(tile(p, 'stile'));
  document.querySelectorAll('.q-sel button').forEach(b => b.onclick = async () => { g.statPeriod = +b.dataset.q; await saveGame(); renderStats(); });
  const opp = document.getElementById('sOpp');
  opp.onchange = async () => { const v = opp.value.trim(); g.oppScore = v === '' ? null : Math.max(0, parseInt(v, 10) || 0); await saveGame(); renderStats(); };
  document.getElementById('sMenu').onclick = openStatsMenu;

  // The pad
  const sel = !S.editCourt && S.sel && playerById(S.sel);
  const hasUndo = g.events.some(e => e.type === 'stat');
  document.getElementById('statPad').innerHTML = `
    ${showRow ? `<div class="pad-court">
      <div class="pc-head"><span>On court${linked ? ' <i>from the game clock</i>' : ''}</span>
        ${linked ? '' : `<button class="mini-btn" id="sCourtEdit">${S.editCourt ? 'Done' : 'Change'}</button>`}</div>
      <ul class="crow ${S.editCourt ? 'editing' : ''}" id="sCourt"></ul></div>` : ''}
    <div class="pad-head"><span class="pad-who">${S.editCourt ? 'Setting who’s on court' : sel ? `<b>${esc(sel.number ? '#' + sel.number + ' ' : '')}${esc(sel.name)}</b>` : 'Tap a player'}</span>
      <button class="undo-btn" id="sUndo" ${hasUndo ? '' : 'disabled'} aria-label="Undo last stat">
        <svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>Undo</button></div>
    ${['score', 'miss', 'other'].map(gr => pad.filter(t => t.group === gr)).filter(row => row.length).map(row =>   // a row per kind: points, misses, everything else
      `<div class="pad-grid" style="--cols:${Math.min(4, row.length)}">${row.map(t => `<button class="pad-btn ${t.group}" data-stat="${t.key}" ${sel ? '' : 'disabled'}>${t.pad}</button>`).join('')}</div>`).join('')}
    ${set.opponentLive ? `<div class="pad-grid opp">${OPP_PAD.map(o => `<button class="pad-btn opp" data-stat="${o.key}">${o.pad}</button>`).join('')}</div>` : ''}`;
  if (showRow) {
    const crow = document.getElementById('sCourt');
    for (const id of court) crow.appendChild(tile(playerById(id), 'stile ctile'));
    for (let k = court.length; k < need; k++) {   // empty places in the five
      const li = document.createElement('li'); li.className = 'ctile empty';
      li.textContent = S.editCourt ? 'Tap a bench player' : 'Tap to set';
      if (!S.editCourt && !linked) li.onclick = () => { S.editCourt = true; S.sel = null; renderStats(); };
      crow.appendChild(li);
    }
    document.getElementById('sCourtEdit')?.addEventListener('click', () => { S.editCourt = !S.editCourt; S.sel = null; renderStats(); });
  }
  document.querySelectorAll('#statPad .pad-btn').forEach(b => b.onclick = () => recordStat(b.dataset.stat));
  document.getElementById('sUndo').onclick = undoStat;
  document.documentElement.style.setProperty('--pad-h', document.getElementById('statPad').offsetHeight + 'px');
}
window.renderStats = renderStats;

function openStatsMenu() {
  const d = document.getElementById('statsMenu');
  d.querySelector('#smOpponent').textContent = M.game.opponent ? `Opponent: ${M.game.opponent}` : 'Opponent';
  d.querySelector('#smOpponent').onclick = async () => {
    d.close();
    const name = await ask({ title: 'Opponent', input: M.game.opponent || '', placeholder: 'e.g. Eagles', okText: 'Save' });
    if (name == null) return;
    M.game.opponent = String(name).trim(); await saveGame(); renderStats(); renderMinutes();
  };
  d.querySelector('#smSettings').onclick = () => { d.close(); openStatSheet(); };
  d.querySelector('#smNew').onclick = async () => { d.close(); S.sel = null; await startNewGame(); };
  d.querySelector('#smClose').onclick = () => d.close();
  d.showModal();
}

/* =====================================================================
   5. STATS SETTINGS — which buttons appear (saved with the team)
   ===================================================================== */
function openStatSheet() {
  const set = statSettings();
  const row = (id, label, on, note = '') => `<button class="check-row" data-k="${id}" aria-pressed="${on}">
      <span class="check ${on ? 'on' : ''}">${on ? '✓' : ''}</span><span class="cl">${label}${note ? `<i>${note}</i>` : ''}</span></button>`;
  document.getElementById('statSheetBody').innerHTML = `
    <h2 class="card-title">Buttons on the stat pad</h2>
    <section class="card check-card">
      ${STAT_TYPES.filter(t => t.group !== 'miss').map(t => row(t.key, t.label, set.shown.includes(t.key))).join('')}
    </section>
    <h2 class="card-title">Options</h2>
    <section class="card check-card">
      ${row('misses', 'Track misses', set.misses, 'Adds Miss 2, Miss 3 and Miss FT')}
      ${row('opponentLive', 'Score the other team live', set.opponentLive, 'Adds Them +2 / +3 / +1. Otherwise type their final score.')}
    </section>
    <h2 class="card-title">The five on court, in the pad</h2>
    <section class="card check-card">
      ${row('courtRow:auto', 'Auto', set.courtRow === 'auto', 'When this phone also runs the game clock. Otherwise, all players.')}
      ${row('courtRow:always', 'Always', set.courtRow === 'always', 'On a stats-only phone, set them with Change.')}
      ${row('courtRow:off', 'Off', set.courtRow === 'off', 'All players, one list.')}
    </section>
    <p class="note">These apply to every game for this team. Stats already recorded are kept either way.</p>`;
  document.querySelectorAll('#statSheetBody .check-row').forEach(b => b.onclick = async () => {
    const s = statSettings(), k = b.dataset.k;
    if (k === 'misses' || k === 'opponentLive') s[k] = !s[k];
    else if (k.startsWith('courtRow:')) s.courtRow = k.split(':')[1];
    else s.shown = s.shown.includes(k) ? s.shown.filter(x => x !== k) : [...s.shown, k];
    M.team.stats = s; M.team = await Data.saveTeam(M.team);
    openStatSheet(); renderStats();
  });
  document.getElementById('statSheet').hidden = false;
}
document.getElementById('btnCloseStatSheet').onclick = () => { document.getElementById('statSheet').hidden = true; };

// Stats on screen while this phone's clock runs: redraw when the quarter or the five change
// (cheap check, twice a second; nothing happens on a stats-only phone).
let statsSeen = '';
setInterval(() => {
  if (App.tab !== 'stats' || !M.game || !statsCourtLinked()) return;
  const r = replayGame(M.game), sig = r.period + '|' + r.onCourt.join(',');
  if (sig !== statsSeen) { statsSeen = sig; renderStats(); }
}, 500);
