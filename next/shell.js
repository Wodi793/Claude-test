/* Penguins — the app shell (Stage 2): tabs and the floating tab switcher.

   How tabs work: each tab is a <div id="tab-NAME" class="tab"> in index.html with a
   matching button in #tabbar. Switching only shows/hides them — nothing reloads or
   resets, so the Playbook keeps its drawing and (later) the game clock keeps running.
   To add a tab (e.g. Stats): add the section + button in index.html, and if it needs
   to react when shown, add a function to TAB_SHOWN below. */
'use strict';

const App = {
  tab: 'playbook',
  layout: 'tall',     // 'compact' | 'tall' | 'wide' — see chooseAppLayout()
  oneHand: false,     // force the compact layout on any screen (setting)
};

/* ----- The three layouts (Stage 6) -----
   Chosen from the screen's SHORT side, so a sideways iPhone is still compact:
     compact — short side under 455 pt: every regular iPhone either way up (the biggest is
               ~440 pt) and the foldable's cover screen. One-hand: essentials only, thumb controls.
     tall    — bigger screen held upright (unfolded foldable ~669 pt, iPad portrait): one column.
     wide    — bigger screen held sideways (iPad on the bench): two columns.
   The Minutes screens read <html data-layout="…">; the Playbook keeps its own scaling. */
const COMPACT_BELOW = 455;
// (Named chooseAppLayout — NOT chooseLayout, which is the Playbook's court-fitting function.)
function chooseAppLayout() {
  const w = window.innerWidth, h = window.innerHeight, short = Math.min(w, h);
  const layout = App.oneHand || short < COMPACT_BELOW ? 'compact' : w > h ? 'wide' : 'tall';
  const root = document.documentElement;
  root.dataset.orient = w > h ? 'land' : 'port';
  if (layout !== App.layout || root.dataset.layout !== layout) {
    App.layout = layout; root.dataset.layout = layout;
    window.dispatchEvent(new Event('penguins:layout'));   // Minutes redraws (nothing is lost — it's all in the saved game)
  }
}
function setOneHand(on) {
  App.oneHand = !!on;
  try { localStorage.setItem('penguins.oneHand', on ? '1' : '0'); } catch { /* not critical */ }
  chooseAppLayout();
}
try { App.oneHand = localStorage.getItem('penguins.oneHand') === '1'; } catch { /* not critical */ }

/** Optional per-tab code to run when a tab is shown. */
const TAB_SHOWN = {
  playbook: () => requestRender(),   // repaint the court (cheap; nothing is reset)
  stats: () => window.renderStats?.(),
};

/** The folded foldable keeps a strip beside the app (with the clock and Wi-Fi at its top) that the
 *  app can't put content in — but the page's own background does reach it. On Minutes, the team name
 *  is painted into that background, written down the strip, below the clock and Wi-Fi.
 *  Nothing happens where there's no such strip. */
function paintSideBrand() {
  const root = document.documentElement;
  const full = document.getElementById('lvwProbe')?.getBoundingClientRect().width || 0;
  const strip = isStandalone ? full - window.innerWidth : 0;
  if (App.tab !== 'minutes' || strip < 30) { root.style.backgroundImage = ''; return; }
  const name = (document.getElementById('mBrand')?.textContent || 'Penguins').toUpperCase();
  const h = window.innerHeight, size = Math.min(30, strip * 0.42);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${strip}" height="${h}">` +
    `<text x="0" y="0" transform="translate(${strip / 2} ${h * 0.62}) rotate(90)" text-anchor="middle" dominant-baseline="central" ` +
    `fill="#fff" font-family="-apple-system, system-ui, sans-serif" font-weight="900" font-size="${size}" letter-spacing="${size * 0.3}">${name}</text></svg>`;
  root.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  root.style.backgroundRepeat = 'no-repeat';
  root.style.backgroundPosition = `${window.innerWidth}px 0`;
  root.style.backgroundSize = `${strip}px ${h}px`;
}

/** iOS tints the strip behind the status bar (and the edges outside the app's own area) from the
 *  page's "theme color". Keep it the color of what's on screen: purple on Minutes; on the Playbook,
 *  the court's border color (white around the purple board, purple around the white board). */
function updateThemeColor() {
  const color = App.tab === 'playbook' && document.body.classList.contains('light-band') ? '#ffffff' : '#4e2a84';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}
window.updateThemeColor = updateThemeColor;

function showTab(name) {
  if (!document.getElementById('tab-' + name)) return;
  App.tab = name;
  document.documentElement.dataset.tab = name;   // lets styles differ per tab (e.g. the switcher's glass)
  for (const el of document.querySelectorAll('.tab')) {
    const on = el.id === 'tab-' + name;
    if (el.classList.contains('tab-page')) el.hidden = !on;      // ordinary pages: show/hide
    else el.classList.toggle('is-hidden', !on);                  // Playbook: stays laid out, just invisible
    el.inert = !on;                                               // hidden tabs can't be touched
  }
  for (const b of document.querySelectorAll('.tabbtn')) b.classList.toggle('active', b.dataset.tab === name);
  placeLens();
  updateThemeColor();
  paintSideBrand();
  TAB_SHOWN[name]?.();
  try { localStorage.setItem('penguins.tab', name); } catch { /* not critical */ }
}

/** Slide the glass lens under the active tab button. */
function placeLens() {
  const active = document.querySelector('.tabbtn.active');
  if (!active) return;
  const bar = document.getElementById('tabbar');
  bar.style.setProperty('--lens-x', (active.offsetLeft - 4) + 'px');
  bar.style.setProperty('--lens-w', active.offsetWidth + 'px');
}

/** Keep the switcher just above the bottom of what iOS actually shows: clear of the
 *  home bar, but not pushed up by the part of it that iOS hides (see physicalHeight). */
function placeTabbar() {
  const physH = physicalHeight();
  const hidden = physH ? physH - window.innerHeight : 0;
  const bottomBar = safeInsets().bottom;
  document.documentElement.style.setProperty('--tabs-bottom', Math.max(8, bottomBar - hidden + 6) + 'px');
  document.documentElement.style.setProperty('--lost-h', Math.max(0, hidden) + 'px');   // screen below the app's area
  document.documentElement.dataset.tallTop = safeInsets().top >= 70 ? 'yes' : 'no';      // e.g. the open foldable
  paintSideBrand();
}

// The corner button opens a small menu of the tabs; picking one switches and closes it
const tabMenu = document.getElementById('tabMenu'), tabMenuBtn = document.getElementById('tabMenuBtn');
function setTabMenu(open) { tabMenu.hidden = !open; tabMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
tabMenuBtn.onclick = () => setTabMenu(tabMenu.hidden);
for (const b of document.querySelectorAll('.tabbtn')) b.onclick = () => { setTabMenu(false); showTab(b.dataset.tab); };
document.addEventListener('pointerdown', e => { if (!tabMenu.hidden && !e.target.closest('#tabbar')) setTabMenu(false); });
window.addEventListener('resize', () => { chooseAppLayout(); placeTabbar(); placeLens(); });
window.addEventListener('orientationchange', () => setTimeout(() => { chooseAppLayout(); placeTabbar(); placeLens(); }, 300));

// Start on the tab used last time
chooseAppLayout();
placeTabbar();
let startTab = 'playbook';
try { startTab = localStorage.getItem('penguins.tab') || 'playbook'; } catch { /* not critical */ }
showTab(startTab);
