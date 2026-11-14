# Build log — Penguins team app

A record of every stage: what changed, why, where, and how it was tested.
Use it (with the git history) to find and undo any single change.

## Save points

| Save point | What it is | How to return to it |
|---|---|---|
| Branch `save/playbook-v16-baseline` (commit `1bb72b8`) | The working Playbook, version 16, before any team-app work | Ask Claude to "restore the live app to save/playbook-v16-baseline" |

## How the work is staged

- **Live app** (unchanged until Stage 7): `wodi793.github.io/Claude-test/` — files in the main folder.
- **Preview** (every stage lands here first): `wodi793.github.io/Claude-test/next/` — files in `next/`.
  - Its own database (`penguins-playbook-preview`), so nothing done in the preview touches live plays.
  - Its version label says "preview"; its home-screen name is "Penguins β".
- At Stage 7 the preview replaces the live app.

## Decisions (from the owner)

| # | Question | Decision |
|---|---|---|
| 1 | How to test stages | Preview address; live app untouched until Stage 7 |
| 2 | Where the tabs go | Floating glass switcher (court keeps its full size) |
| 3 | Compact-layout cutoff | Short side under **455 pt**: all regular iPhones compact; the unfolded foldable (measured 669 pt — see Stage 1b) gets the large layout |
| 4 | Absent / Injured / Sitting out | Applies to one game only |
| 5 | Default game format | Waiting on the league rulebook (needed at Stage 4) |
| 6 | Split code into a few files | Yes (owner: "follow your recommendations") |
| 7 | Tab switcher position | Bottom center, floating glass, in the gap below the court |
| — | Centering vs. size sideways | Always centered (owner's requirement); sideways court ~17–21% smaller |

## Baseline checklist — the Playbook (re-tested after every stage)

Automated where possible (`baseline.js` plus layout/rotation tests); the rest checked by eye.

**Court**
- B1 Full court: baskets top/bottom, high-school markings, BURNS PARK / PENGUINS in the border (or faint on the floor), basketball-penguin logo in the center circle
- B2 Half court: basket on the left, names, no logo
- B3 Purple ⇄ white board; board-color marker follows (white ⇄ purple)
- B4 Court fills the screen; sideways it runs the long way; logo stays upright
- B5 Re-measures after waking or rotating

**Drawing**
- B6 One finger draws; line lands under the finger
- B7 Two-finger pinch zoom / pan; "Fit court to screen" resets
- B8 Second finger mid-stroke cancels that stroke
- B9 iPad: Pencil draws; fingers only zoom/move once the Pencil is used
- B10 The page never scrolls, zooms, or bounces

**Tools**
- B11 Swipe in from the right edge opens the glass rail; swipe back / tap court / tap tab closes
- B12 Full | Half switch on the rail; asks before discarding unsaved work
- B13 Board-color marker; rainbow color picker
- B14 Eraser removes whole lines
- B15 Undo / redo; Clear (undoable)
- B16 Line slider in •••: thin default, remembered, old lines unchanged

**Saving**
- B17 Save: names it the first time, then saves quietly; dot = unsaved
- B18 Save as new
- B19 Saved plays: open, rename, delete (asks first)
- B20 Warns before discarding unsaved changes
- B21 Drawing in progress survives closing the app
- B22 Export backup (share sheet) / Import (merges; newer copy wins)

**App**
- B23 Works offline; updates when online; version number in •••
- B24 Screen check opens from •••
- B25 Full-screen from the home-screen icon

---

## Stage 0 — Save point and inspection (2026-11-01)

- Saved the working app as branch `save/playbook-v16-baseline` (GitHub refused a tag; a branch works the same).
- Inspected: one-file app (`index.html`, ~1,500 lines, 14 sections), IndexedDB storage (`plays`, `meta`),
  service worker `sw.js`, logo source `icon.svg`, published on GitHub Pages from `main`.
- No app changes.

## Stage 1 — Court centering fix (2026-11-01)

**Problem.** After rotating, the court wasn't centered — sideways it sat about 30 pt toward one side and
40 pt high (pinned toward a corner). Cause: it was centered inside the area iOS *reports*, which isn't
centered on the real screen (iOS reserves room for the clock on one side, and cuts off the bottom of
home-screen apps). Sideways it was also deliberately placed high to be as big as possible.

**Fix** (`next/index.html`, function `fitView`, section 6): take the biggest area that is symmetric around
the real screen's center and clear of the clock / cut-off, and fit the court inside it. Nothing else in
the drawing behavior changed.

**Also:** created the preview copy in `next/` (own database, "preview" label, icons from the main folder).

**Measured** (simulated phone, upright and sideways with the clock on either side):

| | Off-center before (live) | Off-center after (preview) | Court size after |
|---|---|---|---|
| Upright, full/half | 0 / 0 | 0 / 0 | unchanged |
| Sideways, clock right | 29 pt left, 41 pt high | 0 | ~17% (full) / ~21% (half) smaller |
| Sideways, clock left | 30 pt right, 41 pt high | 0 | same |

**Baseline checklist:** all automated checks pass on the preview (19/19, three runs; also 19/19 on the
live app as a control). Layout/finger-accuracy, rotation/tool-rail, wake re-measure, line slider, and
upright-logo tests also pass. Owner to confirm on the real phone and iPad.

## Stage 1b — Correction from the real Screen check (2026-11-01)

**What we learned** (owner's Screen check, foldable, upright, home-screen app):
- App area 669 × 927 pt; true screen height 951 pt (100lvh); clock/camera strip 82 pt; home bar 34 pt.
- iOS hides only ~24 pt at the bottom (not 57). `screen.width/height` report unrelated numbers (457 × 678).
- **Earlier simulations used the wrong screen size** (469 × 667): screenshots arrive scaled down, and their
  pixel size was taken at face value. The old detection of the hidden strip never switched on on this phone.
- Stage 1 as first written would have made the upright court ~6% smaller and still 12 pt off-center
  on the real phone. Caught in the preview; never reached the live app.

**Fix** (`next/index.html`, `physicalHeight()` + hidden `#lvhProbe` element): measure the true screen
height with a 100lvh-tall element (the method the Screen check proved), and center on it.

**Measured with the real numbers (upright):**

| | Live app today | Preview |
|---|---|---|
| Full court | 12 pt below center, 793 pt tall | centered, 769 pt tall (−3%) |
| Half court | 12 pt below center, 764 pt tall | centered, 760 pt tall |

Sideways on the real phone not yet measured — needs a sideways Screen check screenshot.

**Baseline checklist:** all automated checks pass on the preview (19/19, two runs); tools, rotation/rail
(10/10), line slider, upright logo, wake re-measure, finger accuracy all pass.

## Stage 1 approved by owner (2026-11-01)

## Stage 2 — Tab shell (2026-11-03)

**Code split** (preview only, `next/`). The Playbook's styles and code were moved **unchanged** out of
`index.html` — verified byte-for-byte against the previous commit:

| File | Contents |
|---|---|
| `next/index.html` | Page structure only: the Playbook tab, the Minutes tab, the tab switcher, the shared pop-up |
| `next/styles.css` | All styles: the original Playbook styles (unchanged), then a "SHELL" section (tabs, switcher, Reduce Motion / Reduce Transparency) |
| `next/playbook.js` | The original Playbook code, unchanged except the version label ("18 preview") |
| `next/shell.js` | Tab switching. How to add a tab (e.g. Stats) is explained at the top |

**How tabs work.** Each tab is a `<div id="tab-NAME" class="tab">` plus a button in `#tabbar`.
Switching only hides/shows: the Playbook is made invisible and untouchable (`visibility: hidden` + `inert`)
but stays laid out, so its size, drawing, zoom, unsaved changes and open tools are untouched. Nothing
reloads. The last-used tab is remembered. Minutes is a placeholder until Stage 4.

**Switcher placement.** `placeTabbar()` keeps it just above the bottom of what iOS shows (clear of the home
bar, not pushed up by the part iOS hides). Measured clear of the court on the owner's phone (court bottom
860, switcher top 865) and on a regular iPhone.

**Accessibility.** Respects iOS Reduce Motion (no slide animations) and Reduce Transparency (solid
instead of glass).

**Tests**
- Tab switching (iPhone + iPad): drawing, unsaved status, zoom position, open tools all kept; the hidden
  Playbook can't be touched; last tab remembered after restart. No errors.
- Found during testing (not caused by tabs, left as is): zooming within ~1 s of opening the app gets reset by
  the start-up screen re-check (B5). Same on the live app.
- Baseline checklist: 19/19 (two runs); tools/swipe, rotation/rail 10/10, line slider, upright logo, wake
  re-measure, finger accuracy — all pass.

**Files the offline copy needs** (`next/sw.js` FILES) now include `styles.css`, `playbook.js`, `shell.js`,
`../icon.svg`; cache version `penguins-preview-v18`.

## Stage 2 approved by owner (2026-11-03)

## Stage 3 — Teams, seasons, rosters; one backup (2026-11-03)

**New files** (`next/`):

| File | Contents |
|---|---|
| `sports.js` | Sport settings. Only basketball: 5 on court, roster up to 15, defaults 4 × 6 min (**placeholders until the rulebook**), "Quarter" |
| `data.js` | Teams, players, games — and the record shapes, documented at the top (Team, Player, Game, Event). Playing time is always calculated from the event log |
| `settings.js` | The Team screen: team name, season, roster, teams & seasons, backup |

**⚠ Changes inside the Playbook's code** (`next/playbook.js`, both flagged to the owner beforehand):
1. **Storage (section 10).** Database version 1 → 2: adds `teams`, `players`, `games` tables; creates only what's
   missing, so existing plays are untouched. Adds general helpers (`DB.all/get/put/del/byTeam`).
2. **Backup (section 12).** Export now writes one file (format version 2) with plays, teams, players and games.
   Import merges each kind (newer copy wins) and still accepts version-1 files (plays only).

**Minutes tab.** Shows the team name and season, a gear button for Team settings, and a roster summary. The
game tracker is Stage 4.

**Team screen behavior**
- Roster sorted by jersey number; edit number/name in place; Active ⇄ Inactive; Remove (asks first).
- Removed players are kept in storage (hidden from the roster) so past games still show their minutes.
- One team record per season. "Start new season" copies the roster (players start active) and switches to it.
- Teams & seasons list: tap to switch. "New team". "Delete this team and its games" (asks; plays unaffected).
- A note appears if more than 15 players are active.

**Tests**
- Upgrade: an old (version 1) preview database with a saved play → play kept, new tables created.
- Team screen: add/sort, edit, inactive, remove (kept in storage), rename season, new season copies roster,
  switch teams, delete team.
- Backup: export contains plays + teams + players + games; delete team → import brings it back; an old
  plays-only backup still imports.
- Baseline checklist 19/19 (two runs); tools/swipe; rotation/rail 10/10; line slider; upright logo; wake
  re-measure; finger accuracy; tab switching keeps drawing/zoom/tools (iPhone + iPad). No errors.

Cache version `penguins-preview-v19`; app version "19 preview".

## Stages 1–3 confirmed by owner on the preview itself (2026-11-03)
(Earlier OKs had been given while looking at the live app; owner then opened the preview and approved.)

## Stage 4 — Minutes: pre-game, clock, subs, undo, alerts (2026-11-03)

**Rulebook not yet received** — built with placeholder defaults 4 × 6 min (`sports.js`), changeable per game.

**New files** (`next/`):

| File | Contents |
|---|---|
| `gamelog.js` | The calculations: replays a game's event log into clock, period, who's on court, everyone's minutes, and on-court stretches (for Stage 5 timelines). No screens. |
| `minutes.js` | The Minutes screens, in 8 labeled sections: state, recording actions, pre-game, live game, final, the ¼-second update, sub alert + screen wake, menus |

**How time works.** The clock is never counted by ticks: while running, time left = (clock at start) − (now − start
time). Playing time = time on court while the clock runs, recalculated from the log every time. A locked screen,
backgrounded app, tab switch, or restart can't make it drift.

**Pre-game.** Opponent (optional), Format (periods, minutes, sub alert), roster: tap to pick starters (exactly 5 to
enable Start), press-and-hold for Absent / Injured / Sitting out / Reactivate (this game only).

**Live game.** Period chip, big clock, Start/Stop, Undo (always visible), ••• game menu (Adjust clock, Game settings &
sub alert, End game now, Start a new game, Team & roster, Discard this game). On court and Bench (least played
first) with minutes. Subs: tap who comes out (on court), then who goes in (bench); queue several; one
"Confirm N subs" records them all at that moment. Tapping a queued player again takes that sub back. The count on
court can't change (subs are always one-for-one). At 0:00 the clock stops itself at the exact moment it hit zero
and shows "Start Q2" (or "End game" after the last period). The same five stay on court into the next period.

**Undo** removes the last action (all events recorded together share an action id), including starting or ending
the game.

**Sub alert.** Off / Halfway (default) / Every N minutes. Banner + whole-screen flash (steady outline if Reduce
Motion is on) + a three-tone sound, on any tab. Sound is unlocked by tapping Start game / Start (an iPhone rule);
on iOS 17+ it's set to play even with the silent switch on. Not possible on iPhone/iPad web apps: alerts while the
screen is locked or in another app, vibration. The screen is kept awake during a live game (Screen Wake Lock).
Game settings changes are remembered as the team's defaults for the next game. Format is locked once a game starts.

**Bugs found by testing and fixed before publishing**
1. Picking starters quickly lost taps: each save replaced the game in memory with its saved copy. Now saves update
   the game in place (`saveGame()` in minutes.js).
2. With subs queued, the floating sub bar covered the bottom of the bench list and it couldn't be scrolled into
   view. The list now gets extra bottom room while the bar shows (`--subbar-h`).

**Tests** (simulated clock, 8-player roster, one absent): starters (Start disabled at 4, enabled at 5; absent can't
be picked) · 90 s → 4:30 · two subs while running → correct minutes · bench order · undo restores exact minutes ·
halfway alert at 3:00 · 100 s "screen locked" gap → correct · auto-stop at 0:00, on-court time totals exactly
5 × 6:00 · next period · adjust clock credits no time · 45 s in the Playbook → clock and minutes continued ·
app restart mid-game → running, correct, same tab · end game → final list · undo end → live. No errors.
Baseline checklist 19/19 (two runs) and all other Playbook, tab and Stage 3 tests pass.

Cache `penguins-preview-v20`; app version "20 preview".

## Stage 4b — League minimum playing time (2026-11-03)

**Source.** The rulebook PDF (Fall 2026 2nd/3rd Grade Basketball Rules, a2schools.org) couldn't be downloaded here
(the site isn't on this workspace's network allow-list). Built from the owner's summary of it plus the owner's
answers: **6-minute quarters, running clock** (stops only for the mid-quarter break, timeouts, injuries), halftime
not needed, and **free substitution all game** unless the ref starts enforcing half-quarter blocks.

**Rule implemented** (Rule 14 + Note 1, as summarized): every player plays at least **one full quarter (6:00) by
mid-Q3**; anyone still short then goes in and stays until she has it; a player who arrives after Q3 starts is exempt.
Because of free substitution this is tracked in time, not blocks. (A block-based version — mid-quarter break button,
blocks played — can be added later if the ref enforces blocks.)

**Code.** `gamelog.js`: `minimumStatus()` (pure calculation; also gives `gameElapsed`). `minutes.js`: tags, bench
order, rule line, arrivals, setting. `sports.js`: defaults now confirmed (4 × 6, minimumRule on).

**What the coach sees**
- Pre-game: "League rule: everyone plays a full quarter (6:00) by mid-Q3. With N players that leaves X of free
  time…" (or warns it can't all fit).
- Live: a rule line ("6 still owed a full quarter · 9:00 of play before mid-Q3", or a warning if it can't fit, or
  "Past mid-Q3: … they go in and stay"). Tags: **Needs 2:30** · **Play now** (bench; must go in now to make it) ·
  **Keep on** (on court; must stay) · **Must go in** (past mid-Q3) · ✓ once she has her quarter.
- Bench order: Play now / Must go in first, then Needs, then least played.
- Tapping a "Keep on" player to sub out shows a reminder (allowed — the coach decides).
- Press-and-hold an absent player during the game → "Arrived / back now" records her arrival time.
- Final screen: ✓ or "Short m:ss" per player.
- Game settings: Minimum time Off / "1 quarter by mid-Q3" (on by default; remembered per team).

**Not built (deferred to Stats):** fouls per block (3 in a block → can pull early, time still owed) and the
technical's 2-minute bench time counting as playing time — both need foul/technical buttons.

**Tests.** 11 players: "9:00 of free time" (matches the summary's 3 free blocks); states at start of Q2, mid-Q2
("Play now · 6:00" for the girl who hasn't played, top of the bench), past mid-Q3 ("Must go in"), final ("Short 6:00").
13 players: "3:00 short" warning. Late arrival in Q4: exempt. Stage 4 game test unchanged (4:30 after 90 s, subs,
5 × 6:00 total, adjust, restart, undo end). Baseline checklist 19/19; tools, rotation/rail 10/10, slider/logo,
finger accuracy, tabs — all pass. No errors.

Cache `penguins-preview-v21`; app version "21 preview".

## Stage 4 (with 4b) approved by owner (2026-11-03)

## Stage 5 — Readouts: game timeline and season view (2026-11-03)

**New file** `next/readouts.js` (3 sections: timeline, season view, past game). Calculated from the event logs only.

**Game timeline** — one row per player (everyone available, so a girl who didn't play shows an empty bar): bars
across each period for her time on court, total at the right. Purple = played, black = her current stretch,
red line = now, dashed line = mid-Q3 (when the league minimum is on). Shown at the bottom of the live game
(redrawn once a second), on the final screen, and for past games.

**Season view** — "Season" button on the Minutes tab. For the current team + season, finished games only:
total minutes, games played (games with any minutes), average per game played, **fair share** (her minutes ÷
an exactly equal split of the games she was available for: game length × players on court ÷ players available;
100% = even), and "N× short" if she missed the league minimum. Sorted furthest-behind first; under 90% highlighted.
Games list: tap for that game's timeline; delete a game (asks).
"Available for a game" = everyone who played in it + anyone on the active roster not marked absent/injured/sitting.

**Tests** (two simulated games, 7 players; one girl absent from game 2; checked by hand): Ava 42:00, 2 games,
21:00 avg, 113% (= 42 ÷ (17:09 + 20:00)); Fay 6:00, 16%, 1× short; Gia 6:00, 35% (game 2 not counted — absent);
order furthest-behind first; past game opens (6 rows incl. Fay's empty one); delete updates the season.
Live timeline renders and moves. Regression: baseline 19/19, tools, rotation/rail 10/10, slider/logo, finger
accuracy, tabs, Stage 4 game test, Stage 4b rule test — all pass. No errors.

Cache `penguins-preview-v22`; app version "22 preview".

## Stage 5 approved by owner (2026-11-03)

## Stage 6 — Three layouts, one-hand toggle, Apple look, one font (2026-11-03)

**Owner's extra requests:** "more Apple-like in appearance", "make fonts consistent".

**⚠ Playbook change (flagged):** the app's serif font is replaced everywhere by Apple's system font (SF Pro) —
on the Playbook this only affects a few headings (play name in •••, the "Playbook" screen title, pop-up titles).
Court, tools, drawing unchanged.

**Apple look (team side: Minutes, Team, Season, their pop-ups).** iOS grouped style: light background
(`--ios-bg`), white rounded groups with hairline separators, 34 pt bold titles, small gray uppercase section
headers, purple tint (`--tint`), black for selections, filled capsule buttons, iOS segmented controls and text
fields, light frosted glass for sheets / pop-ups / tab switcher / sub queue (solid if Reduce Transparency is on).
The Playbook keeps its dark look around the court.

**Layouts** (`shell.js` → `chooseAppLayout()`, sets `<html data-layout data-orient>`; styles at the end of `styles.css`):

| Layout | When | Live game |
|---|---|---|
| compact | short side < 455 pt (all regular iPhones, either way; cover screen) or One-hand on | Clock on top; 5 on court always visible; bench scrolls on its own; Undo + Start/Stop pinned at the bottom (thumb); timeline in ••• → Game timeline. Sideways: three columns (clock+buttons, court, bench). While picking subs, the sub queue takes the thumb bar's place. Short screens (< 740 pt) slightly tighter. |
| tall | bigger screen upright (unfolded foldable, iPad portrait) | One centered column, timeline included |
| wide | bigger screen sideways (iPad on the bench) | Clock, rule line, court, bench left; timeline right |

**One-hand toggle:** ••• → "One-hand layout", and Team → Display (Auto / Always). Remembered on the device.
Rotating / folding mid-game only rearranges — every screen is drawn from the saved game.

**Bugs found by testing and fixed**
1. **Name clash broke the Playbook's court fitting:** the new layout function was first named `chooseLayout`, the
   same as the Playbook's — the newer one replaced it. Renamed `chooseAppLayout`. Also renamed Minutes' `undo` →
   `undoGameAction` (clashed with the Playbook's `undo`). **Added a name-clash scan to every stage's checks.**
2. Sideways phone: only 2 of 5 on court fit → three-column layout; Undo icon-only there so Stop has room.
3. Sub queue overlapped the bottom of the bench (could block tapping the last bench player) → one shared size
   (`--actions-h`); on short screens the queue replaces the thumb bar while picking subs.
4. Disabled Start button was see-through over the list → solid. Opponent field looked like a web box → iOS field.

**Tests.** Live game checked on iPhone upright (compact), iPhone sideways (compact, 3 columns), foldable unfolded
669×927 (tall), iPad sideways (wide), iPad with One-hand on (compact), back to iPhone — clock, Start/Stop and all
five on court visible and not covered (stricter check: inside the screen, not clipped by a list, not under
anything); same game and clock throughout. Small-screen sub flow (664 pt). Regression: baseline 19/19, tools,
rotation/rail 10/10, slider/logo, wake, finger accuracy, tabs, Stage 3/4/4b/5 tests — all pass; no name clashes.

Cache `penguins-preview-v23`; app version "23 preview".

## iPad Pencil / tap-offset investigation (2026-11-14)

Reported on the live app (v16), M4 iPad Pro 13", sideways:
taps on the tool rail register above the finger (must press below a button; hit Clear instead of Save);
the Pencil can't press rail buttons but draws fine; wants Pencil squeeze = erase; wants a thinner line.

- Screen check (sideways): inner 1600×1188 but screen 1200 tall (lvh 1200); safe T32 B20;
  visual offset 0; scroll 0. The app is drawn in the top 1188 pt, leaving a 12 pt strip unused at the bottom.
  Likely source of a fixed tap offset (iPadOS 26 home-screen web app bug; others report taps landing just below the target).
- Squeeze / double-tap: Safari does not pass these to web pages (native apps only). Not possible.
- Added `tap-test.html` (linked from Screen check) to measure the finger and Pencil offset, and
  whether Pencil taps produce click events. Waiting on the user's results before changing the app.
- Proposed (not yet approved): move Clear into the ••• menu; Pencil-aware rail buttons;
  two-finger tap toggles the eraser; minimum line 0.15 → ~0.08 ft.

### Version 24 preview — iPad Pencil fixes (2026-11-14, owner: "Do it")
- **Clear** moved off the rail into the ••• menu ("Clear the court", pink text), away from Save. Undo still restores it.
  Baseline B15 now opens ••• to clear.
- **Apple Pencil presses buttons:** a Pencil press-and-release on the same button (< 8 pt movement) calls `click()`;
  a real click that also arrives within 600 ms is ignored, so nothing is pressed twice. Applies to every button,
  label and link in the app (playbook.js, after the drawer wiring). Cause of the original failure not confirmed.
- **Two-finger tap = switch marker / eraser** (stand-in for Pencil squeeze, which Safari doesn't expose):
  both fingers down within 250 ms, < 12 pt movement, lifted within 350 ms; any zoom/pan from the tap is undone;
  toast says "Eraser" / "Marker". Pinches and slow holds don't toggle.
- **Thinnest line** 0.15 → 0.08 ft; slider step 0.05 → 0.01.
- **Tap offset:** not changed yet — waiting on tap-test results.
- Tests: new Pencil/two-tap test 15/15; baseline all pass; tabs, game, layouts, rule, season pass; no name clashes.

### Version 25 preview — dark-purple border around the court (2026-11-14)
Owner: dark purple strip around the court like B (1.5 ft); the court must NOT get smaller;
the white border and letters may shrink; letters must be spaced away from the strip.
- Purple board only: `THEMES.purple.apron = '#2b1550'`, `APRON = 1.5` ft, drawn just outside the boundary line.
  White board unchanged (no answer from owner; my recommendation).
- Court size unchanged (PLAIN_BAND unchanged). On the tight sides the strip runs to the screen edge.
- Names: new `placeNames(L, theme)` sizes and centers PENGUINS / BURNS PARK in the white space left
  outside the strip, `NAME_GAP = 0.4` ft clear of it. `MIN_BORDER_LETTERS` 2 → 1.25 ft so small screens keep
  the names in the border instead of faint on the floor.
- Letter sizes now: iPad sideways full 4.5 ft (same), half 2.3 ft (was 4.5); iPad upright half 1.5 ft (was ~3.7);
  iPhone unchanged (4.3–4.5).
- Noticed, not changed: the floating tab bar covers PENGUINS at the bottom when names are at the ends (since Stage 2).

### Version 26 preview — names match the border (2026-11-14)
Owner: the letters must match either the border or the court body exactly. They already matched the body
(#4e2a84), but beside the dark strip they read as a near-miss. Chose the strip: `DEEP_PURPLE = '#2b1550'`
for both the strip and the names (purple board). White board unchanged. Baseline passes.

## Stage 7 — published to the live app as version 27 (2026-11-14, owner: "Publish all")

Also included, from the owner just before publishing: **the tab switcher is a small round corner button**
(bottom-left, clear of the names), showing the other tab's icon (stopwatch on the Playbook,
court on Minutes). It sits in the same corner when sideways. Replaces the centered two-word pill,
which covered PENGUINS. Option A (moving the name up) was no longer needed.

What was done
- Save point: branch `save/live-v16-before-publish` (tags are refused by the server).
- Copied next/ to the root; fixed `../icon*` → `icon*`, Screen check link, `<title>Penguins</title>`,
  `DB_NAME = 'penguins-playbook'` (the live database), `APP_VERSION = 27`, `sw.js` VERSION `penguins-v27`
  with every new file listed.
- Manifest: name "Penguins Playbook" → "Penguins" (short name was already "Penguins"); start URL and
  scope unchanged ("./"), so the existing home-screen icon keeps working and no reinstall is needed.
  iOS keeps the name an icon was installed with.
- Data: the live database upgrades from version 1 to 2; saved plays are kept (tested: a play saved
  in v16 is still there in v27, with the new teams/players/games stores added).
- next/ stays as the preview (version 27 preview, its own database).

Tests on the live copy: baseline all pass, Pencil/two-tap 15/15, tabs, layouts, game, rule, season,
v16 → v27 upgrade. Test fix: game.js reopened on Minutes, where the switcher only shows the other tab.
Not verified on a real device: the Pencil button fix and the tap offset (tap-test results still owed).

### Version 28 preview — dark team side (2026-11-14)
Owner (after running a full quarter with subs: "felt really good"): make Minutes darker and more
minimalist; use the two dark purples most; white and light colors as the pop.
- New last section in next/styles.css, "DARK TEAM SIDE": redefines the Stage 6 color variables
  (background #2b1550, cards #3a1f68, white text, lavender #cbb8f2 accent) and recolors the pieces
  that had fixed colors. Layout unchanged; Playbook unchanged.
- White = Start, Confirm, period chip, selected / going-out rows, urgent "Play now" tags.
  Court purple = number circles, Stop, coming-in rows, must-stay tags. Lavender = small accents, timeline bars.
- Dark glass for menus, sub queue, pop-ups, the thumb bar and the corner switch.
- Disabled "Pick 5 more starters" kept solid (the list must not show through).
- Tests: layouts, game pass.

### Version 29 preview — loud purple / hot pink / white (2026-11-14)
Owner on preview 28: header should read BURNS PARK PENGUINS in the court's lettering; dark felt too dark and
lacked definition; wants purple, hot pink and white with black outlines, "loud", "sassy", more contrast.
- Replaced the DARK section with "LOUD TEAM SIDE": court-purple page; white cards with 2px near-black outlines
  and hard black drop shadows; hot pink #ff2e93 for Start / Confirm / quarter badge / picked and coming-in rows /
  urgent tags; black for Stop (pink shadow) and going-out rows.
- Header: a white card with BURNS PARK PENGUINS (SCHOOL_NAME + team name) in the court lettering
  (system font, weight 900, capitals, 0.19em spacing, #2b1550), sized to fit the width; on screens ≥ 700 pt
  wide the name, season and buttons share one line so the game stays high on the screen.
- Bug found: my black variable was named --ink, which the Playbook sets to the marker color (white) on the
  page, so outlines vanished. Renamed --blk. (Same family as the Stage 6 name clashes: shared names.)
- Tests: layouts (all five on court in every layout after the header fix), game, season pass.

### Version 30 preview — "sharp" (2026-11-14)
Owner on preview 29 (liked it): bolder BURNS PARK PENGUINS; rules and starter text much smaller; pre-game order =
header, players, then starters text, then league rule, then opponent/format at the bottom; iPad: drop the
"11 still owed" box, clock card the same size as the timeline and aligned with it, no "Game timeline" label,
more negative space; pull it all together — "high-end Berlin design studio… sharp".
- New "SHARP" section on top of LOUD: 6 px corners (4 px tags and number squares), one 2 px outline and one
  4 px hard shadow everywhere, more space (20–28 px), section labels and sheet titles in the court lettering
  (900, wide-spaced capitals), buttons in heavy capitals, small print 12 px.
- Header lockup: BURNS PARK (small, spaced) over a big PENGUINS (court lettering, deep purple).
- Pre-game reordered in minutes.js (players → Start → starters text → league rule → opponent/format).
- iPad sideways: 2 × 2 grid — clock | timeline (stretched to the same height), on court | bench; rule bar hidden
  there; slimmer header so all five on court fit on an 11" iPad too. Timeline label removed everywhere.
- Playbook not changed.
- Tests: layouts (all five visible everywhere), game, season, rule, tabs, baseline pass.

### Version 31 preview — fitted to each screen (2026-11-14)
Owner's use: a coach times the game on a phone (often the foldable iPhone, folded, upright); the iPad is mainly
for drawing plays, held sideways. Wants: folded = clean narrow face that scales across iPhones; unfolded upright
and sideways both good; sideways = "two screens": clock + who's in | the playing-time chart, each scrolling,
growing on the iPad; iPad turns. No sharing needed. "Make it beautiful."
- New "SCREENS" section. Court and bench now sit in a `.sec-lists` wrapper (minutes.js), `display: contents`
  everywhere except the two-screen layout.
- Compact (any iPhone upright, folded): only urgent rule tags show (Play now / Must stay); "Needs 2:40" hidden.
  Type and rows scale with width/height; very narrow (≤ 360) and very short (≤ 640, SE) tweaks — on the SE the
  rule line hides so the bench keeps room.
- Wide (unfolded sideways, iPad sideways): header hidden during a game; two equal columns split at the middle
  (where a foldable's hinge is), each filling the height and scrolling on its own: left = clock card, then on
  court + bench; right = the chart, full height. Rows, numbers and chart grow with the screen height.
  Sub queue sits under the left column.
- Tall (unfolded upright, iPad upright): header hidden during a game so all five on court fit; rows scale up.
- Checked at 320×568, 360×780, 440×956, 669×927, 927×669, 1194×834, 1376×1032, 1032×1376: clock, Start/Stop
  and all five on court visible everywhere; the chart visible in the two-screen layouts. All other tests pass.

### Version 32 preview — Playbook in the same look; bigger court on the foldable (2026-11-14)
Owner: make the Playbook match (strong; limited pink, mainly menus and buttons); on the foldable, smaller borders
so the court is bigger; centered with equal borders everywhere, but on the open foldable sideways use the whole
screen; "compress the white a little, make the border a little bigger".
- Court fit (fitView): still centered on the real screen by default. New: when iOS takes a big strip on one side
  only (the foldable's camera/clock side), keeping it symmetric wastes the same again on the other side; if using
  the whole usable span in that one direction makes the court ≥ 4% bigger, do that (the other direction stays
  centered). Affects the foldable (both ways) and phones sideways; regular iPhones upright and iPads unchanged.
- Dark band APRON 1.5 → 2 ft (more purple frame, less white). Court size unchanged.
- Playbook restyle ("PLAYBOOK, SHARP" in styles.css): white rail with black outline and hard shadow, square
  buttons, pink = tool in use / Full-Half / Purple-White / slider / main pop-up button; ••• menu as a white card
  with court-lettering title and labels; Saved plays sheet on court purple with white outlined cards; toast,
  pop-ups and the corner switch match Minutes. Court drawing unchanged.
- Tests: Playbook baseline, Pencil/two-tap, tabs, layouts, game, 8-screen check all pass; no name clashes.

### Version 33 preview — one polish standard everywhere (2026-11-14)
Owner liked the Playbook's menus and buttons in preview 32: apply the same design logic to the rest of the app.
- New last section "POLISH": every pop-up title in the court lettering; list buttons white, outlined, left-aligned,
  bold (destructive ones red); pop-up buttons white outlined, main one pink with a hard shadow, delete red;
  text boxes pale lavender with a black outline (both tabs — the Minutes "Adjust clock" box had been purple);
  steppers and switches outlined, pink when on; the ••• and gear buttons square and outlined; Team sheet chips,
  icons and the current-team dot aligned with the rest.
- Audit script (scratchpad audit.js) photographs every Minutes-side menu, sheet and pop-up.
- Tests: Playbook baseline, Pencil, tabs, layouts, game, season, rule, 8-screen check all pass.

### Version 34 preview (2026-11-14)
- Owner: "End game is red." The Game menu's "End game now" now uses the red danger text, like "Discard this game".

## Published: live version 34 (2026-11-14, owner: "Publish")
Everything from previews 28–34 (loud → sharp look, header lockup, pre-game order, screen fitting incl. the
two-screen sideways layout, Playbook restyle, bigger court on lopsided screens, wider dark band, one polish
standard, End game in red). Save point: branch `save/live-v27`.
Same steps as Stage 7: copied next/ to the root; fixed icon paths, Screen check link, title, DB_NAME
'penguins-playbook', APP_VERSION 34, sw.js VERSION 'penguins-v34'. Manifest unchanged (name "Penguins",
start URL "./"), so no reinstall and no data loss.
Tests on the live copy: baseline, tabs, layouts, game, rule, season, 8-screen check pass; Pencil test passed 3/3
on rerun (one earlier run timed out in test setup, not reproducible).
Next: owner runs the tap test on the iPad (••• → Screen check → Tap test).

### Live version 35 (2026-11-14)
I misread "End game is red." as a request; the owner did not want it red. Reverted: "End game now" in the Game
menu is plain again (live and preview 35). "Discard this game" keeps its red text, as it was before.
Lesson: when a short message could be a complaint or a request, ask.

### Live version 36 (2026-11-14)
Owner, from the foldable (screenshots: folded showed a gray strip on the right; unfolded showed a white band at
the bottom; "margins look shitty"), and: put Clear back on the rail, between the eraser and Undo, so Save stays apart.
- Clear the court: moved from the ••• menu to the rail (after the eraser, before Undo). Rail buttons sized for one
  more button ((h − 80) / 10.5). Test updated.
- The page's color now also fills whatever is outside the app's own box (html/body background: purple on Minutes;
  the border color on the Playbook). Should remove the white band; the gray strip on the folded screen may be
  drawn by iOS itself — waiting on a Screen check from the folded phone.
- Margins: right padding includes the 4 px hard shadow, so left and right margins look equal.
- Publishing is now scripted (scratchpad publish.py). Tests on the live copy: baseline, Pencil, game, 8 screens pass.

### Live version 37 (2026-11-14)
- Owner screenshot (foldable, 5 subs queued): the Cancel / Confirm bar is missing; a thin black bar shows below the bench; white band at the bottom still there. Not reproducible in Chromium at 703×1000, 669×927, 402×874, 1194×834 (bar shows, 198 pt tall, buttons present). Asked owner for version number, folded/unfolded, and whether the bar ever appears.
- Fixed: the sub bar showed "# Name" for players with no number; now just the name.

### Live version 38 (2026-11-14) — mark several subs at once
Owner: picking one off, then one on, back and forth, is too much swiping; wants to mark all coming off
(e.g. sweep down all five), then mark all going in.
- State: `M.outs` / `M.ins` (any number, any order) replace `M.out` / `M.pairs`. Who replaces whom doesn't
  affect playing time, so there's no pairing. Confirm is enabled when the counts match (≥ 1); otherwise it reads
  "Pick N more to go in / to come off".
- On court: tap toggles; a finger dragged down the list marks (or unmarks) every row it passes (`dragSelect`;
  `touch-action: none` on those rows, so dragging there doesn't scroll); "All 5 off" / "Clear" button on the
  On court label. Bench: taps toggle.
- Sub bar shows "OFF n" and "ON n" lists. Tag on court rows reads "Off".
- Undo takes back a whole confirmed batch as one action (unchanged mechanism: one action id).
- Tests: new multisub.js (11/11: sweep, All off/Clear, partial counts, confirm, undo); existing tests switched to
  the new state; full suite passes on preview and live copy.

### Live version 39 (2026-11-14)
- Owner: sort the on-court girls least played → most played, so the ones due off sit together at the bottom and the spread is visible. Done (ties by jersey number). They all gain time at the same rate while the clock runs, so the order only changes when subs are made — rows never jump mid-play. Test courtsort.js.

### Live version 40 (2026-11-14) — sweep on the bench too
- Bench rows can be swept to mark several going in. The bench scrolls, so a sweep must START on the number
  squares (`touch-action: none` on `#benchList .pnum`); a swipe that starts on a name still scrolls. Near the
  top/bottom edge of the bench the list scrolls along (requestAnimationFrame) so a sweep can reach players off screen.
- `dragSelect(list, { isOn, set, cls, handle })` now serves both lists; `markIn` added beside `markOut`.
- Redraws keep the bench's (and the two-screen lists') scroll position — before, marking someone low on the bench
  jumped the list back to the top.
- Test benchsweep.js (name swipe selects nothing; number sweep selected all 8 incl. off-screen; list scrolled).

### Live version 41 (2026-11-14)
Owner: on the small (folded) screen the sub box hid the bench so subs couldn't be picked; purple at the sides
(folded); white at the base (open); the white border around the full court is too big — halve it, keep the names.
- Sub bar: one slim row ("5 off / 3 on", Cancel, Confirm n / Pick n in / Pick n off) — 66 pt, was 127–198.
  On the phone, while picking subs, the round tab button hides and the sub bar sits at the bottom: bench shows
  4 full rows at 360×640 and 360×780 (was 3), 3 at 320×568 (was 1).
- Court border: `placeNames` keeps WHITE_SHARE = 0.5 of the white beside the names (never less than the names
  need); the dark band (`L.apronX/Y`, per screen axis, swapped when the court is turned) takes the rest.
  Names unchanged in size.
- Purple sides / white base: not changed — need the owner's Screen check (folded and open) to see whether those
  strips are inside the app's drawable area.
- Tests: multisub (updated texts), benchsweep, smallsub, game, layouts, rule, season, tabs, 8-screen, baseline,
  Pencil all pass.
