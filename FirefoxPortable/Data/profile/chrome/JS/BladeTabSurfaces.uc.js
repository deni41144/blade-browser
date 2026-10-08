// ==UserScript==
// @name            Blade Tab Surfaces
// @description     Sculpted tab surfaces and theme details, preserving native tab operations
// @include         main
// @version         1.0.0
// @loadOrder       120
// ==/UserScript==
(function () {
  if (window.BladeTabSurfaces || !window.gBrowser) return;
  const root = document.documentElement, tabs = gBrowser.tabContainer;
  const ns = 'http://www.w3.org/1999/xhtml';
  const owned = new Set();
  let disposed = false;
  // These are crisp vector engravings, confined to the lower rim of each tab.
  // The custom constructor receives a neutral rim, not an invented theme effect.
  const drawings = {
    red: '<path d="M0 13H65L72 8H103L109 11H161L168 6H220M7 15H59M179 10H214"/>',
    blood: '<path fill="currentColor" stroke="none" d="M0 10C24 5 40 13 61 8S88 9 106 7S143 12 165 7S196 10 220 6V9C205 8 190 13 178 11C174 10 173 10 173 13V16H170V12C168 8 162 9 153 11C130 16 114 8 98 10C80 13 73 11 71 13V16H68V12C51 13 34 10 20 12L0 13Z"/><path d="M12 9Q28 6 44 10M107 8Q117 8 127 10" stroke="#ffb2b2" opacity=".5"/>',
    purple: '<path d="M0 13H34L49 3L66 13H115L132 5L150 13H220M34 13L49 10L66 13M115 13L132 11L150 13M49 3V10M132 5V11"/>',
    green: '<path d="M0 12H33V5H44V12H97V8H108V12H165V3H177V12H220M9 15H25M61 15H83M189 15H213"/><path d="M37 7H40M169 5H173" stroke-width="2"/>',
    grey: '<path d="M0 13H91M127 13H220M97 13L103 6M105 13L111 6M113 13L119 6"/><path d="M7 10H31M190 10H214" opacity=".4"/>',
    orange: '<path d="M0 13Q32 2 62 12T123 10T179 9T220 7M17 15Q40 9 59 14M146 13Q162 8 177 13"/><path fill="currentColor" stroke="none" d="M87 2L90 5L87 8L84 5ZM194 1L196 3L194 5L192 3Z"/>',
    cherry: '<path d="M0 13Q44 8 80 13T150 12T220 11"/><path fill="currentColor" stroke="none" d="M39 4Q50 0 49 8Q40 12 39 4ZM119 5Q126 0 130 6Q127 14 119 5ZM178 2Q188 0 186 7Q178 11 178 2Z"/>',
    midnight: '<path d="M0 13Q28 6 55 13T110 13T165 13T220 13M0 9Q28 2 55 9T110 9T165 9T220 9"/><path d="M172 2H174M195 4H197" opacity=".65"/>',
    volt: '<path d="M0 12H45L53 5L50 12H83L95 2L88 12H148L158 6L155 12H220" stroke-width="1.7"/><path d="M10 15H35M172 15H205" opacity=".5"/>',
    custom: '<path d="M0 13H220"/>'
  };
  const colors = {red:'#ff3c44',blood:'#ff252f',purple:'#b18bff',green:'#3ae897',grey:'#d9dee6',orange:'#ffa052',cherry:'#f798bb',midnight:'#81aaff',volt:'#f6ec73',custom:'#b7bdc8'};
  const art = Object.entries(drawings).map(([id, body]) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 16" preserveAspectRatio="none" color="${colors[id]}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
    return `:root[data-blade-tab-surfaces][data-blade-theme="${id}"] { --blade-tab-art:url("data:image/svg+xml,${encodeURIComponent(svg)}"); }`;
  }).join('\n');
  const css = (`
    ${art}
    :root[data-blade-tab-surfaces] #TabsToolbar { --tab-block-margin:3px; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab { padding-inline:3px !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-stack { transition:none !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab:not([closing]) .tab-stack,
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-content { transform:none !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-content { padding-inline:10px !important; overflow:visible !important; transition:none !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-background {
      position:relative !important; overflow:hidden !important;
      background-color:#14151b !important; background-image:linear-gradient(180deg,#ffffff05,transparent 60%) !important;
      border:1px solid #ffffff0e !important; border-bottom:1px solid #0005 !important;
      border-radius:10px !important; margin-block:3px !important;
      box-shadow:inset 0 1px #ffffff05 !important;
      animation:none !important; opacity:1 !important;
      transition:border-color 140ms ease,background-color 140ms ease !important;
    }
    :root[data-blade-tab-surfaces] .tabbrowser-tab:hover .tab-background {
      background-image:var(--blade-material) !important;
      border-color:color-mix(in srgb,var(--accent) 28%,#ffffff16) !important;
      box-shadow:inset 0 1px #ffffff12,0 2px 5px #0003 !important;
    }
    :root[data-blade-tab-surfaces] .tabbrowser-tab:is([selected],[visuallyselected]) .tab-background {
      background-image:linear-gradient(180deg,#ffffff05,transparent 50%),var(--blade-material) !important;
      border-color:color-mix(in srgb,var(--accent) 38%,#585462) !important;
      border-bottom-color:color-mix(in srgb,var(--accent) 55%,#24212c) !important;
      box-shadow:inset 0 1px #ffffff24,inset 1px 0 #ffffff07,0 2px 6px #0007 !important;
    }
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-background::before,
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-background::after,
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-content::before { content:none !important; animation:none !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-label { color:#b7b6c2 !important; font-weight:500 !important; text-shadow:none !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab:is([selected],[visuallyselected],:hover) .tab-label { color:#f3eff7 !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab:is([selected],[visuallyselected]) .tab-label { font-weight:650 !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab[pending] .tab-label { color:#9593a1 !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-icon-image { filter:none !important; border-radius:4px !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-close-button {
      filter:none !important; fill:currentColor !important; color:#aaa6b5 !important;
      border-radius:6px !important; opacity:.7 !important; padding:3px !important;
      transition:background-color 100ms ease,color 100ms ease !important;
    }
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-close-button:hover { color:#fff !important; background-color:color-mix(in srgb,var(--accent) 24%,#ffffff0a) !important; opacity:1 !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab .tab-audio-button { color:#f1edf5 !important; background-color:#ffffff0c !important; border-radius:5px !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab[dragtarget] { rotate:none !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab[dragtarget] .tab-background { border-color:var(--accent) !important; box-shadow:0 6px 16px #0008,inset 0 1px #ffffff24 !important; }
    :root[data-blade-tab-surfaces] .tabbrowser-tab[multiselected] .tab-background { border-color:color-mix(in srgb,var(--accent) 52%,#65616d) !important; }
    :root[data-blade-tab-surfaces] .blade-chrome-contour { display:none !important; }
    .blade-tab-detail,.blade-tab-glint,.blade-tab-audio { position:absolute; pointer-events:none; box-sizing:border-box; }
    .blade-tab-detail { left:8px;right:8px;bottom:0;height:9px;background-image:var(--blade-tab-art);background-size:100% 100%;opacity:0;transform:translateY(3px);transition:opacity 140ms ease,transform 180ms ease; }
    .tabbrowser-tab:is([selected],[visuallyselected]) .blade-tab-detail { opacity:.8;transform:none; }
    .tabbrowser-tab:hover .blade-tab-detail { opacity:1;transform:none; }
    .blade-tab-glint { inset:0;opacity:0;background:linear-gradient(115deg,transparent 30%,#ffffff0c 45%,#ffffff18 48%,transparent 60%);transform:translateX(-100%); }
    .tabbrowser-tab[data-blade-tab-entry] .blade-tab-glint { animation:blade-tab-polish 440ms ease-out both; }
    :root[data-blade-theme="blood"] .tabbrowser-tab[data-blade-tab-entry] .blade-tab-detail { animation:blade-tab-seep 450ms ease-out both;transform-origin:center bottom; }
    :root[data-blade-theme="volt"] .tabbrowser-tab[data-blade-tab-entry] .blade-tab-detail { animation:blade-tab-spark 450ms steps(1,end) both; }
    :root[data-blade-theme="green"] .tabbrowser-tab[data-blade-tab-entry] .blade-tab-detail { animation:blade-tab-scan 450ms ease-out both; }
    :root[data-blade-theme="cherry"] .tabbrowser-tab[data-blade-tab-entry] .blade-tab-detail { animation:blade-tab-petal 450ms ease-out both; }
    :root[data-blade-theme="custom"] .blade-tab-glint { display:none; }
    .blade-tab-audio { right:12px;bottom:2px;display:none;gap:2px;height:8px;align-items:end; }
    .blade-tab-audio i { display:block;width:2px;height:7px;background:var(--accent);border-radius:1px;transform-origin:bottom; }
    .blade-tab-audio i:nth-child(2) { height:5px;animation-delay:-180ms; }
    .blade-tab-audio i:nth-child(3) { height:8px;animation-delay:-320ms; }
    .tabbrowser-tab[soundplaying]:not([muted]) .blade-tab-audio { display:flex; }
    :root:not([data-blade-material-motion="off"]):not([data-blade-motion-static]) .tabbrowser-tab[soundplaying]:not([muted]) .blade-tab-audio i { animation:blade-tab-meter 850ms ease-in-out infinite alternate; }
    @keyframes blade-tab-polish { 0%{opacity:0;transform:translateX(-100%)}20%{opacity:1}100%{opacity:0;transform:translateX(100%)} }
    @keyframes blade-tab-seep { from{opacity:.25;transform:scaleY(.35)}to{opacity:1;transform:scaleY(1)} }
    @keyframes blade-tab-spark { 0%,30%,62%{opacity:.35}12%,44%,78%,100%{opacity:1} }
    @keyframes blade-tab-scan { from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)} }
    @keyframes blade-tab-petal { from{opacity:.3;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)} }
    @keyframes blade-tab-meter { from{transform:scaleY(.4)}to{transform:scaleY(1)} }
    :root[data-blade-material-motion="off"] :is(.blade-tab-detail,.blade-tab-glint,.blade-tab-audio i) { animation:none !important;transition:none !important; }
    @media(prefers-reduced-motion:reduce) { :is(.blade-tab-detail,.blade-tab-glint,.blade-tab-audio i) { animation:none !important;transition:none !important; } }
  `).replaceAll(':root[data-blade-tab-surfaces]', ':root[data-blade-tab-surfaces][data-blade-theme][data-blade-materials]');
  const style = document.createElementNS(ns,'style');
  style.id = 'blade-tab-surfaces-style'; style.textContent = css; root.append(style);
  // XUL tabs require USER origin to override existing userChrome !important.
  const service = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  const uri = Services.io.newURI('data:text/css;charset=UTF-8,'+encodeURIComponent('@-moz-document url("chrome://browser/content/browser.xhtml"){'+css+'}'));
  if (!service.sheetRegistered(uri,service.USER_SHEET)) service.loadAndRegisterSheet(uri,service.USER_SHEET);
  root.setAttribute('data-blade-tab-surfaces','true');
  function add(tab) {
    const background = tab.querySelector('.tab-background');
    if (!background || background.querySelector('.blade-tab-detail')) return;
    for (const name of ['detail','glint','audio']) {
      const node = document.createElementNS(ns,'span'); node.className = 'blade-tab-'+name;
      node.setAttribute('aria-hidden','true');
      if (name === 'audio') for (let i=0;i<3;i++) node.append(document.createElementNS(ns,'i'));
      background.append(node); owned.add(node);
    }
  }
  const entries = new Map();
  function clear(tab) { clearTimeout(entries.get(tab));entries.delete(tab);tab.removeAttribute('data-blade-tab-entry'); }
  function enter(tab) {
    clear(tab);
    if (root.getAttribute('data-blade-material-motion') === 'off' || matchMedia('(prefers-reduced-motion:reduce)').matches || document.hidden) return;
    tab.setAttribute('data-blade-tab-entry','true');
    entries.set(tab,setTimeout(()=>clear(tab),470));
  }
  function over(event) { const tab=event.target.closest?.('.tabbrowser-tab');if(tab&&!tab.contains(event.relatedTarget))enter(tab); }
  function selected(event) { add(event.target);enter(event.target); }
  function opened(event) { add(event.target); }
  function closed(event) {
    clear(event.target);
    for(const node of [...owned])if(event.target.contains(node)){node.remove();owned.delete(node);}
  }
  function destroy() {
    if(disposed)return;disposed=true;
    for(const tab of [...entries.keys()])clear(tab);
    for(const node of owned)node.remove();owned.clear();
    tabs.removeEventListener('mouseover',over);tabs.removeEventListener('TabSelect',selected);
    tabs.removeEventListener('TabOpen',opened);tabs.removeEventListener('TabClose',closed);
    window.removeEventListener('unload',destroy);style.remove();root.removeAttribute('data-blade-tab-surfaces');
    // The process-wide sheet is inert without ownership; other windows may use it.
  }
  for(const tab of gBrowser.tabs)add(tab);
  tabs.addEventListener('mouseover',over);tabs.addEventListener('TabSelect',selected);
  tabs.addEventListener('TabOpen',opened);tabs.addEventListener('TabClose',closed);
  window.addEventListener('unload',destroy,{once:true});
  window.BladeTabSurfaces={destroy,status:()=>({disposed,nodes:owned.size,entries:entries.size})};
  window.Blade?.mark('tab_surfaces','v1.0.0 OK');
})();
