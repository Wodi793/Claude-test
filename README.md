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
  Full | Half switch at the top, then rainbow color picker, eraser, undo, redo, clear, save,
  and ••• for the rest
  (purple/white board, saved plays, fit to screen, version number).
  Touching the court also puts it away.
- **Save** asks for a name the first time, then saves quietly. A dot on it means unsaved changes.
  **Saved plays → Save as new** makes a copy.
- **Saved plays → Export backup** saves all plays to one file (iPhone: choose "Save to Files").
  **Import backup** adds them back; plays you already have are kept.
- The court is made as big as the screen allows; PENGUINS goes in the leftover border (ends or
  sides), or faintly on the floor if the border is too thin. It turns to fit when the phone does, as big as
  the screen allows. Drawings are stored in court feet, so they follow the court.

## Common changes (all in `index.html`, section "2. SETTINGS")

- Team name: `TEAM_NAME`
- Purple shade: `PURPLE`
- Board-color marker: `ink` inside `THEMES`
- Marker thickness: `PEN_WIDTHS[0]` (in feet)
- Version shown in the ••• menu: `APP_VERSION` (bump it with each update)
- How far you can zoom: `ZOOM_MAX`
- Border and lettering: `PLAIN_BAND`, `MIN_BORDER_LETTERS`, `MAX_LETTERS`, `FLOOR_LETTERS`

Court measurements (U.S. high school) are in section "3. COURT GEOMETRY".

## Publishing an update

Commit and push to `main`; GitHub Pages republishes in about a minute. When the phone is
online, the app loads the newest version each time it opens (fully close it first: swipe it
away in the app switcher). Offline, it uses the copy saved on the phone. GitHub may take up
to ~10 minutes to stop serving the old copy. Check the version number in the ••• menu.
If you add a new file, list it in `FILES` in `sw.js` and change `VERSION`.
