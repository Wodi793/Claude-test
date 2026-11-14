/* Penguins — reading a game's EVENT LOG (Stage 4).
   Pure calculation, no screens: given a game (settings + events) and the current
   time, work out the game clock, who is on court, and everyone's playing time.
   Used by the Minutes tab now, the readouts in Stage 5, and Stats later.

   Key rules
   - The clock is never counted by timer ticks. While it runs, the time remaining is
     (clock when it started) − (now − when it started). A locked screen, the app in
     the background, or a tab switch can't make it drift.
   - Playing time is never stored. It's recalculated from the log every time:
     a player earns time while she is on court AND the game clock is running.
   - Event types this file doesn't know (e.g. Stats' 'points', 'foul') are ignored. */
'use strict';

/** The current time. Tests can replace this to simulate a game quickly. */
const GameClock = { now: () => Date.now() };

/** Seconds in one period of this game. */
function periodSeconds(game) { return Math.round(game.settings.periodMinutes * 60); }

/**
 * Replay a game's log.
 * Returns {
 *   period, clock (seconds remaining, may have decimals), running,
 *   onCourt: [playerId, …],
 *   played: { playerId: seconds },            // whole game so far
 *   segments: [{ playerId, period, from, to }], // time on court, in seconds elapsed within the period (for timelines)
 *   periodOver,  // clock reached 0 and was stopped, waiting for "next period"
 *   ended,       // game_end logged
 *   runStart     // { at, clock } of the current run, if running
 * }
 */
function replayGame(game, now = GameClock.now()) {
  const len = periodSeconds(game);
  const s = { period: 1, clock: len, running: false, runStart: null, onCourt: new Set(),
              played: {}, segments: [], open: new Map(), ended: false };
  const elapsed = () => len - s.clock;

  // Move the clock to `value`; everyone on court earns the time in between (if it went down)
  const advanceTo = value => {
    const dt = s.clock - value;
    if (dt > 0) for (const id of s.onCourt) s.played[id] = (s.played[id] || 0) + dt;
    s.clock = value;
  };
  const openSeg = id => s.open.set(id, { playerId: id, period: s.period, from: elapsed() });
  const closeSeg = id => {
    const seg = s.open.get(id);
    if (seg) { seg.to = elapsed(); if (seg.to > seg.from) s.segments.push(seg); s.open.delete(id); }
  };
  const closeAll = () => { for (const id of [...s.open.keys()]) closeSeg(id); };

  for (const e of game.events || []) {
    switch (e.type) {
      case 'clock_start':
        advanceTo(e.clock); s.running = true; s.runStart = { at: e.at, clock: e.clock }; break;
      case 'clock_stop':
        advanceTo(e.clock); s.running = false; s.runStart = null; break;
      case 'sub_out':
        advanceTo(e.clock); closeSeg(e.playerId); s.onCourt.delete(e.playerId); break;
      case 'sub_in':
        advanceTo(e.clock); s.onCourt.add(e.playerId); openSeg(e.playerId); break;
      case 'clock_adjust': {
        // Play happened up to the old reading; the correction itself earns no time
        advanceTo(e.data?.from ?? s.clock);
        closeAll(); s.clock = e.clock; for (const id of s.onCourt) openSeg(id);
        if (s.running) s.runStart = { at: e.at, clock: e.clock };
        break;
      }
      case 'period_end':
        advanceTo(e.clock); closeAll(); s.running = false; s.runStart = null;
        s.period += 1; s.clock = len;
        for (const id of s.onCourt) openSeg(id);   // the same five stay on unless subbed at the break
        break;
      case 'game_end':
        advanceTo(e.clock); closeAll(); s.running = false; s.runStart = null; s.ended = true; break;
      default:
        break;   // unknown types (future Stats events) don't affect minutes
    }
  }

  // Clock running right now: count up to this moment (never below 0:00)
  if (s.running && s.runStart) advanceTo(Math.max(0, s.runStart.clock - (now - s.runStart.at) / 1000));
  // Close the open stretches at "now" so timelines can draw them (without changing state)
  const segments = [...s.segments, ...[...s.open.values()].map(seg => ({ ...seg, to: elapsed(), live: true }))
    .filter(seg => seg.to > seg.from)];

  return {
    gameElapsed: (s.period - 1) * len + (len - s.clock),   // game time played so far, all periods
    period: s.period, clock: s.clock, running: s.running, runStart: s.runStart,
    onCourt: [...s.onCourt], played: s.played, segments, ended: s.ended,
    periodOver: !s.running && s.clock <= 0 && !s.ended,
    lastPeriod: s.period >= game.settings.periods,
  };
}

/** "4:07" from seconds (rounded up while counting down, so 0:00 means really zero). */
function formatClock(seconds, { up = true } = {}) {
  const t = Math.max(0, up ? Math.ceil(seconds - 1e-6) : Math.floor(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Short period label: "Q1", "H2", "P3". */
function periodLabel(game, period) {
  const n = game.settings.periods;
  return (n === 4 ? 'Q' : n === 2 ? 'H' : 'P') + period;
}

/* ---------------------------------------------------------------------
   MINIMUM PLAYING TIME (Stage 4b) — league rule, per the owner's summary of the
   Fall 2026 2nd/3rd grade rules: every player plays at least one full quarter
   by the middle of Q3; anyone still short then goes in and stays until she has it
   (Rule 14, Note 1). A player who arrives after Q3 starts is exempt.
   Free substitution is assumed all game (owner, 2026-11-03), so this is measured in
   time, not half-quarter blocks.
   For other formats: one period's worth of time, by 62.5% of the game (= mid-Q3 in 4 quarters).
   --------------------------------------------------------------------- */
const MIN_RULE = { deadlineShare: 0.625, margin: 20 };   // margin: seconds of slack before "Play now"

/**
 * For each available player: { played, owed, state }
 *   state 'met'    — has her full period
 *          'owed'   — short, but there's still time before the deadline
 *          'now'    — must go in now (bench) to make the deadline
 *          'keep'   — must stay on (on court and still short, when it's tight or past the deadline)
 *          'must'   — past the deadline and still short: must go in and stay
 *          'waived' — arrived after the second half started
 * Plus: required, deadline (game seconds), remaining (game seconds left before it),
 *       shortfall (seconds that can't fit even with perfect rotation; 0 if fine).
 */
function minimumStatus(game, r, availableIds) {
  const len = periodSeconds(game), total = len * game.settings.periods;
  const required = len, deadline = total * MIN_RULE.deadlineShare;
  const remaining = Math.max(0, deadline - r.gameElapsed), before = r.gameElapsed < deadline;
  const secondHalf = len * Math.ceil(game.settings.periods / 2);
  const players = {};
  let owedTotal = 0;
  for (const id of availableIds) {
    const played = r.played[id] || 0, onCourt = r.onCourt.includes(id);
    const arrived = game.arrivals?.[id];
    if (arrived != null && arrived >= secondHalf) { players[id] = { played, owed: 0, state: 'waived' }; continue; }
    const owed = Math.max(0, required - played);
    let state = 'met';
    if (owed > 0) {
      if (!before) state = onCourt ? 'keep' : 'must';
      else if (owed >= remaining - MIN_RULE.margin) state = onCourt ? 'keep' : 'now';
      else state = 'owed';
      if (before) owedTotal += Math.min(owed, remaining);
    }
    players[id] = { played, owed, state };
  }
  const onCourtCount = game.settings.onCourt;
  const shortfall = before ? Math.max(0, owedTotal - onCourtCount * remaining) : 0;
  return { required, deadline, remaining, before, shortfall, players };
}
