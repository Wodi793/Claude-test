/* Penguins — sport settings (Stage 3).
   One bundle per sport. Only basketball exists now; soccer, field hockey and
   lacrosse can be added later as new entries with the same fields.

   Basketball defaults follow the Fall 2026 2nd/3rd grade league rules as confirmed by
   the owner (2026-11-03): four 6-minute quarters, running clock, and a minimum of one
   full quarter per player by mid-Q3 (see minimumStatus in gamelog.js). Each game's
   settings can be changed in the app. */
'use strict';

const SPORTS = {
  basketball: {
    name: 'Basketball',
    onCourt: 5,              // players on the court at once
    maxRoster: 15,           // roster size the screens are designed for
    periods: 4,              // four quarters (league rules)
    periodMinutes: 6,        // 6-minute quarters, running clock (league rules)
    minimumRule: true,       // everyone plays a full quarter by mid-Q3 (league rules)
    periodName: 'Quarter',   // shown as "Q1", "Quarter 2", …
    // Later: court drawing for the Playbook, stat types for the Stats tab.
  },
};

const DEFAULT_SPORT = 'basketball';
const DEFAULT_SEASON = 'Winter 2026–27';
