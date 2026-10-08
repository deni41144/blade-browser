// ==UserScript==
// @name            Blade Surface Panels
// @description     Address results and native tab previews in the Blade menu material
// @author          Blade-Creations
// @include         main
// @version         1.0.1
// @loadOrder       110
// ==/UserScript==
(function () {
  if (window.BladeSurfacePanels) return;
  // Remove the legacy empty-query sections from the address panel.
  // These preferences only affect URL-bar suggestions, not saved sites.
  for (const pref of ['browser.urlbar.suggest.recentsearches',
    'browser.urlbar.suggest.topsites', 'browser.urlbar.groupLabels.enabled']) {
    Services.prefs.setBoolPref(pref, false);
  }
  const root = document.documentElement;
  const panel = document.getElementById('tab-preview-panel');
  const tabs = window.gBrowser?.tabContainer;
  const ns = 'http://www.w3.org/1999/xhtml';
  let hovered = null, disposed = false;
  const style = document.createElementNS(ns, 'style');
  style.id = 'blade-surface-panels-style';
  style.textContent = `
    :root[data-blade-surfaces] #urlbar {
      --blade-surface-accent:var(--bob-accent,var(--accent,#ff2a2a));
      --urlbarView-highlight-background:transparent;
      --urlbarView-highlight-color:#f2eff7;
    }
    :root[data-blade-surfaces] #urlbar .urlbar-background {
      background-image:var(--blade-material,linear-gradient(160deg,#261b21,#111217)) !important;
      background-color:#121317 !important;
      border-radius:11px !important;
      border:1px solid #ffffff24 !important;
      box-shadow:inset 0 1px #ffffff12 !important;
      opacity:1 !important; animation:none !important;
    }
    :root[data-blade-surfaces] #urlbar[focused] .urlbar-background {
      border-color:color-mix(in srgb,var(--blade-surface-accent) 42%,#55505e) !important;
      box-shadow:0 12px 32px #0006,inset 0 1px #ffffff20 !important;
    }
    :root[data-blade-surfaces] #urlbar[breakout-extend] .urlbar-background {
      border-radius:15px !important;
    }
    :root[data-blade-surfaces] #urlbar .urlbar-input-container {
      font-family:var(--blade-ui,'Rubik','Segoe UI',sans-serif) !important;
    }
    :root[data-blade-surfaces] #urlbar .urlbarView {
      background:transparent !important; background-image:none !important;
      border:0 !important; border-top:1px solid #ffffff14 !important;
      border-radius:0 !important; margin-inline:8px !important;
      color:#ececf2 !important;
      font-family:var(--blade-ui,'Rubik','Segoe UI',sans-serif) !important;
    }
    :root[data-blade-surfaces] #urlbar .urlbarView::before {
      content:'Поиск и переход'; display:block; padding:11px 12px 5px;
      color:#aaa4b4; font-size:11px; font-weight:500;
    }
    :root[data-blade-surfaces] #urlbar .urlbarView::after {
      content:'↑↓  Выбрать     Enter  Открыть     Esc  Закрыть';
      display:block; padding:10px 12px 12px; margin-top:5px;
      border-top:1px solid #ffffff0c; color:#a8a2b1; font-size:10px;
    }
    :root[data-blade-surfaces] #urlbar .urlbarView-body-outer {
      padding:0 !important; max-height:min(55vh,480px); overflow-y:auto;
      scrollbar-width:thin; scrollbar-color:#ffffff30 transparent;
    }
    :root[data-blade-surfaces] #urlbar .urlbarView-body-inner { border:0 !important; }
    :root[data-blade-surfaces] #urlbar .urlbarView-results { padding:2px 0 !important; }
    :root[data-blade-surfaces] #urlbar .urlbarView-row {
      margin:3px 0 !important; border:1px solid #ffffff09 !important;
      border-radius:8px !important; background:#00000020 !important;
      color:#e7e3ed !important;
      transition:background-color 100ms ease-out,border-color 100ms ease-out !important;
    }
    :root[data-blade-surfaces] #urlbar .urlbarView-row[label]::before { display:none !important; }
    :root[data-blade-surfaces] #urlbar .urlbarView-row-inner {
      min-height:44px !important; padding-block:8px !important; box-sizing:border-box;
      border-radius:7px !important; background:transparent !important;
    }
    :root[data-blade-surfaces] #urlbar .urlbarView-row:hover,
    :root[data-blade-surfaces] #urlbar .urlbarView-row[selected] {
      border-color:color-mix(in srgb,var(--blade-surface-accent) 35%,#ffffff16) !important;
      background:linear-gradient(100deg,color-mix(in srgb,var(--blade-surface-accent) 12%,#211c25),#ffffff06) !important;
      box-shadow:inset 2px 0 var(--blade-surface-accent),inset 0 1px #ffffff0b !important;
    }
    :root[data-blade-surfaces] #urlbar .urlbarView-favicon {
      width:16px !important; height:16px !important; padding:6px !important;
      box-sizing:content-box !important; border:1px solid #ffffff10;
      border-radius:7px; background-color:#0003 !important;
    }
    :root[data-blade-surfaces] #urlbar .urlbarView-title { color:#ede9f2 !important; font-size:13px !important; }
    :root[data-blade-surfaces] #urlbar .urlbarView-title strong {
      color:color-mix(in srgb,var(--blade-surface-accent) 62%,#fff) !important;
      font-weight:700 !important; text-shadow:none !important;
    }
    :root[data-blade-surfaces] #urlbar .urlbarView-url { color:#aaa8b9 !important; font-size:11px !important; }
    :root[data-blade-surfaces] #urlbar .urlbarView-action {
      color:color-mix(in srgb,var(--blade-surface-accent) 40%,#d5cdda) !important;
      font-size:11px !important;
    }
    :root[data-blade-surfaces] #tab-preview-panel {
      --panel-width:304px; --panel-padding:0;
      --panel-background:#121317; --panel-border-color:#ffffff20;
      --panel-border-radius:15px;
    }
    :root[data-blade-surfaces] #tab-preview-panel::part(content) {
      padding:0 !important; overflow:hidden !important; border-radius:15px !important;
      background-image:var(--blade-material,linear-gradient(160deg,#261b21,#111217)) !important;
      background-color:#121317 !important;
      border:1px solid color-mix(in srgb,var(--bob-accent,var(--accent,#ff2a2a)) 32%,#45454f) !important;
      box-shadow:0 16px 38px #0009,inset 0 1px #ffffff20 !important;
    }
    :root[data-blade-surfaces] #tab-preview-panel .tab-preview-content-main {
      gap:12px !important; padding:12px !important; color:#ececf2 !important;
      font-family:var(--blade-ui,'Rubik','Segoe UI',sans-serif) !important;
    }
    :root[data-blade-surfaces] #tab-preview-panel .tab-preview-text-container {
      margin:0 !important; order:2 !important;
    }
    :root[data-blade-surfaces] #tab-preview-panel .tab-preview-title {
      color:#f1eef5 !important; font-size:13px !important; line-height:1.5 !important;
      font-weight:600 !important; overflow-wrap:anywhere;
    }
    :root[data-blade-surfaces] #tab-preview-panel .tab-preview-uri {
      color:#aaa5b4 !important; font-size:11px !important; margin-top:5px;
    }
    :root[data-blade-surfaces] #tab-preview-panel .tab-preview-thumbnail-container {
      order:1 !important; width:280px !important; border-radius:8px;
      border:1px solid #ffffff16; background:#0d0e12;
      box-shadow:0 3px 12px #0005; box-sizing:border-box;
    }
    :root[data-blade-surfaces] #tab-preview-panel .tab-preview-thumbnail-container > canvas {
      border-radius:7px; animation:blade-preview-reveal 160ms ease-out both !important;
    }
    :root[data-blade-surfaces] #tab-preview-panel .tab-preview-container-indicator {
      margin-top:9px; padding:4px 7px; border-radius:5px;
      background:#0003; border:1px solid #ffffff0c; font-size:10px;
    }
    #blade-preview-meta { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
    #blade-preview-meta img { width:16px; height:16px; object-fit:contain; }
    #blade-preview-status { margin-left:auto; color:#b6b0c0; font-size:10px; }
    #blade-preview-meta[data-audio] #blade-preview-status { color:var(--bob-accent,var(--accent,#ff2a2a)); }
    #blade-preview-meta[hidden], #blade-preview-meta img[hidden] { display:none !important; }
    @keyframes blade-preview-reveal { from { opacity:0; } to { opacity:1; } }
    @media (prefers-reduced-motion:reduce) {
      :root[data-blade-surfaces] #urlbar .urlbarView-row,
      :root[data-blade-surfaces] #tab-preview-panel .tab-preview-thumbnail-container > canvas { animation:none !important; transition:none !important; }
    }
    :root[data-blade-surfaces][data-blade-material-motion="off"] #tab-preview-panel .tab-preview-thumbnail-container > canvas { animation:none !important; }
  `;
  root.appendChild(style);
  root.setAttribute('data-blade-surfaces', 'true');
  const meta = document.createElementNS(ns, 'div');
  meta.id = 'blade-preview-meta';
  meta.hidden = true;
  const icon = document.createElementNS(ns, 'img');
  icon.alt = ''; icon.hidden = true;
  const status = document.createElementNS(ns, 'span');
  status.id = 'blade-preview-status';
  meta.append(icon, status);
  panel?.querySelector('.tab-preview-text-container')?.prepend(meta);
  function sync(tab = hovered) {
    if (disposed) return;
    if (!tab || !tab.isConnected || tab.closing) { meta.hidden = true; return; }
    const image = tab.getAttribute('image');
    icon.hidden = !image;
    if (image && icon.getAttribute('src') !== image) icon.src = image;
    if (!image) icon.removeAttribute('src');
    const muted = tab.hasAttribute('muted'), audio = tab.hasAttribute('soundplaying');
    status.textContent = muted ? 'Звук выключен' : audio ? 'Воспроизводит звук' :
      tab.hasAttribute('pending') ? 'Спящая вкладка' : tab.hasAttribute('busy') ? 'Загружается' :
      tab.selected ? 'Текущая вкладка' : '';
    meta.toggleAttribute('data-audio', audio && !muted);
    meta.hidden = !image && !status.textContent;
  }
  function over(event) {
    const tab = event.target.closest?.('.tabbrowser-tab');
    if (tab && tab !== hovered) {
      hovered = tab;
      if (panel?.state === 'open' || panel?.state === 'showing') sync();
    }
  }
  function modified(event) {
    if (event.target === hovered && (panel?.state === 'open' || panel?.state === 'showing')) sync();
  }
  function closed(event) { if (event.target === hovered) { hovered = null; hide({target:panel}); } }
  function show(event) { if (event.target === panel) sync(); }
  function hide(event) {
    if (event.target !== panel) return;
    icon.removeAttribute('src'); icon.hidden = true; status.textContent = ''; meta.hidden = true;
    // hovered remains the anchor until the next pointer event; no image is kept.
  }
  function destroy() {
    if (disposed) return; disposed = true;
    tabs?.removeEventListener('mouseover', over);
    tabs?.removeEventListener('TabAttrModified', modified);
    tabs?.removeEventListener('TabClose', closed);
    panel?.removeEventListener('popupshowing', show);
    panel?.removeEventListener('popuphidden', hide);
    window.removeEventListener('unload', destroy);
    hovered = null; meta.remove(); style.remove(); root.removeAttribute('data-blade-surfaces');
  }
  tabs?.addEventListener('mouseover', over);
  tabs?.addEventListener('TabAttrModified', modified);
  tabs?.addEventListener('TabClose', closed);
  panel?.addEventListener('popupshowing', show);
  panel?.addEventListener('popuphidden', hide);
  window.addEventListener('unload', destroy, {once:true});
  window.BladeSurfacePanels = {destroy, status:()=>({disposed, preview:!!panel, hovered:!!hovered, style:style.isConnected})};
  window.Blade?.mark('surfaces', 'v1.0.1 OK');
})();
