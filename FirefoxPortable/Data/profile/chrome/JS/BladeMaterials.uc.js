// ==UserScript==
// @name            Blade Materials
// @description     Theme surfaces, anchored menu entrance and address focus
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       95
// ==/UserScript==
(function () {
  if (window.BladeMaterials) return;
  const root = document.documentElement;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Map();
  let lastPointer = null;
  let disposed = false;
  // Only chrome surfaces receive these textures. Wallpapers and page content
  // deliberately have no selector here; the accent is confined to edges.
  const textures = {
    red: 'linear-gradient(118deg,transparent 35%,rgba(255,255,255,.055) 35.3%,transparent 36%),linear-gradient(180deg,#21191c,#121114)',
    blood: 'linear-gradient(112deg,transparent 19%,rgba(206,139,148,.09) 20%,transparent 22%),linear-gradient(180deg,#25161d 0%,#170e14 45%,#1e1018 70%,#100d12 100%)',
    grey: 'repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0px,rgba(255,255,255,.018) 1px,transparent 1px,transparent 3px),linear-gradient(170deg,#303238,#1c1e22 45%,#27292e 70%,#16181b)',
    midnight: 'radial-gradient(ellipse at 76% 0%,rgba(110,146,192,.08),transparent 58%),linear-gradient(180deg,#17202d,#101620 45%,#111823)',
    volt: 'repeating-linear-gradient(135deg,transparent 0px,transparent 18px,rgba(211,211,131,.025) 18px,rgba(211,211,131,.025) 19px),linear-gradient(180deg,#20211a,#121510)',
    cherry: 'linear-gradient(130deg,transparent 20%,rgba(220,162,190,.06) 45%,transparent 65%),linear-gradient(180deg,#281b24,#18121a)',
    orange: 'repeating-linear-gradient(90deg,transparent 0px,transparent 5px,rgba(190,157,120,.018) 5px,rgba(190,157,120,.018) 6px),linear-gradient(180deg,#28211b,#171511)',
    green: 'repeating-linear-gradient(0deg,transparent 0px,transparent 5px,rgba(130,193,155,.02) 5px,rgba(130,193,155,.02) 6px),linear-gradient(180deg,#19241f,#101813)',
    purple: 'linear-gradient(154deg,transparent 39%,rgba(193,168,217,.07) 40%,transparent 41%),linear-gradient(28deg,#181420,#241c2f 55%,#14111c)',
    custom: 'linear-gradient(120deg,transparent 30%,rgba(255,255,255,.055) 47%,transparent 60%),linear-gradient(180deg,#23252a,#14161b)',
  };
  const themed = Object.entries(textures).map(([theme, texture]) =>
    `:root[data-blade-theme="${theme}"] { --blade-material: ${texture}; }`).join('\n');
  const style = document.createElementNS('http://www.w3.org/1999/xhtml', 'style');
  style.id = 'blade-material-style';
  style.textContent = `${themed}
    :root { --blade-material: ${textures.red}; }
    :root[data-blade-theme] #nav-bar,
    :root[data-blade-theme] .tabbrowser-tab[selected] .tab-background {
      background-image:var(--blade-material) !important;
      background-color:#15161a !important;
    }
    :root[data-blade-theme] #nav-bar {
      box-shadow:inset 0 1px rgba(255,255,255,.065),inset 0 -1px rgba(0,0,0,.6) !important;
    }
    :root[data-blade-theme] .tabbrowser-tab[selected] .tab-background {
      border-bottom-color:transparent !important;
      border-radius:8px 8px 0 0 !important;
      box-shadow:inset 0 1px rgba(255,255,255,.13),inset 1px 0 rgba(255,255,255,.045),inset -1px 0 rgba(0,0,0,.3) !important;
    }
    :root[data-blade-theme] #bobliks-settings-popup::part(content),
    :root[data-blade-theme] panel .panel-subview-body,
    :root[data-blade-theme] .urlbarView {
      background-image:var(--blade-material) !important;
      background-color:#121317 !important;
    }
    :root[data-blade-theme] #bobliks-settings-popup::part(content) {
      box-shadow:0 16px 38px rgba(0,0,0,.65),inset 0 1px rgba(255,255,255,.13),inset 0 -1px rgba(0,0,0,.5) !important;
    }
    :root[data-blade-theme] #nav-bar .toolbarbutton-1:not([disabled]) > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {
      border:1px solid rgba(255,255,255,.065) !important;
      background-image:linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.01) 48%,rgba(0,0,0,.14)) !important;
      box-shadow:inset 0 1px rgba(255,255,255,.08),0 1px 1px rgba(0,0,0,.25) !important;
      transition:transform 100ms ease-out !important;
    }
    :root[data-blade-theme] #nav-bar .toolbarbutton-1:not([disabled]):active > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {
      transform:translateY(1px) scale(.96) !important;
    }
    :root[data-blade-theme] #nav-bar .toolbarbutton-1[disabled] > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {
      opacity:.45 !important;
    }
    :root[data-blade-theme] #urlbar[focused] .urlbar-background {
      animation:none !important;
      box-shadow:0 2px 8px rgba(0,0,0,.35),inset 0 1px rgba(255,255,255,.09) !important;
    }
    :root[data-blade-theme] #urlbar::after {
      transform-origin:var(--blade-focus-origin,50%) center !important;
    }
    :root[data-blade-theme] #urlbar[data-blade-focus-entry] .urlbar-background::after {
      content:''; position:absolute; inset:-1px; border-radius:inherit;
      border:1px solid color-mix(in srgb,var(--accent) 65%,#ddd);
      pointer-events:none; transform-origin:var(--blade-focus-origin,50%) center;
      animation:blade-material-focus 320ms cubic-bezier(.2,.75,.25,1) both;
    }
    :root[data-blade-theme] #urlbar[data-blade-view-entry] .urlbarView {
      transform-origin:var(--blade-focus-origin,50%) top;
      animation:blade-material-results 200ms ease-out both !important;
    }
    :root[data-blade-theme] .urlbarView-row[selected] {
      background:color-mix(in srgb,var(--accent) 13%,#202229) !important;
      box-shadow:inset 3px 0 var(--accent),inset 0 1px rgba(255,255,255,.07) !important;
    }
    :root[data-blade-theme] [data-blade-menu-entry] :is(.bp-wrap,panelmultiview),
    :root[data-blade-theme] menupopup[data-blade-menu-entry]::part(content) {
      transform-origin:var(--blade-menu-x,50%) var(--blade-menu-y,0px) !important;
      animation:blade-material-menu 220ms cubic-bezier(.16,.8,.3,1) both !important;
    }
    @keyframes blade-material-menu {
      from { opacity:.3; transform:translateY(-5px) scale(.965); }
      to { opacity:1; transform:none; }
    }
    @keyframes blade-material-focus {
      0% { opacity:0; transform:scaleX(.08); }
      65% { opacity:.9; transform:scaleX(1); }
      100% { opacity:0; transform:scaleX(1); }
    }
    @keyframes blade-material-results {
      from { opacity:.3; transform:translateY(-4px) scaleY(.98); }
      to { opacity:1; transform:none; }
    }
    :root[data-blade-material-motion="off"] :is([data-blade-menu-entry] .bp-wrap,[data-blade-menu-entry] panelmultiview,menupopup[data-blade-menu-entry]::part(content),#urlbar[data-blade-view-entry] .urlbarView,#urlbar[data-blade-focus-entry] .urlbar-background::after,#urlbar::after) {
      animation:none !important; transition:none !important;
    }
    :root[data-blade-material-motion="off"] #nav-bar .toolbarbutton-1 > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {
      transition:none !important; transform:none !important;
    }
  `;
  root.appendChild(style);
  // XUL's existing userChrome rules are USER !important. Mirror only the
  // stationary XUL material rules at that origin; HTML interaction rules
  // continue to use the window's AUTHOR style. One process-wide sheet stays
  // cached, but is inert in any window without our ownership marker.
  const service = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  const stationary = style.textContent.slice(
    style.textContent.indexOf(':root[data-blade-theme] #nav-bar'),
    style.textContent.indexOf(':root[data-blade-theme] #urlbar[focused]'));
  const userCSS = (`${themed}\n${stationary}\n
    :root[data-blade-material-motion="off"] #nav-bar .toolbarbutton-1 > :is(.toolbarbutton-icon,.toolbarbutton-badge-stack) {
      transition:none !important; transform:none !important;
    }`).replaceAll(':root[data-blade-theme', ':root[data-blade-materials][data-blade-theme')
      .replaceAll(':root[data-blade-material-motion', ':root[data-blade-materials][data-blade-material-motion');
  const userURI = Services.io.newURI('data:text/css;charset=UTF-8,' + encodeURIComponent(
    '@-moz-document url("chrome://browser/content/browser.xhtml") {\n' + userCSS + '\n}'));
  if (!service.sheetRegistered(userURI,service.USER_SHEET)) service.loadAndRegisterSheet(userURI,service.USER_SHEET);
  root.setAttribute('data-blade-materials','true');
  function allowed() {
    return !disposed && !motionQuery.matches && !document.hidden &&
      !!window.BladeEffects?.canAnimate();
  }
  function clearEntry(node) {
    const timer = timers.get(node);
    if (timer) clearTimeout(timer);
    timers.delete(node);
    node.removeAttribute('data-blade-menu-entry');
    node.removeAttribute('data-blade-focus-entry');
    node.removeAttribute('data-blade-view-entry');
  }
  function entry(node, attr, delay) {
    if (!allowed()) return;
    const old = timers.get(node);
    if (old) clearTimeout(old);
    node.setAttribute(attr, 'true');
    timers.set(node, setTimeout(() => clearEntry(node), delay));
  }
  function sync() {
    root.setAttribute('data-blade-material-motion', allowed() ? 'on' : 'off');
    if (!allowed()) for (const node of [...timers.keys()]) clearEntry(node);
  }
  function pointer(event) {
    lastPointer = { x:event.screenX, y:event.screenY, time:Date.now() };
    const bar = event.target.closest?.('#urlbar');
    if (bar) {
      const rect = bar.getBoundingClientRect();
      bar.style.setProperty('--blade-focus-origin', `${Math.max(0, Math.min(100, (event.clientX-rect.left)/Math.max(1,rect.width)*100))}%`);
    }
  }
  function keyboard() {
    lastPointer = null;
    document.getElementById('urlbar')?.style.setProperty('--blade-focus-origin', '50%');
  }
  function popupShown(event) {
    const popup = event.target;
    if (!popup.matches?.('panel,menupopup') || !allowed()) return;
    const rect = popup.getBoundingClientRect();
    let x = rect.width/2;
    let y = 0;
    if (lastPointer && Date.now()-lastPointer.time < 1500) {
      x = lastPointer.x-window.mozInnerScreenX-rect.left;
      y = lastPointer.y-window.mozInnerScreenY-rect.top;
    } else {
      const anchor = popup.anchorNode;
      const a = anchor?.getBoundingClientRect?.();
      if (a) x = a.left+a.width/2-rect.left;
    }
    popup.style.setProperty('--blade-menu-x', `${Math.max(0,Math.min(rect.width,x))}px`);
    popup.style.setProperty('--blade-menu-y', `${Math.max(0,Math.min(rect.height,y))}px`);
    entry(popup, 'data-blade-menu-entry', 260);
  }
  function popupHidden(event) { clearEntry(event.target); }
  function focused(event) {
    const bar = event.target.closest?.('#urlbar');
    if (bar && !bar.contains(event.relatedTarget)) entry(bar, 'data-blade-focus-entry', 360);
  }
  function blurred(event) {
    const bar = event.target.closest?.('#urlbar');
    if (bar && !bar.contains(event.relatedTarget)) clearEntry(bar);
  }
  const bar = document.getElementById('urlbar');
  const observer = new MutationObserver(() => {
    if (bar?.hasAttribute('open')) entry(bar, 'data-blade-view-entry', 240);
  });
  if (bar) observer.observe(bar, { attributes:true, attributeFilter:['open'] });
  const bindings = [
    ['pointerdown',pointer], ['keydown',keyboard], ['popupshown',popupShown],
    ['popuphidden',popupHidden], ['focusin',focused], ['focusout',blurred],
  ];
  for (const [type, handler] of bindings) document.addEventListener(type,handler,true);
  motionQuery.addEventListener('change',sync);
  window.Blade?.bus.on('fx:changed',sync);
  sync();
  window.BladeMaterials = { version:'1.0.0', sync, active:() => timers.size };
  window.Blade?.mark('materials','v1.0.0 OK');
  window.addEventListener('unload', () => {
    disposed = true;
    for (const node of [...timers.keys()]) clearEntry(node);
    for (const [type,handler] of bindings) document.removeEventListener(type,handler,true);
    motionQuery.removeEventListener('change',sync);
    window.Blade?.bus.off('fx:changed',sync);
    observer.disconnect();
    style.remove();
    root.removeAttribute('data-blade-materials');
    root.removeAttribute('data-blade-material-motion');
  }, {once:true});
})();
