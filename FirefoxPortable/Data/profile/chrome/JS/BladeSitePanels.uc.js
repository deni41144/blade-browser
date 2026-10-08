// ==UserScript==
// @name            Blade Site Panels
// @description     Native site permissions, connection details and fullscreen toolbar in the Blade material
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       120
// ==/UserScript==
(function () {
  if (window.BladeSitePanels) return;
  const root = document.documentElement;
  let disposed = false;
  const style = document.createElementNS('http://www.w3.org/1999/xhtml', 'style');
  style.id = 'blade-site-panels-style';
  // These selectors also match lazily instantiated native panel templates.
  // Native labels, warnings, commands and visibility conditions remain intact.
  style.textContent = `
    :root[data-blade-site-panels] :is(#permission-popup,#identity-popup,#notification-popup) {
      --blade-site-accent:var(--bob-accent,var(--accent,#ff2a2a));
      --panel-background-color:#141218 !important;
      --panel-color:#efeef4 !important;
      --panel-border-color:#ffffff24 !important;
      font-family:var(--blade-ui,'Rubik','Segoe UI',sans-serif) !important;
      color:#efeef4 !important;
    }
    :root[data-blade-site-panels] :is(#permission-popup,#identity-popup,#notification-popup)::part(content) {
      background:var(--blade-material,linear-gradient(155deg,#251a22,#111217)) !important;
      border:1px solid #ffffff24 !important;
      border-radius:15px !important;
      box-shadow:0 18px 48px #0009,inset 0 1px #ffffff10 !important;
      backdrop-filter:none !important;
    }
    :root[data-blade-site-panels] :is(#permission-popup,#identity-popup) :is(panelview,.panel-subview-body) {
      background:transparent !important;
    }
    :root[data-blade-site-panels] :is(#permission-popup,#identity-popup) .panel-header {
      padding:14px 14px 11px !important;
      border-bottom:1px solid #ffffff13 !important;
    }
    :root[data-blade-site-panels] :is(#permission-popup,#identity-popup) .panel-header span {
      font-size:13px !important; font-weight:600 !important;
      overflow-wrap:anywhere;
    }
    :root[data-blade-site-panels] #permission-popup .permission-popup-permission-item {
      margin:5px 9px !important; padding:10px 9px !important;
      border:1px solid #ffffff12 !important; border-radius:10px !important;
      background:#ffffff04 !important; min-height:38px;
      column-gap:8px;
    }
    :root[data-blade-site-panels] #permission-popup .permission-popup-permission-icon {
      width:18px !important; height:18px !important;
      fill:var(--blade-site-accent) !important; -moz-context-properties:fill;
      margin-inline-end:4px !important;
    }
    :root[data-blade-site-panels] #permission-popup .permission-popup-permission-label {
      font-size:12px !important; font-weight:500 !important;
    }
    :root[data-blade-site-panels] #permission-popup .permission-popup-permission-state-label {
      font-size:10px !important; color:#bbb5c3 !important;
      margin-inline:4px !important;
    }
    :root[data-blade-site-panels] #permission-popup .permission-popup-permission-remove-button {
      min-width:28px !important; min-height:28px !important;
      padding:5px !important; margin:0 !important;
      border:1px solid #ffffff1c !important; border-radius:7px !important;
      background:#ffffff06 !important; color:#ddd8e5 !important;
    }
    :root[data-blade-site-panels] #permission-popup .permission-popup-permission-remove-button:hover {
      background:color-mix(in srgb,var(--blade-site-accent) 14%,#222029) !important;
      border-color:color-mix(in srgb,var(--blade-site-accent) 45%,#ffffff22) !important;
    }
    :root[data-blade-site-panels] :is(#permission-popup,#identity-popup,#notification-popup) menulist {
      appearance:none !important; background:#ffffff08 !important;
      border:1px solid #ffffff24 !important; border-radius:8px !important;
      color:#efeef4 !important; padding:5px 8px !important;
      min-height:30px !important;
    }
    :root[data-blade-site-panels] :is(#permission-popup,#identity-popup) .subviewbutton {
      border-radius:9px !important; margin-inline:8px !important;
      padding:9px 10px !important;
    }
    :root[data-blade-site-panels] :is(#permission-popup,#identity-popup) .subviewbutton:hover {
      background:#ffffff09 !important;
    }
    :root[data-blade-site-panels] #identity-popup-security-button {
      border:1px solid #ffffff16 !important; background:#ffffff04 !important;
      margin-block:10px !important;
    }
    :root[data-blade-site-panels] :is(#permission-popup-permission-reload-hint,#permission-popup-storage-access-permission-list-hint) {
      color:#c0bac8 !important; font-size:11px !important; line-height:1.5;
      padding:8px 14px !important;
    }
    :root[data-blade-site-panels] #identity-popup-clear-sitedata-footer {
      background:#ffffff03 !important; border-top:1px solid #ffffff13 !important;
    }
    :root[data-blade-site-panels] #notification-popup .popup-notification-body-container {
      padding:17px !important;
    }
    :root[data-blade-site-panels] #notification-popup .popup-notification-description {
      font-size:12px !important; line-height:1.6 !important;
    }
    :root[data-blade-site-panels] #notification-popup .popup-notification-description-name {
      font-weight:600 !important;
    }
    :root[data-blade-site-panels] #notification-popup .panel-footer {
      background:#ffffff03 !important; border-top:1px solid #ffffff14 !important;
      padding:8px !important; gap:6px;
    }
    :root[data-blade-site-panels] #notification-popup moz-button {
      --button-border-radius:8px;
      --button-min-height:32px;
      --button-background-color:#ffffff09;
      --button-background-color-hover:#ffffff16;
      --button-background-color-primary:color-mix(in srgb,var(--blade-site-accent) 25%,#24202a);
      --button-background-color-primary-hover:color-mix(in srgb,var(--blade-site-accent) 38%,#24202a);
      --button-border-color-primary:color-mix(in srgb,var(--blade-site-accent) 60%,#ffffff26);
      --button-text-color:#f3eff7;
      --button-text-color-primary:#f3eff7;
    }
    :root[data-blade-site-panels] :is(#permission-popup,#identity-popup,#notification-popup) :is(button,toolbarbutton,menulist,moz-button):focus-visible {
      outline:2px solid var(--blade-site-accent) !important; outline-offset:2px;
    }
    /* Firefox controls margin-top and the top-edge toggler. Only animate the
       native geometry; DOM fullscreen (video etc.) keeps its native behavior. */
    :root[data-blade-site-panels][inFullscreen]:not([inDOMFullscreen]) #navigator-toolbox {
      transition:margin-top 170ms cubic-bezier(.2,.75,.25,1) !important;
    }
    :root[data-blade-site-panels][inFullscreen]:not([inDOMFullscreen]):not([fullscreenNavToolboxHidden]) #navigator-toolbox {
      box-shadow:0 8px 24px #0005 !important;
    }
    :root[data-blade-site-panels][data-blade-material-motion='off'][inFullscreen] #navigator-toolbox {
      transition:none !important;
    }
    @media (prefers-reduced-motion:reduce) {
      :root[data-blade-site-panels][inFullscreen] #navigator-toolbox {
        transition:none !important;
      }
    }
  `;
  document.documentElement.appendChild(style);
  // The existing userChrome USER !important transition cannot be overridden by
  // an AUTHOR style. Register only fullscreen geometry at the matching origin.
  const sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  const fullscreenCSS = `
    :root[data-blade-site-panels][inFullscreen]:not([inDOMFullscreen]) #navigator-toolbox {
      transition:margin-top 170ms cubic-bezier(.2,.75,.25,1) !important;
    }
    :root[data-blade-site-panels][data-blade-material-motion='off'][inFullscreen] #navigator-toolbox {
      transition:none !important;
    }
    @media (prefers-reduced-motion:reduce) {
      :root[data-blade-site-panels][inFullscreen] #navigator-toolbox { transition:none !important; }
    }
  `;
  // Unique ownership per window: unloading one window cannot unregister another's sheet.
  const fullscreenURI = Services.io.newURI('data:text/css;charset=utf-8,' +
    encodeURIComponent(fullscreenCSS + `\n/* BladeSitePanels ${Date.now()} ${Math.random()} */`));
  sss.loadAndRegisterSheet(fullscreenURI, sss.USER_SHEET);
  root.setAttribute('data-blade-site-panels', '');
  function destroy() {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('unload', destroy);
    style.remove();
    if (sss.sheetRegistered(fullscreenURI, sss.USER_SHEET)) sss.unregisterSheet(fullscreenURI, sss.USER_SHEET);
    root.removeAttribute('data-blade-site-panels');
  }
  window.BladeSitePanels = {
    destroy,
    status: () => ({ disposed, style:style.isConnected, fullscreenSheet:sss.sheetRegistered(fullscreenURI, sss.USER_SHEET),
      permissions:!!document.getElementById('permission-popup'),
      fullscreen:window.fullScreen, domFullscreen:root.hasAttribute('inDOMFullscreen') }),
  };
  window.addEventListener('unload', destroy, { once:true });
})();
