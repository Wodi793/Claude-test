/* Penguins — readouts (Stage 5): the per-player game timeline and the season view.
   Everything is calculated from the games' event logs (replayGame / minimumStatus in
   gamelog.js) — nothing here is stored.

   Sections
     1. Game timeline (used on the live screen, the final screen and past games)
     2. Season view (totals, games played, average, fair share; list of past games)
     3. A past game (timeline + minutes; delete) */
'use strict';

/* =====================================================================
   1. GAME TIMELINE
   One row per player: a bar across each period showing when she was on court,
   then her total. A thin mark shows mid-Q3 when the league minimum is on.
   ===================================================================== */
function renderTimeline(container, game, roster, r = replayGame(game)) {
  const len = periodSeconds(game), periods = game.settings.periods;
  const byId = new Map(roster.map(p => [p.id, p]));
  // Everyone who played, plus anyone available who didn't (an empty row is worth seeing)
  const ids = new Set(Object.keys(r.played));
  for (const p of roster) if (!p.removed && p.active && !game.absences?.[p.id]) ids.add(p.id);
  const rows = [...ids].map(id => byId.get(id)).filter(Boolean)
    .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }) || a.name.localeCompare(b.name));

  const pct = (period, t) => ((period - 1) * len + t) / (len * periods) * 100;
  const nowPct = game.status === 'live' ? pct(r.period, len - r.clock) : null;
  const deadlinePct = game.settings.minRule ? MIN_RULE.deadlineShare * 100 : null;

  const head = Array.from({ length: periods }, (_, i) => `<span>${periodLabel(game, i + 1)}</span>`).join('');
  let html = `<div class="tl-head"><span class="tl-name"></span><span class="tl-periods">${head}</span><span class="tl-total">Total</span></div>`;
  for (const p of rows) {
    const bars = r.segments.filter(s => s.playerId === p.id).map(s => {
      const left = pct(s.period, s.from), width = Math.max(0.4, pct(s.period, s.to) - left);
      return `<i class="${s.live ? 'live' : ''}" style="left:${left}%;width:${width}%"></i>`;
    }).join('');
    html += `<div class="tl-row">
      <span class="tl-name"><b>${esc(p.number || '–')}</b> ${esc(p.name)}</span>
      <span class="tl-track">${bars}</span>
      <span class="tl-total">${formatClock(r.played[p.id] || 0, { up: false })}</span></div>`;
  }
  // Period dividers, the mid-Q3 mark and "now", drawn over all rows
  const lines = Array.from({ length: periods - 1 }, (_, i) => `<i class="div" style="left:${(i + 1) / periods * 100}%"></i>`).join('')
    + (deadlinePct != null ? `<i class="deadline" style="left:${deadlinePct}%" title="Mid-Q3"></i>` : '')
    + (nowPct != null ? `<i class="now" style="left:${nowPct}%"></i>` : '');
  container.innerHTML = `<div class="timeline">${html}<div class="tl-overlay"><span class="tl-name"></span><span class="tl-lines">${lines}</span><span class="tl-total"></span></div></div>`
    + (deadlinePct != null ? '<p class="tl-key"><i class="deadline"></i> mid-Q3 (league minimum deadline)</p>' : '');
}

/* =====================================================================
   2. SEASON VIEW
   For the current team and season, from finished games only.
   Fair share = her minutes ÷ what she'd have played with exactly equal time in the
   games she was available for (game length × players on court ÷ players available).
   100% = even. The list puts whoever is furthest behind first.
   ===================================================================== */
async function openSeason() {
  const team = await Data.currentTeam();
  const roster = await Data.players(team.id, { includeRemoved: true });
  const games = (await Data.games(team.id)).filter(g => g.status === 'final');
  const stat = new Map(roster.map(p => [p.id, { p, total: 0, games: 0, fair: 0, short: 0 }]));

  for (const g of games) {
    const r = replayGame(g), len = periodSeconds(g);
    // Available that game = everyone who played, plus anyone on the active roster not marked away
    const availableIds = [...new Set([...Object.keys(r.played),
      ...roster.filter(p => !p.removed && p.active && !g.absences?.[p.id]).map(p => p.id)])];
    const equal = len * g.settings.periods * g.settings.onCourt / Math.max(1, availableIds.length);
    const ms = g.settings.minRule ? minimumStatus(g, r, availableIds) : null;
    for (const id of availableIds) {
      const s = stat.get(id); if (!s) continue;
      const t = r.played[id] || 0;
      s.total += t; s.fair += equal;
      if (t > 0) s.games += 1;
      const st = ms?.players[id];
      if (st && st.owed > 0 && st.state !== 'waived') s.short += 1;
    }
  }
  const rows = [...stat.values()].filter(s => s.fair > 0 || !s.p.removed)
    .sort((a, b) => (a.fair ? a.total / a.fair : 9) - (b.fair ? b.total / b.fair : 9));

  $('seasonTitle').textContent = `${team.name} · ${team.season}`;
  $('seasonSummary').textContent = games.length
    ? `${games.length} finished game${games.length === 1 ? '' : 's'}. Fair share: 100% = exactly equal time in the games she was available for. Furthest behind first.`
    : 'No finished games yet. Totals appear here after your first game.';
  $('seasonTable').innerHTML = !games.length ? '' : `
    <div class="st-row st-head"><span class="st-name">Player</span><span>Total</span><span>Games</span><span>Avg</span><span>Fair</span></div>
    ${rows.map(s => {
      const fair = s.fair ? Math.round(s.total / s.fair * 100) : null;
      return `<div class="st-row ${fair != null && fair < 90 ? 'behind' : ''}">
        <span class="st-name"><b>${esc(s.p.number || '–')}</b> ${esc(s.p.name)}${s.short ? ` <em title="Games short of the league minimum">${s.short}× short</em>` : ''}</span>
        <span>${formatClock(s.total, { up: false })}</span>
        <span>${s.games}</span>
        <span>${s.games ? formatClock(s.total / s.games, { up: false }) : '–'}</span>
        <span class="st-fair">${fair == null ? '–' : fair + '%'}</span></div>`;
    }).join('')}`;

  const list = $('seasonGames'); list.innerHTML = '';
  for (const g of games) {
    const li = document.createElement('li');
    li.innerHTML = `<button class="team-row"><span class="tn"></span><span class="ts"></span></button>`;
    li.querySelector('.tn').textContent = new Date(g.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    li.querySelector('.ts').textContent = (g.opponent ? `vs ${g.opponent} · ` : '') + `${g.settings.periods} × ${g.settings.periodMinutes} min`;
    li.querySelector('button').onclick = () => openPastGame(g.id, roster);
    list.appendChild(li);
  }
  $('seasonSheet').hidden = false;
}

/* =====================================================================
   3. A PAST GAME
   ===================================================================== */
async function openPastGame(id, roster) {
  const g = await DB.get('games', id);
  if (!g) return;
  $('pastTitle').textContent = new Date(g.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    + (g.opponent ? ` · vs ${g.opponent}` : '');
  renderTimeline($('pastTimeline'), g, roster);
  $('pastDelete').onclick = async () => {
    const ok = await ask({ title: 'Delete this game?', message: 'Its minutes leave the season totals. This can’t be undone.', okText: 'Delete', danger: true });
    if (!ok) return;
    await DB.del('games', id);
    $('pastSheet').hidden = true; openSeason();
  };
  $('pastSheet').hidden = false;
}

$('btnSeason').onclick = openSeason;
$('btnCloseSeason').onclick = () => { $('seasonSheet').hidden = true; };
$('btnClosePast').onclick = () => { $('pastSheet').hidden = true; };
