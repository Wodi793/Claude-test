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
| 6 | Split code into a few files | Not yet answered — ask before Stage 2 |
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
