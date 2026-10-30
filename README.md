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
  fingers only zoom and move — so your palm never leaves marks. **Fit** resets the view.
- **Tools:** tap the round button in the top-right corner. Touching the court puts them away.
- **Board colors:** the half-purple circle in the tools panel swaps purple board ⇄ white board.
- **Save** overwrites the open play. **Plays → Save as new** makes a copy.
- **Plays → Export backup** saves all plays to one file (iPhone: choose "Save to Files").
  **Import backup** adds them back; plays you already have are kept.

## Common changes (all in `index.html`, section "2. SETTINGS")

- Team name: `TEAM_NAME`
- Purple shade: `PURPLE`
- Pen colors: `pens` inside `THEMES`
- Marker thickness: `PEN_WIDTHS` (in feet)
- How far you can zoom: `ZOOM_MAX`

Court measurements (U.S. high school) are in section "3. COURT GEOMETRY".

## Publishing an update

Commit and push to `main`; GitHub Pages republishes in about a minute. The installed app
picks up the new version the *second* time you open it (first open downloads it quietly).
If you add a new file, list it in `FILES` in `sw.js` and change `VERSION`.
