// ==UserScript==
// @name            Blade Menu Signature
// @description     Engraved katana and a finite sheath-like menu reveal
// @include         main
// @version         1.1.0
// @loadOrder       123
// ==/UserScript==
(function () {
  if (window.BladeMenuSignature) return;
  const root = document.documentElement, marker = 'data-blade-menu-signature';
  const H = 'http://www.w3.org/1999/xhtml', S = 'http://www.w3.org/2000/svg';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, emblem = null, panel = null, timer = 0, mountObserver = null;
  const css = `
    @media(forced-colors:none) {
      :root[OWNED] #bobliks-settings-button {animation:none!important;}
      :root[OWNED] #bobliks-settings-button::after {content:none!important;animation:none!important;}
      :root[OWNED] #bobliks-settings-button .toolbarbutton-icon {
        list-style-image:none!important;filter:none!important;animation:none!important;
        transform:none!important;border:1px solid color-mix(in srgb,var(--accent,#ff2a2a) 28%,#ffffff12)!important;
        background:linear-gradient(160deg,#ffffff06,#00000012)!important;
        box-shadow:inset 0 1px #ffffff09!important;border-radius:7px!important;
      }
      :root[OWNED] #bobliks-settings-button:is(:hover,[open]) .toolbarbutton-icon {
        filter:none!important;background:color-mix(in srgb,var(--accent,#ff2a2a) 8%,#19171e)!important;
        border-color:color-mix(in srgb,var(--accent,#ff2a2a) 48%,#ffffff18)!important;
      }
      :root[OWNED] #bobliks-settings-button:active .toolbarbutton-icon {background:#111015!important;}
      :root[OWNED] #blade-menu-emblem {
        position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        pointer-events:none;color:var(--accent,#ff2a2a);
      }
      :root[OWNED] #blade-menu-emblem svg {width:25px;height:25px;overflow:visible;}
      :root[OWNED] #blade-menu-emblem .blade-steel {fill:color-mix(in srgb,var(--accent,#ff2a2a) 20%,#d7d8df);}
      :root[OWNED] #blade-menu-emblem .blade-edge {fill:#f0edf4;}
      :root[OWNED] #blade-menu-emblem .blade-wrap {stroke:color-mix(in srgb,var(--accent,#ff2a2a) 45%,#ddd);}
      /* Replace the previous generic scale entrance for B only. Native panel
         position/hit testing and all other panel entrances remain untouched. */
      :root[OWNED][data-blade-theme] #bobliks-settings-popup .bp-wrap {animation:none!important;}
      :root[OWNED][data-blade-material-motion=on] #bobliks-settings-popup[data-blade-signature-entry] .bp-wrap {
        animation:blade-sheath-reveal 540ms cubic-bezier(.25,.45,.25,1) both!important;
      }
      :root[OWNED] #bobliks-settings-popup .bp-wrap::after {
        content:'';position:absolute;inset:0;pointer-events:none;z-index:10;opacity:0;
        background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--bob-accent,#ff2a2a) 22%,transparent) 36%,#f1eaf6b8 50%,color-mix(in srgb,var(--bob-accent,#ff2a2a) 28%,transparent) 58%,transparent);
        background-size:30px 100%;background-repeat:no-repeat;
      }
      :root[OWNED][data-blade-material-motion=on] #bobliks-settings-popup[data-blade-signature-entry] .bp-wrap::after {
        animation:blade-menu-pass 540ms cubic-bezier(.25,.45,.25,1) both;
      }
      :root[OWNED] #bobliks-settings-popup .bp-head::after {
        content:'';position:absolute;left:16px;right:16px;bottom:6px;height:1px;
        background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--bob-accent,#ff2a2a) 55%,#eee),transparent);
        pointer-events:none;opacity:0;
      }
      :root[OWNED][data-blade-material-motion=on] #bobliks-settings-popup[data-blade-signature-entry] .bp-head::after {
        animation:blade-edge-reveal 600ms ease-out both;
      }
      @keyframes blade-sheath-reveal {
        0% {clip-path:polygon(100% 0,100% 0,100% 100%,100% 100%);}
        52% {clip-path:polygon(38% 0,100% 0,100% 100%,52% 100%);}
        100% {clip-path:polygon(0 0,100% 0,100% 100%,0 100%);}
      }
      @keyframes blade-edge-reveal {
        0%,15% {opacity:0;transform:scaleX(.08);transform-origin:right;}
        65% {opacity:.85;transform:scaleX(1);transform-origin:right;}
        100% {opacity:0;transform:scaleX(1);}
      }
      @keyframes blade-menu-pass {
        0% {opacity:0;background-position:110% 0;}
        12% {opacity:.9;}
        78% {opacity:.8;}
        100% {opacity:0;background-position:-10% 0;}
      }
      :root[OWNED][data-blade-material-motion=off] #bobliks-settings-popup[data-blade-signature-entry] .bp-wrap,
      :root[OWNED][data-blade-material-motion=off] #bobliks-settings-popup[data-blade-signature-entry] .bp-head::after,
      :root[OWNED][data-blade-material-motion=off] #bobliks-settings-popup[data-blade-signature-entry] .bp-wrap::after,
      :root[OWNED][data-blade-fx-mode=eco] #bobliks-settings-popup[data-blade-signature-entry] .bp-wrap,
      :root[OWNED][data-blade-fx-mode=eco] #bobliks-settings-popup[data-blade-signature-entry] .bp-wrap::after,
      :root[OWNED][data-blade-fx-mode=eco] #bobliks-settings-popup[data-blade-signature-entry] .bp-head::after {animation:none!important;clip-path:none!important;}
      @media(prefers-reduced-motion:reduce) {
        :root[OWNED][data-blade-material-motion] #bobliks-settings-popup[data-blade-signature-entry] .bp-wrap,
        :root[OWNED][data-blade-material-motion] #bobliks-settings-popup[data-blade-signature-entry] .bp-wrap::after,
        :root[OWNED][data-blade-material-motion] #bobliks-settings-popup[data-blade-signature-entry] .bp-head::after {animation:none!important;clip-path:none!important;}
      }
    }
    @media(forced-colors:active) {:root[OWNED] #blade-menu-emblem {display:none;}}
  `.replaceAll('[OWNED]', '[' + marker + ']');
  const service = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  const uri = Services.io.newURI('data:text/css;charset=UTF-8,' + encodeURIComponent('@-moz-document url("chrome://browser/content/browser.xhtml"){' + css + '}'));
  if (!service.sheetRegistered(uri,service.USER_SHEET)) service.loadAndRegisterSheet(uri,service.USER_SHEET);
  root.setAttribute(marker,'true');
  function shape(tag, attrs, parent) {
    const node = document.createElementNS(S,tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    parent.append(node);return node;
  }
  function mount() {
    if (disposed || emblem) return;
    const button = document.getElementById('bobliks-settings-button');
    if (!button) return;
    emblem = document.createElementNS(H,'span');emblem.id='blade-menu-emblem';emblem.setAttribute('aria-hidden','true');
    const svg = shape('svg',{viewBox:'0 0 24 24'},emblem);
    const g = shape('g',{transform:'rotate(-45 12 12)'},svg);
    shape('path',{d:'M2 10.8H6.7V13.2H2Z',fill:'#312d37',stroke:'currentColor','stroke-width':'.6'},g);
    shape('path',{d:'M2.7 11.1L4 12L2.7 12.9M4.3 11.1L5.6 12L4.3 12.9',fill:'none',class:'blade-wrap','stroke-width':'.55'},g);
    shape('path',{d:'M7.7 8.8H8.9V15.2H7.7Z',fill:'currentColor'},g);
    shape('path',{d:'M10 10.9Q15.7 10.15 22.4 10.6L20.2 13.05H10Z',class:'blade-steel'},g);
    shape('path',{d:'M10 12.5H20.6L22.4 10.6L20.2 13.05H10Z',class:'blade-edge'},g);
    shape('path',{d:'M10.1 10.9Q16 10.2 22.1 10.6',fill:'none',stroke:'currentColor','stroke-width':'.5'},g);
    button.append(emblem);
    mountObserver?.disconnect();mountObserver=null;
    window.Blade?.mark('menu_signature','v1.1.0 OK mounted');
  }
  function clear() {
    if (timer) clearTimeout(timer);timer=0;
    panel?.removeAttribute('data-blade-signature-entry');panel=null;
  }
  function shown(event) {
    if (event.target.id !== 'bobliks-settings-popup') return;
    clear();
    if (disposed || motion.matches || document.hidden || !window.BladeEffects?.canAnimate() || root.getAttribute('data-blade-material-motion') !== 'on') return;
    panel=event.target;panel.setAttribute('data-blade-signature-entry','true');
    timer=setTimeout(clear,660);
  }
  function hidden(event) {
    if (event.target !== panel || ['open','showing'].includes(event.target.state)) return;
    clear();
  }
  mount();
  // MenuButton can mount through its late startup fallback. Observe only its
  // native toolbar until that one insertion, then disconnect immediately.
  if (!emblem) {
    const nav=document.getElementById('nav-bar');
    if (nav) {mountObserver=new MutationObserver(mount);mountObserver.observe(nav,{childList:true,subtree:true});}
  }
  document.addEventListener('popupshown',shown,true);
  document.addEventListener('popuphidden',hidden,true);
  motion.addEventListener('change',clear);
  function destroy() {
    if (disposed) return;disposed=true;clear();
    mountObserver?.disconnect();mountObserver=null;
    document.removeEventListener('popupshown',shown,true);document.removeEventListener('popuphidden',hidden,true);
    motion.removeEventListener('change',clear);window.removeEventListener('unload',destroy);
    emblem?.remove();emblem=null;root.removeAttribute(marker);
  }
  window.addEventListener('unload',destroy,{once:true});
  window.BladeMenuSignature={destroy,status:()=>({disposed,mounted:!!emblem?.isConnected,active:!!panel,timer:!!timer})};
  if (!emblem) window.Blade?.mark('menu_signature','v1.1.0 waiting for B');
})();
