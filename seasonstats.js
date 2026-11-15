/* Penguins — SEASON STATS (stats stage S2b): totals, averages, per-10-minute rates and trends
   for the team's season, built to cope with incomplete records (the app arrived mid-season).

   The rule for every number: only count games that recorded that kind of data.
   - Points/rebounds/assists/fouls per game: games that had stats, in which she appeared.
   - Points per 10 minutes: games that had BOTH stats and minutes.
   - Minutes: games that had minutes.
   So a game kept with minutes only never drags a stat average down, and vice versa.

   "Appeared" in a game: she played minutes (if the game has minutes), or has any stat, or —
   in a stats-only game — she was available (not marked absent).

   Trends: her points game by game (a small line), and recent form — her last 3 stats games
   against her earlier ones, once she has at least 5. A team chart shows our points vs theirs.

   Sections: 1 the numbers, 2 the sheet, 3 the small charts, 4 sending */
'use strict';

/* =====================================================================
   1. THE NUMBERS
   ===================================================================== */
async function seasonStatsData() {
  const team = M.team, roster = M.roster;
  const games = (await Data.games(team.id))
    .filter(g => (g.events || []).length && (g.status === 'final' || g.id === M.game?.id))
    .sort((a, b) => (a.date || 0) - (b.date || 0));   // oldest first, for trends

  const per = new Map(roster.map(p => [p.id, { p, gp: 0, statGames: 0, min: 0, minGames: 0, pts: 0, reb: 0, oreb: 0, dreb: 0,
    ast: 0, pf: 0, stl: 0, blk: 0, tov: 0, tf: 0, bothPts: 0, bothSec: 0, ptsByGame: [] }]));
  const teamTrend = [];
  let wins = 0, losses = 0, ties = 0;

  for (const g of games) {
    const haveStats = hasStats(g), haveMin = g.events.some(isMinutesEvent);
    const st = statTotals(g), r = haveMin ? replayGame(g) : null;
    if (haveStats) {
      teamTrend.push({ date: g.date, us: st.team.pts, them: st.opp, opp: g.opponent || '' });
      if (st.opp != null) { if (st.team.pts > st.opp) wins++; else if (st.team.pts < st.opp) losses++; else ties++; }
    }
    for (const [id, s] of per) {
      const mine = st.byPlayer[id], secs = r ? (r.played[id] || 0) : 0;
      const available = !s.p.removed && !g.absences?.[id];
      const appeared = (haveMin && secs > 0) || !!mine || (haveStats && !haveMin && available && s.p.active);
      if (!appeared) continue;
      s.gp++;
      if (haveMin) { s.min += secs; s.minGames++; }
      if (haveStats) {
        s.statGames++;
        const m = mine || {};
        for (const k of ['pts', 'reb', 'oreb', 'dreb', 'ast', 'pf', 'stl', 'blk', 'tov', 'tf']) s[k] += m[k] || 0;
        s.ptsByGame.push(m.pts || 0);
        if (haveMin) { s.bothPts += m.pts || 0; s.bothSec += secs; }
      }
    }
  }
  const rows = [...per.values()].filter(s => s.gp > 0 || (!s.p.removed && s.p.active));
  return { team, games, rows, teamTrend, record: { wins, losses, ties },
    statGames: games.filter(hasStats).length, minGames: games.filter(g => g.events.some(isMinutesEvent)).length };
}

const avg = (total, n) => (n ? total / n : null);
const f1 = v => (v == null ? '–' : v.toFixed(1));
/** Recent form: last 3 stats games vs the ones before (needs 5+). Returns the change in points per game. */
function formDelta(list) {
  if (list.length < 5) return null;
  const last = list.slice(-3), before = list.slice(0, -3);
  return last.reduce((a, b) => a + b, 0) / 3 - before.reduce((a, b) => a + b, 0) / before.length;
}

/* =====================================================================
   2. THE SHEET
   ===================================================================== */
const SS = { sort: 'ppg', data: null, files: null };
const SS_COLS = [
  { key: 'gp', head: 'GP', title: 'Games played', val: s => s.gp },
  { key: 'min', head: 'MIN', title: 'Total minutes', val: s => (s.minGames ? s.min / 60 : null), show: s => (s.minGames ? formatClock(s.min, { up: false }) : '–') },
  { key: 'pts', head: 'PTS', title: 'Total points', val: s => (s.statGames ? s.pts : null) },
  { key: 'ppg', head: 'PPG', title: 'Points per game', val: s => avg(s.pts, s.statGames), show: s => f1(avg(s.pts, s.statGames)) },
  { key: 'p10', head: 'P/10', title: 'Points per 10 minutes', val: s => (s.bothSec ? s.bothPts / (s.bothSec / 600) : null), show: s => f1(s.bothSec ? s.bothPts / (s.bothSec / 600) : null) },
  { key: 'rpg', head: 'RPG', title: 'Rebounds per game', val: s => avg(s.reb, s.statGames), show: s => f1(avg(s.reb, s.statGames)) },
  { key: 'apg', head: 'APG', title: 'Assists per game', val: s => avg(s.ast, s.statGames), show: s => f1(avg(s.ast, s.statGames)) },
  { key: 'pf', head: 'PF', title: 'Total fouls', val: s => (s.statGames ? s.pf : null) },
];

async function openSeasonStats() {
  const d = SS.data = await seasonStatsData();
  const rec = d.record, recText = rec.wins + rec.losses + rec.ties ? `${rec.wins}–${rec.losses}${rec.ties ? '–' + rec.ties : ''}` : '';
  document.getElementById('ssTitle').textContent = `${d.team.name} · ${d.team.season}`;
  document.getElementById('ssSummary').innerHTML = !d.games.length ? 'No games recorded yet.'
    : `<b>${d.games.length}</b> game${d.games.length === 1 ? '' : 's'} · <b>${d.statGames}</b> with stats · <b>${d.minGames}</b> with minutes${recText ? ` · record <b>${recText}</b>` : ''}`;
  document.getElementById('ssTeamChart').innerHTML = d.teamTrend.length >= 2 ? teamChart(d.teamTrend) : '';
  document.getElementById('ssTeamCard').hidden = d.teamTrend.length < 2;
  renderSeasonTable();
  document.getElementById('seasonStatsSheet').hidden = false;
  for (const b of ['ssPng', 'ssPdf']) document.getElementById(b).disabled = true;
  SS.files = await makeBoxFiles(seasonDrawData(d));
  for (const b of ['ssPng', 'ssPdf']) document.getElementById(b).disabled = false;
}
window.openSeasonStats = openSeasonStats;

function renderSeasonTable() {
  const d = SS.data, col = SS_COLS.find(c => c.key === SS.sort) || SS_COLS[3];
  const rows = [...d.rows].sort((a, b) => (col.val(b) ?? -1) - (col.val(a) ?? -1) || a.p.name.localeCompare(b.p.name));
  document.getElementById('ssTable').innerHTML =
    `<thead><tr><th class="bn">#</th><th class="bp">Player</th><th>Trend</th>${SS_COLS.map(c => `<th data-sort="${c.key}" class="${c.key === SS.sort ? 'sorted' : ''}" title="${c.title}">${c.head}</th>`).join('')}</tr></thead>
     <tbody>${rows.map(s => {
       const delta = formDelta(s.ptsByGame);
       const form = delta == null ? '' : `<span class="form ${delta > 0.25 ? 'up' : delta < -0.25 ? 'down' : 'flat'}" title="Last 3 games vs earlier">${delta > 0.25 ? '▲' : delta < -0.25 ? '▼' : '•'} ${Math.abs(delta).toFixed(1)}</span>`;
       return `<tr><td class="bn">${esc(s.p.number || '–')}</td><td class="bp">${esc(s.p.name)}</td>
         <td class="trend">${s.ptsByGame.length >= 2 ? sparkline(s.ptsByGame) : '<span class="form flat">–</span>'}${form}</td>
         ${SS_COLS.map(c => `<td>${c.show ? c.show(s) : (c.val(s) ?? '–')}</td>`).join('')}</tr>`;
     }).join('')}</tbody>`;
  document.querySelectorAll('#ssTable th[data-sort]').forEach(th => th.onclick = () => { SS.sort = th.dataset.sort; renderSeasonTable(); });
}

/* =====================================================================
   3. SMALL CHARTS (inline SVG)
   ===================================================================== */
function sparkline(vals) {
  const w = 64, h = 24, max = Math.max(1, ...vals), n = vals.length;
  const pts = vals.map((v, i) => `${(i / (n - 1)) * (w - 6) + 3},${h - 3 - (v / max) * (h - 6)}`).join(' ');
  const [lx, ly] = pts.split(' ').pop().split(',');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-label="Points by game">
    <polyline points="${pts}" fill="none" stroke="#4e2a84" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lx}" cy="${ly}" r="3" fill="#ff2e93"/></svg>`;
}
function teamChart(trend) {
  const w = 640, h = 180, padL = 30, padB = 26, n = trend.length;
  const max = Math.max(4, ...trend.map(t => Math.max(t.us, t.them ?? 0)));
  const x = i => padL + (n === 1 ? 0 : (i / (n - 1)) * (w - padL - 16));
  const y = v => 10 + (1 - v / max) * (h - padB - 10);
  const line = (key, color) => {
    const pts = trend.map((t, i) => (t[key] == null ? null : `${x(i)},${y(t[key])}`)).filter(Boolean);
    return pts.length >= 2 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>` +
      trend.map((t, i) => (t[key] == null ? '' : `<circle cx="${x(i)}" cy="${y(t[key])}" r="4" fill="${color}"/>`)).join('') : '';
  };
  const grid = [0, .5, 1].map(f => `<line x1="${padL}" x2="${w - 8}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="rgba(43,21,80,.12)"/><text x="${padL - 6}" y="${y(max * f) + 4}" text-anchor="end">${Math.round(max * f)}</text>`).join('');
  const labels = trend.map((t, i) => `<text x="${x(i)}" y="${h - 6}" text-anchor="middle">${new Date(t.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</text>`).join('');
  return `<svg class="team-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Points for and against, game by game">
    ${grid}${line('them', '#2b1550')}${line('us', '#ff2e93')}${labels}</svg>
    <p class="chart-key"><i class="us"></i> Us <i class="them"></i> Them</p>`;
}

/* =====================================================================
   4. SENDING — the same picture/PDF maker as the box score
   ===================================================================== */
function seasonDrawData(d) {
  const col = SS_COLS.find(c => c.key === SS.sort) || SS_COLS[3];
  const rows = [...d.rows].sort((a, b) => (col.val(b) ?? -1) - (col.val(a) ?? -1));
  const rec = d.record, recText = rec.wins + rec.losses + rec.ties ? `${rec.wins}–${rec.losses}${rec.ties ? '–' + rec.ties : ''}` : null;
  return {
    cols: SS_COLS.map(c => ({ key: c.key === 'pts' ? 'pts' : c.key, head: c.head })),
    rows: rows.map(s => ({ num: s.p.number || '–', name: s.p.name, cells: SS_COLS.map(c => String(c.show ? c.show(s) : (c.val(s) ?? '–'))) })),
    team: SS_COLS.map(c => (c.key === 'pts' ? String(d.rows.reduce((a, s) => a + s.pts, 0)) : c.key === 'pf' ? String(d.rows.reduce((a, s) => a + s.pf, 0)) : '')),
    opponent: '', date: `Season stats · ${d.team.season} · ${d.games.length} game${d.games.length === 1 ? '' : 's'}`,
    big: recText, bigLabel: 'RECORD',
    legend: 'GP games · PPG/RPG/APG per game (games with stats) · P/10 points per 10 minutes (games with stats and minutes)',
    fileName: `Penguins season stats ${new Date().toISOString().slice(0, 10)}`,
  };
}
document.getElementById('ssPng').onclick = () => sendBoxFile(SS.files?.png);
document.getElementById('ssPdf').onclick = () => sendBoxFile(SS.files?.pdf);
document.getElementById('btnCloseSeasonStats').onclick = () => { document.getElementById('seasonStatsSheet').hidden = true; };
