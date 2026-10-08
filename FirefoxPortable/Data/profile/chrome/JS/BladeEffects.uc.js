// ==UserScript==
// @name            Blade Effects
// @description     Режимы эффектов и остановка анимаций неактивного окна
// @author          Blade-Creations
// @include         main
// @version         1.1.0
// @loadOrder       6
// ==/UserScript==
(function () {
  if (window.BladeEffects) return;
  const PREF = 'blade.fx.mode';
  const MODES = ['vivid', 'balanced', 'eco'];
  const root = document.documentElement;
  const sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  const H = 'http://www.w3.org/1999/xhtml';
  let paused = false;
  let disposed = false;
  let syncTimer = 0;
  const mode = () => {
    const value = Services.prefs.getStringPref(PREF, 'vivid');
    return MODES.includes(value) ? value : 'vivid';
  };
  const battery = () => root.hasAttribute('data-blade-battery');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // USER sheet reaches the XUL toolbar; AUTHOR sheet reaches our HTML overlays.
  // Scope every rule to browser chrome or the two built-in new-tab pages.
  const STOP_ROOT = ':root:is([data-blade-fx-paused="true"], [data-blade-fx-mode="eco"], [data-blade-battery])';
  const decorative = ['#navigator-toolbox::before', '#navigator-toolbox::after', '#nav-bar::before', '#nav-bar::after', '#bobliks-settings-button::before',
    '#bobliks-settings-button::after', '#bobliks-settings-button .toolbarbutton-icon',
    '#urlbar::before', '#urlbar::after', '#urlbar-background::before', '#urlbar-background::after',
    '#urlbar[focused] .urlbar-background'];
  const CHROME_CSS = `
    @-moz-document url("chrome://browser/content/browser.xhtml") {
      ${decorative.map(selector => STOP_ROOT + ' ' + selector).join(',\n')} {
        animation-play-state: paused !important;
      }
    }`;
  const AUTHOR_CSS = `
    :root[data-blade-fx-paused="true"] #blade-hero-wrap *,
    :root[data-blade-fx-paused="true"] #blade-hero-wrap *::before,
    :root[data-blade-fx-paused="true"] #blade-hero-wrap *::after,
    :root[data-blade-fx-mode="eco"] #blade-hero-wrap *,
    :root[data-blade-fx-mode="eco"] #blade-hero-wrap *::before,
    :root[data-blade-fx-mode="eco"] #blade-hero-wrap *::after,
    :root[data-blade-battery] #blade-hero-wrap * {
      animation-play-state: paused !important;
    }
    :root[data-blade-fx-mode="eco"] #blade-atmosphere {display:none !important;}
    :root[data-blade-fx-paused="true"] #blade-idle {display:none !important;}
  `;
  const contentTargets = ['body::before', 'body::after', '.outer-wrapper::before', '.outer-wrapper::after',
    '.top-site-outer', '.top-site-outer::before', '.top-site-outer::after',
    '.top-site-button', '.tile', '.tile::before', '.tile::after'];
  const contentCss = prefix => `
    @-moz-document url("about:newtab"), url("about:home") {
      ${contentTargets.map(selector => prefix + selector).join(',\n')} {
        animation-play-state: paused !important;
      }
    }`;
  const uri = css => Services.io.newURI('data:text/css;charset=utf-8,' + encodeURIComponent(css));
  const chromeUri = uri(CHROME_CSS);
  const contentUri = uri(contentCss(''));
  const visibilityUri = uri(contentCss(':root[data-blade-fx-content-paused] '));
  const sheetRegistered = u => sss.sheetRegistered(u, sss.USER_SHEET);
  if (!sheetRegistered(chromeUri)) sss.loadAndRegisterSheet(chromeUri, sss.USER_SHEET);
  if (!sheetRegistered(visibilityUri)) sss.loadAndRegisterSheet(visibilityUri, sss.USER_SHEET);
  try {
    ChromeUtils.registerWindowActor('BladeEffectsVisibility', {
      parent:{esModuleURI:'chrome://userscripts/content/BladeEffectsVisibility/BladeEffectsVisibilityParent.sys.mjs'},
      child:{esModuleURI:'chrome://userscripts/content/BladeEffectsVisibility/BladeEffectsVisibilityChild.sys.mjs',
        events:{pageshow:{},visibilitychange:{}}},
      matches:['about:newtab','about:home'], allFrames:false,
    });
  } catch (e) {
    // Registration is process-wide: another browser window may have registered it.
    if (e.name !== 'NotSupportedError') window.Blade?.mark('effects_actor', String(e));
  }
  const style = document.createElementNS(H, 'style');
  style.id = 'blade-effects-style';
  style.textContent = AUTHOR_CSS;
  style.textContent += CHROME_CSS;
  root.appendChild(style);

  function state() { return {mode:mode(), paused, battery:battery()}; }
  function contentState() {
    const current = state();
    return {...current, reduced:reducedMotion.matches, paused:current.paused || current.mode === 'eco' || current.battery,
      theme:root.getAttribute('data-blade-theme') || 'red',
      accent:window.getComputedStyle(root).getPropertyValue('--accent').trim() || '#ff2a2a'};
  }
  function sync() {
    if (disposed) return;
    // Focus may be inside a remote document or the address bar. The active
    // top-level window is authoritative; chrome document focus alone is not.
    const activeWindow = Services.focus.activeWindow;
    paused = document.hidden || window.windowState === window.STATE_MINIMIZED ||
      (activeWindow ? activeWindow !== window : !document.hasFocus());
    root.setAttribute('data-blade-fx-mode', mode());
    root.setAttribute('data-blade-fx-paused', String(paused));
    const stopContent = mode() === 'eco' || battery();
    if (stopContent && !sheetRegistered(contentUri)) sss.loadAndRegisterSheet(contentUri, sss.USER_SHEET);
    if (!stopContent && sheetRegistered(contentUri)) sss.unregisterSheet(contentUri, sss.USER_SHEET);
    const visualState = contentState();
    for (const browser of window.gBrowser?.browsers || []) {
      if (!/^about:(newtab|home)(?:[?#]|$)/.test(browser.currentURI?.spec || '')) continue;
      try { browser.browsingContext.currentWindowGlobal.getActor('BladeEffectsVisibility')
        .sendAsyncMessage('Blade:PauseEffects', visualState); } catch (e) {}
    }
    window.Blade?.bus.emit('fx:changed', state());
  }
  function schedule(event) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 0);
  }
  const prefObserver = {observe:sync};
  const batteryObserver = new MutationObserver(sync);
  Services.prefs.addObserver(PREF, prefObserver);
  reducedMotion.addEventListener('change', sync);
  batteryObserver.observe(root, {attributes:true, attributeFilter:['data-blade-battery','data-blade-theme','style']});
  for (const name of ['focus', 'blur', 'sizemodechange', 'visibilitychange']) window.addEventListener(name, schedule, true);
  for (const name of ['TabSelect', 'TabShow']) window.gBrowser?.tabContainer.addEventListener(name, schedule);
  window.BladeEffects = {
    mode, state, contentState, refresh: sync,
    setMode(value) {
      if (!MODES.includes(value)) return false;
      Services.prefs.setStringPref(PREF, value);
      return true;
    },
    // Window effects call this at the event boundary; no transient DOM in sleeping windows.
    canAnimate: () => !paused && mode() !== 'eco' && !battery(),
  };
  sync();
  window.Blade?.mark('effects', 'v1.1.0 OK ' + mode());
  window.addEventListener('unload', () => {
    for (const name of ['TabSelect', 'TabShow']) window.gBrowser?.tabContainer.removeEventListener(name, schedule);
    disposed = true;
    clearTimeout(syncTimer);
    batteryObserver.disconnect();
    Services.prefs.removeObserver(PREF, prefObserver);
    reducedMotion.removeEventListener('change', sync);
    for (const name of ['focus', 'blur', 'sizemodechange', 'visibilitychange']) window.removeEventListener(name, schedule, true);
    // Process-wide sheets remain registered for other browser windows.
  }, {once:true});
})();
