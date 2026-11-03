/* Penguins — team data (Stage 3): teams, seasons, players, games.
   Everything is stored on the device in the same database as the Playbook
   (see DB in playbook.js, section 10) and is included in the one backup file.

   RECORD SHAPES — keep these stable; Stats (later) builds on them.
     Team    { id, name, sport, season, gameDefaults?, created, updated }
             One record per team per season ("Start new season" copies the roster).
     Player  { id, teamId, name, number, active, removed, created, updated }
             active:false = long-term inactive (left out of games until reactivated).
             removed:true = taken off the roster but kept, so old games still show her.
     Game    { id, teamId, date, opponent, settings, absences, starters, status, events, created, updated }
             settings  { periods, periodMinutes, onCourt, subAlert: { mode: 'off'|'half'|'every', minutes } }
             absences  { playerId: 'absent' | 'injured' | 'sitting' } — this game only
             status    'pregame' | 'live' | 'final'
             events    the EVENT LOG (see below)
     Event   { id, action, type, at, period, clock, playerId?, data? }
             action  events recorded together share it; Undo removes the last action
             type   'clock_start' | 'clock_stop' | 'period_end' | 'game_end' | 'sub_in' | 'sub_out' | 'clock_adjust'
                    (starters are recorded as 'sub_in' at the start; clock_adjust has data.from)
                    (Stats will add e.g. 'points', 'rebound', 'foul' — anything a reader doesn't
                    recognize is ignored, so new types never break old code)
             at     wall-clock time (ms since 1970)
             period 1, 2, …
             clock  game-clock seconds remaining in the period when it happened
     Playing time is always CALCULATED from the event log — never stored as totals. */
'use strict';

const Data = {
  newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  stamp(obj) { const now = Date.now(); return { created: obj.created || now, ...obj, updated: now }; },

  /* ----- teams ----- */
  async teams() {
    return (await DB.all('teams')).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  },
  async team(id) { return DB.get('teams', id); },
  async saveTeam(team) { const t = this.stamp(team); await DB.put('teams', t); return t; },
  async createTeam({ name = 'Penguins', season = DEFAULT_SEASON, sport = DEFAULT_SPORT } = {}) {
    return this.saveTeam({ id: this.newId(), name, season, sport });
  },

  /** The team shown in the Minutes tab. Creates "Penguins" the first time. */
  async currentTeam() {
    const id = await DB.getMeta('currentTeamId');
    let team = id && await this.team(id);
    if (!team) {
      team = (await this.teams())[0] || await this.createTeam();
      await DB.setMeta('currentTeamId', team.id);
    }
    return team;
  },
  async setCurrentTeam(id) { await DB.setMeta('currentTeamId', id); },

  /** New season for the same team: copies the roster (not games), and switches to it. */
  async startNewSeason(team, season) {
    const next = await this.createTeam({ name: team.name, season, sport: team.sport });
    for (const p of await this.players(team.id)) {
      await this.savePlayer({ id: this.newId(), teamId: next.id, name: p.name, number: p.number, active: true });
    }
    await this.setCurrentTeam(next.id);
    return next;
  },

  /** Removes a team with its roster and games (asks first, in the settings screen). */
  async deleteTeam(id) {
    for (const p of await DB.byTeam('players', id)) await DB.del('players', p.id);
    for (const g of await DB.byTeam('games', id)) await DB.del('games', g.id);
    await DB.del('teams', id);
  },

  /* ----- players ----- */
  /** Roster for a team, by jersey number (removed players left out unless asked). */
  async players(teamId, { includeRemoved = false } = {}) {
    const list = (await DB.byTeam('players', teamId)).filter(p => includeRemoved || !p.removed);
    const num = p => (p.number === '' || p.number == null) ? Infinity : Number(p.number);
    return list.sort((a, b) => num(a) - num(b) || String(a.number).localeCompare(String(b.number)) || a.name.localeCompare(b.name));
  },
  async savePlayer(player) {
    const p = this.stamp({ active: true, removed: false, ...player });
    await DB.put('players', p); return p;
  },
  async addPlayer(teamId, name, number) {
    return this.savePlayer({ id: this.newId(), teamId, name: name.trim(), number: String(number).trim() });
  },
  async removePlayer(player) { return this.savePlayer({ ...player, removed: true, active: false }); },

  /* ----- games (used from Stage 4) ----- */
  async games(teamId) { return (await DB.byTeam('games', teamId)).sort((a, b) => (b.date || 0) - (a.date || 0)); },
  async saveGame(game) { const g = this.stamp(game); await DB.put('games', g); return g; },
};
