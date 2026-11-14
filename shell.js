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
};

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
}

for (const b of document.querySelectorAll('.tabbtn')) b.onclick = () => showTab(b.dataset.tab);
window.addEventListener('resize', () => { chooseAppLayout(); placeTabbar(); placeLens(); });
window.addEventListener('orientationchange', () => setTimeout(() => { chooseAppLayout(); placeTabbar(); placeLens(); }, 300));

// Start on the tab used last time
chooseAppLayout();
placeTabbar();
let startTab = 'playbook';
try { startTab = localStorage.getItem('penguins.tab') || 'playbook'; } catch { /* not critical */ }
showTab(startTab);
