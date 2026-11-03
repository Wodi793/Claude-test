/* Penguins — the Team settings screen (Stage 3): team name, season, roster,
   teams & seasons, backup. Opened from the gear on the Minutes tab.
   Uses Data (data.js) for storage and ask()/toast() from playbook.js for pop-ups. */
'use strict';

const TeamUI = { team: null };

/** Reload the current team and refresh whatever is showing. */
async function refreshTeamUI() {
  TeamUI.team = await Data.currentTeam();
  const t = TeamUI.team, roster = await Data.players(t.id);
  $('mTeamName').textContent = t.name;
  $('mTeamSeason').textContent = `${SPORTS[t.sport]?.name || ''} · ${t.season}`;
  if (!$('teamSheet').hidden) renderTeamSheet(roster);
  window.onTeamChanged?.();   // let the Minutes tab reload the roster / team (minutes.js)
}
window.onBackupImported = refreshTeamUI;   // called by importBackup (playbook.js)

function openTeamSheet() { $('teamSheet').hidden = false; refreshTeamUI(); }
function closeTeamSheet() { $('teamSheet').hidden = true; }

async function renderTeamSheet(roster) {
  const t = TeamUI.team, sport = SPORTS[t.sport];
  roster = roster || await Data.players(t.id);
  if (document.activeElement !== $('tName')) $('tName').value = t.name;
  if (document.activeElement !== $('tSeason')) $('tSeason').value = t.season;
  $('tSport').textContent = sport?.name || t.sport;

  // Roster rows: number, name (edit in place), Active/Inactive, remove
  const list = $('rosterList');
  list.innerHTML = '';
  for (const p of roster) {
    const li = document.createElement('li');
    li.className = p.active ? '' : 'inactive';
    li.innerHTML = `
      <input class="num" type="text" inputmode="numeric" maxlength="3" aria-label="Jersey number">
      <input class="name" type="text" maxlength="30" aria-label="Player name">
      <button class="chip"></button>
      <button class="icon-btn" aria-label="Remove from roster">
        <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>`;
    const [num, name] = li.querySelectorAll('input');
    num.value = p.number; name.value = p.name;
    num.onchange = () => Data.savePlayer({ ...p, number: num.value.trim() }).then(refreshTeamUI);
    name.onchange = () => name.value.trim() && Data.savePlayer({ ...p, name: name.value.trim() }).then(refreshTeamUI);
    const chip = li.querySelector('.chip');
    chip.textContent = p.active ? 'Active' : 'Inactive';
    chip.onclick = () => Data.savePlayer({ ...p, active: !p.active }).then(refreshTeamUI);
    li.querySelector('.icon-btn').onclick = async () => {
      const ok = await ask({ title: `Remove ${p.name}?`,
        message: 'She comes off the roster. Games she already played keep her minutes.', okText: 'Remove', danger: true });
      if (ok) { await Data.removePlayer(p); refreshTeamUI(); }
    };
    list.appendChild(li);
  }
  const active = roster.filter(p => p.active).length;
  $('rosterCount').textContent = roster.length ? `· ${roster.length}` : '';
  $('rosterNote').textContent = active > sport.maxRoster
    ? `${active} active players — the game screens are designed for up to ${sport.maxRoster}.` : '';

  // Display: one-hand layout (shell.js)
  for (const b of document.querySelectorAll('[data-onehand]')) {
    b.classList.toggle('active', (b.dataset.onehand === 'on') === App.oneHand);
    b.onclick = () => { setOneHand(b.dataset.onehand === 'on'); renderTeamSheet(); };
  }

  // Teams & seasons: tap to switch
  const teams = await Data.teams(), tl = $('teamList');
  tl.innerHTML = '';
  for (const team of teams) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'team-row' + (team.id === t.id ? ' current' : '');
    b.innerHTML = '<span class="tn"></span><span class="ts"></span>';
    b.querySelector('.tn').textContent = team.name;
    b.querySelector('.ts').textContent = team.season + (team.id === t.id ? ' · current' : '');
    b.onclick = async () => { await Data.setCurrentTeam(team.id); refreshTeamUI(); };
    li.appendChild(b); tl.appendChild(li);
  }
}

/* ----- wiring ----- */
$('btnTeamSettings').onclick = openTeamSheet;
$('btnCloseTeam').onclick = closeTeamSheet;
$('tName').onchange = () => $('tName').value.trim() &&
  Data.saveTeam({ ...TeamUI.team, name: $('tName').value.trim() }).then(refreshTeamUI);
$('tSeason').onchange = () => $('tSeason').value.trim() &&
  Data.saveTeam({ ...TeamUI.team, season: $('tSeason').value.trim() }).then(refreshTeamUI);

async function addPlayerFromForm() {
  const name = $('newName').value.trim(), number = $('newNumber').value.trim();
  if (!name) { $('newName').focus(); return; }
  await Data.addPlayer(TeamUI.team.id, name, number);
  $('newName').value = ''; $('newNumber').value = '';
  await refreshTeamUI();
  $('newNumber').focus();   // ready for the next player
}
$('btnAddPlayer').onclick = addPlayerFromForm;
$('newName').addEventListener('keydown', e => { if (e.key === 'Enter') addPlayerFromForm(); });

$('btnNewSeason').onclick = async () => {
  const season = await ask({ title: 'Start a new season',
    message: `Copies the ${TeamUI.team.name} roster into a new season. This season's games stay with this season.`,
    input: '', placeholder: 'e.g. Spring 2027', okText: 'Start season' });
  if (!season || !season.trim()) return;
  await Data.startNewSeason(TeamUI.team, season.trim());
  refreshTeamUI(); toast(`Now on ${season.trim()}`);
};
$('btnNewTeam').onclick = async () => {
  const name = await ask({ title: 'New team', message: 'Starts with an empty roster.', input: '', placeholder: 'Team name', okText: 'Create' });
  if (!name || !name.trim()) return;
  const team = await Data.createTeam({ name: name.trim() });
  await Data.setCurrentTeam(team.id); refreshTeamUI();
};
$('btnDeleteTeam').onclick = async () => {
  const t = TeamUI.team;
  const ok = await ask({ title: `Delete ${t.name} (${t.season})?`,
    message: 'Its roster and all its games are deleted from this device. Plays are not affected. This can’t be undone — export a backup first if unsure.',
    okText: 'Delete', danger: true });
  if (!ok) return;
  await Data.deleteTeam(t.id); await DB.setMeta('currentTeamId', null);
  refreshTeamUI(); toast('Team deleted');
};
$('btnTeamExport').onclick = exportBackup;                 // the same backup as the Playbook's
$('btnTeamImport').onclick = () => $('importFile').click();

refreshTeamUI();
