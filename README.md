# Penguins Playbook

A coaching clipboard for iPhone and iPad: draw basketball plays on a Penguins court
with your finger or Apple Pencil. Works offline once installed on the home screen.
No accounts, no server — plays are stored on the device.

## Files

| File | What it does |
|---|---|
| `index.html` | The whole app: layout, styling, court drawing, pens, saving, backup |
| `manifest.webmanifest` | Home-screen name, icon and colors |
| `sw.js` | Service worker — keeps a copy of the app on the device for offline use |
| `icon-180.png`, `icon-512.png` | App icons |

## Using it

- **Draw:** one finger (iPhone) or Apple Pencil (iPad).
- **Zoom / move:** pinch and drag with two fingers. On iPad, once you've used the Pencil,
  fingers only zoom and move — so your palm never leaves marks.
- **Tools:** swipe in from the right edge (or tap the glass tab there); swipe back to hide.
  The rail has: board-color marker,
  rainbow color picker, eraser, undo, redo, clear, save, and ••• for the rest
  (full/half court, purple/white board, line thickness, saved plays, fit to screen).
  Touching the court also puts it away.
- **Save** asks for a name the first time, then saves quietly. A dot on it means unsaved changes.
  **Saved plays → Save as new** makes a copy.
- **Saved plays → Export backup** saves all plays to one file (iPhone: choose "Save to Files").
  **Import backup** adds them back; plays you already have are kept.
- The court arranges itself (turned or not, PENGUINS on the ends or sides) to be as big as
  the screen allows. Drawings are stored in court feet, so they follow the court.

## Common changes (all in `index.html`, section "2. SETTINGS")

- Team name: `TEAM_NAME`
- Purple shade: `PURPLE`
- Board-color marker: `ink` inside `THEMES`
- Marker thickness: `PEN_WIDTHS` (in feet)
- How far you can zoom: `ZOOM_MAX`
- Border widths: `LETTER_BAND`, `PLAIN_BAND`

Court measurements (U.S. high school) are in section "3. COURT GEOMETRY".

## Publishing an update

Commit and push to `main`; GitHub Pages republishes in about a minute. The installed app
picks up the new version the *second* time you open it (first open downloads it quietly).
If you add a new file, list it in `FILES` in `sw.js` and change `VERSION`.
