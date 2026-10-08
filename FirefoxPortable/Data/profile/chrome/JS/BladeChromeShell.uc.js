// ==UserScript==
// @name            Blade Chrome Shell
// @description     Matte navigation controls and theme-aware native focus
// @author          Blade-Creations
// @include         main
// @version         1.1.0
// @loadOrder       121
// ==/UserScript==
(function () {
  if (window.BladeChromeShell) return;
  const root = document.documentElement;
  const marker = 'data-blade-chrome-shell';
  let disposed = false;
  // The URL input container has its own native breakout outline. Painting
  // only .urlbar-background leaves Firefox's platform focus colour on top.
  // Keep both focus surfaces theme-aware without altering breakout geometry.
  const css = `
    @media (forced-colors: none) {
      :root[OWNED][data-blade-theme] #navigator-toolbox > #nav-bar {
        background-color:#111014 !important;
        background-image:
          linear-gradient(180deg,rgba(255,255,255,.085),transparent 2px,transparent 46%,rgba(0,0,0,.26)),
          linear-gradient(112deg,rgba(255,255,255,.025),transparent 27%,rgba(0,0,0,.14) 68%),
          var(--blade-material,linear-gradient(180deg,#21191c,#121114)) !important;
        border-color:color-mix(in srgb,var(--accent,#ff2a2a) 28%,#343037) !important;
        box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -1px rgba(0,0,0,.7),0 2px 6px rgba(0,0,0,.28) !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar #urlbar {
        --focus-outline-color:color-mix(in srgb,var(--accent,#ff2a2a) 75%,#ddd) !important;
        --toolbar-field-border-color-focus:color-mix(in srgb,var(--accent,#ff2a2a) 75%,#ddd) !important;
        --urlbar-background-outline-focused:none !important;
        --urlbar-input-container-outline-breakout-focused:1px solid color-mix(in srgb,var(--accent,#ff2a2a) 75%,#ddd) !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar #urlbar .urlbar-background {
        background-color:#100f13 !important;
        background-image:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.006) 46%,rgba(0,0,0,.17)) !important;
        border:1px solid rgba(220,211,225,.19) !important;
        border-radius:11px !important;
        box-shadow:inset 0 1px rgba(255,255,255,.045),inset 0 -1px rgba(0,0,0,.6),0 1px 1px rgba(0,0,0,.36) !important;
        animation:none !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar #urlbar .urlbar-input-container {
        border-radius:11px !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar #urlbar[focused] .urlbar-background {
        border-color:color-mix(in srgb,var(--accent,#ff2a2a) 75%,#ddd) !important;
        outline:none !important;
        box-shadow:0 0 0 1px color-mix(in srgb,var(--accent,#ff2a2a) 14%,transparent),0 2px 9px rgba(0,0,0,.4),inset 0 1px rgba(255,255,255,.08) !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar #urlbar[focused] .urlbar-input-container {
        outline:1px solid color-mix(in srgb,var(--accent,#ff2a2a) 75%,#ddd) !important;
        outline-offset:-1px !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar #urlbar::after,
      :root[OWNED][data-blade-theme] #nav-bar #urlbar .urlbar-background::after {
        /* Existing animated focus decoration is replaced by a single clear rim. */
        content:none !important;
        animation:none !important;
      }
      /* One quiet row: the chassis carries the material, not individual keys.
         Transparent borders retain the old face geometry without visible boxes. */
      :root[OWNED][data-blade-theme] #nav-bar .toolbarbutton-1:not(#bobliks-settings-button):not(#blade-account-switcher) {
        background:none !important;
        box-shadow:none !important;
        border-color:transparent !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar .toolbarbutton-1:not(#bobliks-settings-button):not(#blade-account-switcher) > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {
        border:1px solid transparent !important;
        border-radius:7px !important;
        background-color:transparent !important;
        background-image:none !important;
        box-shadow:none !important;
        transition:background-color 110ms ease-out,box-shadow 110ms ease-out !important;
        transform:none !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar .toolbarbutton-1:not(#bobliks-settings-button):not(#blade-account-switcher):not([disabled]):is(:hover,[open],[checked]) > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {
        background-color:color-mix(in srgb,var(--accent,#ff2a2a) 9%,#211c24) !important;
        border-color:transparent !important;
        box-shadow:inset 0 1px rgba(255,255,255,.045) !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar .toolbarbutton-1:not(#bobliks-settings-button):not(#blade-account-switcher):not([disabled]):active > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {
        background-color:rgba(0,0,0,.23) !important;
        box-shadow:inset 0 1px 2px rgba(0,0,0,.25) !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar .toolbarbutton-1:not(#bobliks-settings-button):not(#blade-account-switcher)[disabled] > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {
        opacity:.4 !important;
        border-color:transparent !important;
        background-color:transparent !important;
        box-shadow:none !important;
      }
      :root[OWNED][data-blade-theme] #nav-bar .toolbarbutton-1:not(#bobliks-settings-button):not(#blade-account-switcher):focus-visible {
        outline:1px solid color-mix(in srgb,var(--accent,#ff2a2a) 75%,#ddd) !important;
        outline-offset:-2px !important;
        border-radius:7px !important;
      }
      /* Keep native hitboxes, drag regions, close semantics and window glyphs. */
      :root[OWNED][data-blade-theme] .titlebar-button {
        border-radius:6px !important;
        background-color:rgba(16,14,19,.34) !important;
        background-image:linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.01) 48%,rgba(0,0,0,.14)) !important;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.045),inset 0 1px rgba(255,255,255,.07),inset 0 -1px rgba(0,0,0,.25) !important;
      }
      :root[OWNED][data-blade-theme] .titlebar-button:hover {
        background-color:rgba(255,255,255,.07) !important;
        box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -1px rgba(0,0,0,.3) !important;
      }
      :root[OWNED][data-blade-theme] .titlebar-button:active {
        background-color:rgba(255,255,255,.12) !important;
        box-shadow:inset 0 1px 3px rgba(0,0,0,.45) !important;
      }
      :root[OWNED][data-blade-theme] .titlebar-close:hover {
        background-color:#bb2438 !important;
        color:#fff !important;
      }
      :root[OWNED][data-blade-theme] :is(#alltabs-button,#tabs-newtab-button,#new-tab-button) > :is(.toolbarbutton-badge-stack,.toolbarbutton-icon) {
        border-radius:7px !important;
        background:linear-gradient(180deg,rgba(255,255,255,.065),rgba(0,0,0,.1)),rgba(16,14,19,.3) !important;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),inset 0 1px rgba(255,255,255,.07) !important;
      }
      :root[OWNED][data-blade-theme] :is(#alltabs-button,#tabs-newtab-button,#new-tab-button):hover > :is(.toolbarbutton-badge-stack,.toolbarbutton-icon) {
        background-color:rgba(255,255,255,.075) !important;
      }
      @media (prefers-reduced-motion: reduce) {
        :root[OWNED][data-blade-theme] #nav-bar .toolbarbutton-1:not(#bobliks-settings-button):not(#blade-account-switcher) > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {transition:none !important;}
      }
      :root[OWNED][data-blade-material-motion="off"] #nav-bar .toolbarbutton-1:not(#bobliks-settings-button):not(#blade-account-switcher) > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {transition:none !important;}
    }
  `.replaceAll('[OWNED]', '[' + marker + ']');
  const service = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  const uri = Services.io.newURI('data:text/css;charset=UTF-8,' + encodeURIComponent(
    '@-moz-document url("chrome://browser/content/browser.xhtml") {' + css + '}'));
  // Shared across browser windows; ownership removal makes the cached sheet inert.
  if (!service.sheetRegistered(uri,service.USER_SHEET)) service.loadAndRegisterSheet(uri,service.USER_SHEET);
  root.setAttribute(marker,'true');
  function destroy() {
    if (disposed) return;
    disposed = true;
    root.removeAttribute(marker);
    window.removeEventListener('unload',destroy);
  }
  window.addEventListener('unload',destroy,{once:true});
  window.BladeChromeShell = {destroy,status:()=>({disposed,owned:root.hasAttribute(marker),sheet:service.sheetRegistered(uri,service.USER_SHEET)})};
  window.Blade?.mark('chrome_shell','v1.1.0 OK');
})();
