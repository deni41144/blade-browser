// ==UserScript==
// @name            Blade Guard
// @description     Watchdog: never let the shell revert to stock Firefox look
// @author          Bobliks-Creations
// @include         main
// @version         1.0.0
// @loadOrder       90
// ==/UserScript==
(function () {
  if (window.BladeGuard) return;
  const root = document.documentElement;
  const THEME_PREFS = ['red','blood','purple','green','grey','white','orange','cherry','midnight','volt','custom'];
  let disposed = false, timer = 0, reapplies = 0;

  function prefTheme() {
    for (const id of THEME_PREFS) {
      try { if (Services.prefs.getBoolPref('bobliks.theme.' + id, false)) return id === 'red' ? 'blood' : id; } catch (e) {}
    }
    return 'blood';
  }
  function wireExtensions() {
    const eb = document.getElementById('unified-extensions-button');
    if (!eb || eb.__bladeExtWired) return;
    eb.__bladeExtWired = true;
    eb.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = document.getElementById('unified-extensions-panel');
      if (!p) return;
      p.hidden = false;
      if (p.state !== 'open') {
        try { if (typeof eb.doCommand === 'function') eb.doCommand(); else p.openPopup(eb); } catch (err) {}
        if (p.state !== 'open') { try { p.openPopup(eb); } catch (err) {} }
      }
    }, true);
  }
  function check() {
    if (disposed || window.closed) return;
    wireExtensions();
    // 1. Theme attribute dropped (stock revert) -> re-apply from prefs.
    if (!root.hasAttribute('data-blade-theme')) {
      try { window.BladeEngine?.setTheme(prefTheme()); reapplies++; } catch (e) {}
    }
    // 2. userChrome/userContent stylesheets disabled -> re-enable.
    try {
      if (!Services.prefs.getBoolPref('toolkit.legacyUserProfileCustomizations.stylesheets', false)) {
        Services.prefs.setBoolPref('toolkit.legacyUserProfileCustomizations.stylesheets', true); reapplies++;
      }
    } catch (e) {}
    // 3. Chrome-shell ownership marker lost -> re-assert theme (engine re-applies shell).
    if (!root.hasAttribute('data-blade-chrome-shell') && root.hasAttribute('data-blade-theme')) {
      try { window.BladeEngine?.setTheme(root.getAttribute('data-blade-theme')); reapplies++; } catch (e) {}
    }
  }
  function onFocus() { check(); }
  timer = window.setInterval(check, 4000);
  window.addEventListener('focus', onFocus, true);
  window.addEventListener('unload', () => {
    disposed = true; window.clearInterval(timer);
    window.removeEventListener('focus', onFocus, true);
  }, { once: true });
  check();
  window.BladeGuard = Object.freeze({
    check,
    status: () => Object.freeze({ disposed, reapplies, theme: root.getAttribute('data-blade-theme') })
  });
})();