/* Penguins — the BOX SCORE (stats stage S2a): one game's numbers on screen, and as a
   picture or a PDF to text, AirDrop or email from the share sheet.

   Works with whatever the game has: minutes only, stats only, both. Missing data shows
   as "–", never an error. The picture and the PDF are drawn here (canvas → PNG; the
   same drawing as a JPEG wrapped in a one-page PDF), so no add-on software is needed.

   Sections
     1. The numbers
     2. The sheet on screen
     3. Drawing the picture
     4. The PDF wrapper
     5. Sending */
'use strict';

/* =====================================================================
   1. THE NUMBERS
   ===================================================================== */
function boxScoreData(game, roster = M.roster) {
  const st = statTotals(game), haveStats = hasStats(game);
  const haveMin = (game.events || []).some(isMinutesEvent);
  const r = haveMin ? replayGame(game) : null;
  const used = new Set([...Object.keys(st.byPlayer), ...(r ? Object.keys(r.played).filter(id => r.played[id] > 0) : [])]);
  const players = roster.filter(p => used.has(p.id) || (!p.removed && p.active && !game.absences?.[p.id]))
    .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }) || a.name.localeCompare(b.name));

  // Columns: minutes (if any), the core stats, then extras only if someone has one
  const any = k => Object.values(st.byPlayer).some(s => s[k]);
  const shooting = ['miss1', 'miss2', 'miss3'].some(any);
  const cols = [];
  if (haveMin) cols.push({ key: 'min', head: 'MIN' });
  cols.push({ key: 'pts', head: 'PTS' }, { key: 'reb', head: 'REB' }, { key: 'oreb', head: 'OR' }, { key: 'dreb', head: 'DR' },
    { key: 'ast', head: 'AST' });
  for (const [k, h] of [['stl', 'STL'], ['blk', 'BLK'], ['tov', 'TO']]) if (any(k)) cols.push({ key: k, head: h });
  cols.push({ key: 'pf', head: 'PF' });
  if (any('tf')) cols.push({ key: 'tf', head: 'TECH' });
  if (shooting) cols.push({ key: 'fg', head: 'FG' }, { key: 'fg3', head: '3PT' }, { key: 'ft', head: 'FT' });

  const cell = (s, key, min) => {
    if (key === 'min') return min == null ? '–' : formatClock(min, { up: false });
    if (!haveStats) return '–';
    s = s || {};
    if (key === 'fg') return `${(s.pts2 || 0) + (s.pts3 || 0)}-${(s.pts2 || 0) + (s.pts3 || 0) + (s.miss2 || 0) + (s.miss3 || 0)}`;
    if (key === 'fg3') return `${s.pts3 || 0}-${(s.pts3 || 0) + (s.miss3 || 0)}`;
    if (key === 'ft') return `${s.pts1 || 0}-${(s.pts1 || 0) + (s.miss1 || 0)}`;
    return String(s[key] || 0);
  };
  const rows = players.map(p => ({ num: p.number || '–', name: p.name,
    cells: cols.map(c => cell(st.byPlayer[p.id], c.key, r ? (r.played[p.id] || 0) : null)) }));
  const team = cols.map(c => (c.key === 'min' ? '' : cell(st.team, c.key, null)));

  const date = new Date(game.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const us = haveStats ? st.team.pts : null, them = st.opp;
  return { cols, rows, team, date, opponent: game.opponent || '', us, them, haveStats, haveMin,
    teamName: `${SCHOOL_NAME} ${M.team?.name || 'Penguins'}`, season: M.team?.season || '' };
}

/* =====================================================================
   2. THE SHEET ON SCREEN
   ===================================================================== */
const BX = { files: null, data: null };

async function openBoxScore(game = M.game) {
  const d = BX.data = boxScoreData(game);
  document.getElementById('boxTitle').textContent = (d.opponent ? `vs ${d.opponent} · ` : '') + d.date;
  document.getElementById('boxScoreLine').innerHTML = d.us == null && d.them == null ? 'No score recorded'
    : `<b>${esc(M.team?.name || 'Us')} ${d.us ?? '–'}</b> <span>–</span> <b>${d.them ?? '–'}</b> ${esc(d.opponent || 'Them')}`;
  document.getElementById('boxNote').textContent = !d.haveStats && !d.haveMin ? 'Nothing recorded for this game yet.'
    : !d.haveStats ? 'Minutes only — no stats were recorded for this game.' : !d.haveMin ? 'Stats only — no minutes were recorded for this game.' : '';
  document.getElementById('boxTable').innerHTML =
    `<thead><tr><th class="bn">#</th><th class="bp">Player</th>${d.cols.map(c => `<th>${c.head}</th>`).join('')}</tr></thead>
     <tbody>${d.rows.map(r => `<tr><td class="bn">${esc(r.num)}</td><td class="bp">${esc(r.name)}</td>${r.cells.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>
     <tfoot><tr><td class="bn"></td><td class="bp">Team</td>${d.team.map(v => `<td>${v}</td>`).join('')}</tr></tfoot>`;
  document.getElementById('boxSheet').hidden = false;
  // Make the picture and the PDF now, so the Send buttons can open the share sheet instantly
  BX.files = null;
  for (const b of ['boxPng', 'boxPdf']) document.getElementById(b).disabled = true;
  BX.files = await makeBoxFiles(d);
  for (const b of ['boxPng', 'boxPdf']) document.getElementById(b).disabled = false;
}
window.openBoxScore = openBoxScore;

/* =====================================================================
   3. DRAWING THE PICTURE (1200 px wide; height fits the roster)
   ===================================================================== */
function drawBoxScore(d) {
  const W = 1200, pad = 48, rowH = 54, headH = 230, tableTop = headH + 70;
  const H = tableTop + rowH * (d.rows.length + 1) + 60 + 90;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), font = (w, s) => `${w} ${s}px -apple-system, system-ui, "Helvetica Neue", Arial, sans-serif`;
  const COURT = '#4e2a84', BORDER = '#2b1550', INK = '#14091f', PINK = '#ff2e93';
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  // Header band, lettered like the court
  x.fillStyle = COURT; x.fillRect(0, 0, W, headH);
  x.fillStyle = BORDER; x.fillRect(0, headH - 12, W, 12);
  x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
  const spaced = (txt, px, y, size, weight, spacing) => {
    x.font = font(weight, size); let w = 0; for (const ch of txt) w += x.measureText(ch).width + spacing; w -= spacing;
    let cx = px === 'center' ? (W - w) / 2 : px; for (const ch of txt) { x.fillText(ch, cx, y); cx += x.measureText(ch).width + spacing; }
  };
  spaced(SCHOOL_NAME.toUpperCase(), pad, 70, 26, 900, 8);
  spaced((M.team?.name || 'Penguins').toUpperCase(), pad, 140, 60, 900, 10);
  x.font = font(600, 26); x.fillStyle = 'rgba(255,255,255,.85)';
  x.fillText((d.opponent ? `vs ${d.opponent} · ` : '') + d.date, pad, 192);
  // Score on the right
  if (d.us != null || d.them != null) {
    x.textAlign = 'right'; x.fillStyle = '#fff'; x.font = font(900, 84);
    x.fillText(`${d.us ?? '–'}–${d.them ?? '–'}`, W - pad, 150);
    x.font = font(800, 20); x.fillStyle = 'rgba(255,255,255,.8)'; x.fillText('FINAL', W - pad, 190); x.textAlign = 'left';
  }
  // Table
  const nameW = 300, numW = 70, colW = Math.min(110, (W - pad * 2 - nameW - numW) / Math.max(1, d.cols.length));
  const colX = i => pad + numW + nameW + colW * i + colW / 2;
  x.font = font(900, 20); x.fillStyle = BORDER;
  x.fillText('#', pad, tableTop - 18); x.fillText('PLAYER', pad + numW, tableTop - 18);
  x.textAlign = 'center'; d.cols.forEach((col, i) => x.fillText(col.head, colX(i), tableTop - 18)); x.textAlign = 'left';
  x.fillStyle = INK; x.fillRect(pad, tableTop - 6, W - pad * 2, 3);
  const rowsAll = [...d.rows, { num: '', name: 'Team', cells: d.team, total: true }];
  rowsAll.forEach((r, i) => {
    const y = tableTop + i * rowH;
    if (r.total) { x.fillStyle = INK; x.fillRect(pad, y, W - pad * 2, 3); }
    else if (i % 2) { x.fillStyle = 'rgba(78,42,132,.07)'; x.fillRect(pad, y, W - pad * 2, rowH); }
    const base = y + rowH / 2 + 10;
    x.fillStyle = COURT; x.font = font(900, 26); x.fillText(r.num, pad + 8, base);
    x.fillStyle = INK; x.font = font(r.total ? 900 : 700, 28); x.fillText(r.name, pad + numW, base, nameW - 16);
    x.textAlign = 'center';
    r.cells.forEach((v, j) => { x.font = font(d.cols[j].key === 'pts' ? 900 : 600, 28); x.fillStyle = d.cols[j].key === 'pts' && v !== '0' && v !== '–' ? PINK : INK; x.fillText(v, colX(j), base); });
    x.textAlign = 'left';
  });
  // Footer
  x.font = font(600, 20); x.fillStyle = 'rgba(43,21,80,.66)';
  const foot = [d.season, d.haveMin ? 'MIN = minutes played' : '', 'OR / DR = offensive / defensive rebounds', 'PF = fouls'].filter(Boolean).join('  ·  ');
  x.fillText(foot, pad, H - 40);
  return c;
}

/* =====================================================================
   4. THE PDF WRAPPER — a one-page PDF holding the picture (as a JPEG), sized to fit
      a letter-width page. Written by hand: catalog, pages, page, image, contents.
   ===================================================================== */
function pdfFromJpeg(jpeg, w, h) {
  const pw = 612, ph = Math.round(h * pw / w), enc = new TextEncoder(), parts = [], at = [];
  let len = 0;
  const put = s => { const b = typeof s === 'string' ? enc.encode(s) : s; parts.push(b); len += b.length; };
  const obj = (n, body) => { at[n] = len; put(`${n} 0 obj\n`); for (const piece of [].concat(body)) put(piece); put('\nendobj\n'); };
  put('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, [`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream']);
  const draw = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  const xref = len;
  put(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map(n => String(at[n]).padStart(10, '0') + ' 00000 n \n').join('')}`);
  put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function makeBoxFiles(d) {
  const c = drawBoxScore(d);
  const png = await new Promise(res => c.toBlob(res, 'image/png'));
  const jpgBlob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.92));
  const jpeg = new Uint8Array(await jpgBlob.arrayBuffer());
  const pdf = new Blob([pdfFromJpeg(jpeg, c.width, c.height)], { type: 'application/pdf' });
  const base = `Penguins box score ${d.opponent ? 'vs ' + d.opponent + ' ' : ''}${new Date().toISOString().slice(0, 10)}`.replace(/[\\/:*?"<>|]/g, '');
  return { png: new File([png], base + '.png', { type: 'image/png' }), pdf: new File([pdf], base + '.pdf', { type: 'application/pdf' }) };
}

/* =====================================================================
   5. SENDING — the share sheet (Messages, AirDrop, Mail, Save to Files); a download where
      sharing files isn't available (e.g. a computer browser).
   ===================================================================== */
async function sendBoxFile(file) {
  if (!file) return;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name }); } catch { /* closed the share sheet */ }
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
document.getElementById('boxPng').onclick = () => sendBoxFile(BX.files?.png);
document.getElementById('boxPdf').onclick = () => sendBoxFile(BX.files?.pdf);
document.getElementById('btnCloseBox').onclick = () => { document.getElementById('boxSheet').hidden = true; };
