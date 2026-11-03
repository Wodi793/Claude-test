/* Penguins — sport settings (Stage 3).
   One bundle per sport. Only basketball exists now; soccer, field hockey and
   lacrosse can be added later as new entries with the same fields.

   Game defaults are placeholders until the league rulebook is in (see BUILD-LOG.md);
   each game's settings can be changed in the app anyway. */
'use strict';

const SPORTS = {
  basketball: {
    name: 'Basketball',
    onCourt: 5,              // players on the court at once
    maxRoster: 15,           // roster size the screens are designed for
    periods: 4,              // default number of periods (placeholder — rulebook)
    periodMinutes: 6,        // default period length in minutes (placeholder — rulebook)
    periodName: 'Quarter',   // shown as "Q1", "Quarter 2", …
    // Later: court drawing for the Playbook, stat types for the Stats tab.
  },
};

const DEFAULT_SPORT = 'basketball';
const DEFAULT_SEASON = 'Winter 2026–27';
