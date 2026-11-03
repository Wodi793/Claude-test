/* Penguins — the app shell (Stage 2): tabs and the floating tab switcher.

   How tabs work: each tab is a <div id="tab-NAME" class="tab"> in index.html with a
   matching button in #tabbar. Switching only shows/hides them — nothing reloads or
   resets, so the Playbook keeps its drawing and (later) the game clock keeps running.
   To add a tab (e.g. Stats): add the section + button in index.html, and if it needs
   to react when shown, add a function to TAB_SHOWN below. */
'use strict';

const App = {
  tab: 'playbook',
};

/** Optional per-tab code to run when a tab is shown. */
const TAB_SHOWN = {
  playbook: () => requestRender(),   // repaint the court (cheap; nothing is reset)
};

function showTab(name) {
  if (!document.getElementById('tab-' + name)) return;
  App.tab = name;
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
window.addEventListener('resize', () => { placeTabbar(); placeLens(); });

// Start on the tab used last time
placeTabbar();
let startTab = 'playbook';
try { startTab = localStorage.getItem('penguins.tab') || 'playbook'; } catch { /* not critical */ }
showTab(startTab);
