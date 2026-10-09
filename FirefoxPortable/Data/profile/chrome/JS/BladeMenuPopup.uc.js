// ==UserScript==
// @name            Blade Menu Popup
// @description     Панель меню «B»: вкладки ТЕМА/ФОН/ПЛИТКИ/ОБНОВЫ/ПЕРФ/
//                  СИСТЕМА, рендер строк, делегированный клик-диспетчер.
//                  Шаг 8 декомпозиции BobliksSettings
// @author          Blade-Creations
// @include         main
// @version         1.4.3
// @ignorecache
// @loadOrder       11
// ==/UserScript==
// Вынесен из BobliksSettings.uc.js (шаг 8 декомпозиции, 2026-09-22): CSS панели,
// вкладки, buildPopup (рендер под преф blade.menu.tab), ensurePopup (создание
// panel + клик-диспетчер по dataset-атрибутам строк) и данные для вкладок —
// версия/кодовое имя (chrome\VERSION + CODENAME), PERF-кэш (JS\perf_mark.txt),
// DNS_URI. @loadOrder 11 — раньше BladeMenuButton (12): кнопка и хоткеи зовут
// window.BladeMenuPopup.open() по клику, порядок загрузки не критичен.
// Переключение темы/фона идёт через window.BladeEngine, облики —
// window.BladeVisages, конструктор — window.BladeThemeLab, бэкап —
// window.BladeSystemTools, обновления — window.BladeUpdater. THEMES —
// контракт BladeCore (нужны .label/.accent/.pref строкам тем и циклу слотов
// авто-темы в диспетчере).
(function () {
    if (window.BladeMenuPopup) return;
    window.BladeMenuPopup = true;

    let markPath = '';
    try {
        const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
        d.append('JS');
        markPath = d.path + '\\BladeMenuPopup_mark.txt';
    } catch (e) {}
    const mark = (m, e) => {
        try {
            if (!markPath) return;
            const text = 'v1.4.1 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
            IOUtils.writeUTF8(markPath, text).catch(() => {});
        } catch (e2) {}
    };

    const POPUP_ID = 'bobliks-settings-popup';
    const THEMES = window.Blade.themes;

    // Версия сборки из chrome\VERSION (пишется патч-системой); читается один
    // раз при старте окна (после обновления браузер всё равно перезапускается)
    let BLADE_VERSION = '';
    (async () => {
      try {
        const vd = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
        vd.append('VERSION');
        BLADE_VERSION = (await IOUtils.readUTF8(vd.path)).trim();
      } catch (e) {}
    })();
    // Кодовое имя релиза из chrome\CODENAME (пишется патч-системой)
    let BLADE_CODENAME = '';
    (async () => {
      try {
        const cd = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
        cd.append('CODENAME');
        BLADE_CODENAME = (await IOUtils.readUTF8(cd.path)).trim();
      } catch (e) {}
    })();
    // Замер старта окна (BladePerf пишет JS\perf_mark.txt, формат:
    // «v1.0.0 <ISO-дата> dcl=NNms load=NNms …», часть фаз может отсутствовать).
    // buildPopup синхронный — читаем файл один раз при старте в кэш, вкладка
    // «ПЕРФ» при открытии перечитывает его и обновляет DOM на месте
    let PERF_LINE = '';
    const readPerfMark = async () => {
      try {
        const pd = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
        pd.append('JS'); pd.append('perf_mark.txt');
        PERF_LINE = (await IOUtils.readUTF8(pd.path)).replace(/^\uFEFF/, '').trim();
      } catch (e) { PERF_LINE = ''; }
      return PERF_LINE;
    };
    readPerfMark();
    // DoH-провайдеры для секции DNS-ЗАЩИТА (mode 2: TRR-first, фолбэк на системный DNS)
    const DNS_URI = {
      cloudflare: 'https://cloudflare-dns.com/dns-query',
      adguard:    'https://dns.adguard-dns.com/dns-query',
      quad9:      'https://dns.quad9.net/dns-query',
    };
    // Preview textures echo BladeMaterials: the accent belongs to the edge,
    // while brushed metal, lacquer and glass provide the actual surface.
    const PREVIEWS = {
      red: ['#302023', '#151215', 'Лак / красная грань'],
      blood: ['#361820', '#160d13', 'Тёмный рубин'],
      purple: ['#30213e', '#16111e', 'Призматический шёлк'],
      green: ['#21382c', '#0e1913', 'Микротекстура / нефрит'],
      grey: ['#42464e', '#1a1c21', 'Шлифованный графит'],
      orange: ['#3d2e20', '#1c1510', 'Тёплая медь'],
      cherry: ['#3c2331', '#1c121b', 'Сатиновая вишня'],
      midnight: ['#24364d', '#0e1726', 'Полночь / стекло'],
      volt: ['#373922', '#171a10', 'Технический карбон'],
      custom: ['#343740', '#17191e', 'Твой цвет и материал'],
    };
    // Decorative signatures are real SVG nodes; no parser or external assets.
    const PREVIEW_MARKS = {
      red: [['path', { d:'M8 30 36 5 30 18 48 7 19 33 25 20Z', fill:'currentColor', stroke:'none' }], ['path',{d:'M4 34 43 3', opacity:'.4'}]],
      blood: [['path',{d:'M12 10C11 5 18 4 22 7C26 2 33 4 33 8C38 6 46 9 43 14C39 16 35 11 33 14V24C33 29 29 29 29 24V16C28 13 25 16 25 18V32C25 37 20 37 20 32V16C18 13 16 15 16 18V23C16 27 12 27 12 23V14C7 13 8 9 12 10Z', fill:'currentColor', stroke:'none'}], ['circle',{cx:'36',cy:'30',r:'2',fill:'currentColor',stroke:'none'}]],
      cherry: [['path',{d:'M26 20C9 18 10 6 20 8C26 9 27 15 26 20ZM27 19C25 5 36 2 38 10C38 16 32 19 27 19ZM28 21C34 10 45 17 40 23C35 27 31 24 28 21ZM27 22C39 25 35 35 28 32C24 30 25 26 27 22ZM24 21C21 32 10 29 14 23C17 19 21 19 24 21Z',fill:'currentColor',stroke:'none',opacity:'.85'}]],
      grey: [['path',{d:'M7 12 39 5M9 18 44 10M6 26 40 16M13 33 46 22',strokeWidth:'2.6'}], ['path',{d:'M9 13 39 6M6 27 40 17',stroke:'#eef4ff',strokeWidth:'.6'}]],
      orange: [['path',{d:'M18 27 22 19 24 28 21 32ZM29 17 33 7 35 18 32 22ZM38 30 40 24 43 29 40 34Z',fill:'currentColor',stroke:'none'}], ['circle',{cx:'14',cy:'15',r:'1.3',fill:'#ffa25a',stroke:'none'}], ['circle',{cx:'38',cy:'10',r:'.9',fill:'#ffc98a',stroke:'none'}]],
      midnight: [['path',{d:'M30 7 31.8 12.2 37 14 31.8 15.8 30 21 28.2 15.8 23 14 28.2 12.2Z',fill:'#73a1ff',stroke:'none'}], ['path',{d:'M15 23V29M12 26H18M42 25V31M39 28H45'}], ['circle',{cx:'43',cy:'8',r:'1',fill:'currentColor',stroke:'none'}], ['circle',{cx:'19',cy:'9',r:'.8',fill:'currentColor',stroke:'none'}]],
      green: [['path',{d:'M13 5V17M13 22V32M21 9V28M29 3V12M29 18V34M37 8V23M45 4V15M45 22V29',opacity:'.65'}], ['path',{d:'M11 10H15M19 19H23M27 27H31M35 14H39M43 25H47',strokeWidth:'2.5'}]],
      purple: [['path',{d:'M28 3 42 15 34 33 19 29 13 13Z',fill:'currentColor',fillOpacity:'.13'}], ['path',{d:'M28 3 26 17 34 33M13 13 26 17 42 15M19 29 26 17',opacity:'.8'}]],
      volt: [['path',{d:'M35 4 17 20H29L22 34 43 15H31Z',fill:'currentColor',stroke:'none'}], ['path',{d:'M12 27Q5 15 17 7M45 9Q54 20 43 31',opacity:'.38'}]],
      custom: [['path',{d:'M26 6 37 12V26L26 33 15 26V12ZM26 6V33M15 12 37 26M37 12 15 26',opacity:'.65'}]],
    };
    function previewMark(doc, theme) {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = doc.createElementNS(ns, 'svg');
      svg.setAttribute('class', 'bp-preview-mark'); svg.setAttribute('viewBox', '0 0 56 38');
      svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.1'); svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
      for (const [tag, attrs] of PREVIEW_MARKS[theme] || PREVIEW_MARKS.custom) {
        const shape = doc.createElementNS(ns, tag);
        for (const [key, value] of Object.entries(attrs)) {
          shape.setAttribute(key === 'strokeWidth' ? 'stroke-width' : key === 'fillOpacity' ? 'fill-opacity' : key, value);
        }
        svg.appendChild(shape);
      }
      return svg;
    }
    const MENU_CSS = `
      #bobliks-settings-popup::part(content) {
        appearance:none; -moz-appearance:none; padding:0; overflow:hidden;
        border:1px solid color-mix(in srgb,var(--bob-accent,#ff2a2a) 32%,#45454f);
        border-radius:15px;
        background-image:var(--blade-material,linear-gradient(160deg,#261b21,#111217));
        background-color:#121317;
        box-shadow:0 16px 38px #0009,inset 0 1px #ffffff20;
      }
      .bp-wrap { --bp-accent:var(--bob-accent,var(--accent,#ff2a2a)); width:388px; max-width:calc(100vw - 28px); max-height:calc(100vh - 110px); display:flex; flex-direction:column; font-family:var(--blade-ui,'Rubik','Segoe UI',sans-serif); font-size:12px; color:#ececf2; }
      .bp-wrap * { box-sizing:border-box; }
      .bp-wrap { position:relative; }
      .bp-wrap button { font:inherit; cursor:pointer; text-align:left; appearance:none; }
      .bp-head { position:relative; display:flex; align-items:center; gap:12px; padding:17px 16px 14px; flex:none; }
      .bp-emblem { display:grid; place-items:center; width:38px; height:40px; border:1px solid color-mix(in srgb,var(--bp-accent) 38%,#48404a); border-radius:11px 4px 11px 4px; color:var(--bp-accent); background:linear-gradient(135deg,#ffffff0e,#0003); font-family:var(--blade-display,'Unbounded',sans-serif); font-size:24px; font-weight:800; box-shadow:inset 0 1px #ffffff20; }
      .bp-brand { min-width:0; flex:1; }
      .bp-logo { display:block; font-family:var(--blade-display,'Unbounded',sans-serif); font-weight:800; font-size:17px; letter-spacing:1.8px; color:#f5f5fa; }
      .bp-ver { display:block; margin-top:5px; font-size:10px; color:#a7a4b0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .bp-head-theme { display:flex; align-items:center; gap:6px; max-width:112px; padding:5px 7px; border-radius:6px; background:#0003; color:#b7b4bf; font-size:9px; }
      .bp-head-theme::before { content:''; width:5px; height:5px; border-radius:50%; background:var(--bp-accent); flex:none; }
      .bp-head-theme span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .bp-tabs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:3px; padding:0 11px 11px; flex:none; border-bottom:1px solid #ffffff0e; }
      .bp-tab { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; min-height:48px; padding:6px 1px; color:#9693a0; background:transparent; border:1px solid transparent; border-radius:8px; transition:color .12s,border-color .12s; }
      .bp-tab svg { width:17px; height:17px; flex:none; }
      .bp-tlbl { font-size:9px; font-weight:500; }
      .bp-tab.on { color:#f3f1f7; border-color:#ffffff16; background:linear-gradient(180deg,#ffffff0c,#ffffff03); box-shadow:inset 0 -2px var(--bp-accent); }
      .bp-tab.on svg { color:var(--bp-accent); }
      .bp-body { min-height:0; overflow-y:auto; padding:12px 12px 13px; scrollbar-width:thin; scrollbar-color:#ffffff30 transparent; }
      .bp-section-head { display:flex; justify-content:space-between; align-items:baseline; padding:0 2px 10px; }
      .bp-section-head strong { font-size:13px; font-weight:600; }
      .bp-section-head span { color:#9b96a3; font-size:10px; }
      .bp-theme-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin-bottom:8px; }
      .bp-row { display:flex; align-items:center; gap:9px; width:100%; margin:3px 0; padding:9px 10px; border:1px solid #ffffff0c; border-radius:7px; background:#0000001e; color:#c9c6d1; font-size:11.5px; line-height:1.4; }
      .bp-row.on { color:#f1eef6; border-color:color-mix(in srgb,var(--bp-accent) 32%,#ffffff0d); background:#ffffff05; }
      .bp-row.accent { color:var(--bp-accent); font-weight:600; }
      .bp-lbl { min-width:0; flex:1; }
      .bp-dot { width:9px; height:9px; border:1px solid #77707c; border-radius:50%; flex:none; }
      .bp-row.on .bp-dot { border-color:var(--bp-accent); background:var(--bp-accent); box-shadow:inset 0 0 0 2px #1a171e; }
      .bp-chip { width:12px; height:12px; border:1px solid #ffffff30; border-radius:3px; flex:none; }
      .bp-row.indent { padding-left:25px; }
      .bp-theme-card { display:block; position:relative; margin:0; padding:0; overflow:hidden; border-radius:9px; border-color:#ffffff12; background:#101014; }
      .bp-theme-card.on { border-color:var(--sample-accent); background:#101014; }
      .bp-preview { height:43px; position:relative; overflow:hidden; background:linear-gradient(135deg,transparent 20%,#ffffff09 44%,transparent 60%),linear-gradient(155deg,var(--sample-top),var(--sample-base)); box-shadow:inset 0 1px #ffffff0c; }
      .bp-preview[data-material=grey] { background:repeating-linear-gradient(0deg,#ffffff06 0 1px,transparent 1px 3px),linear-gradient(155deg,var(--sample-top),var(--sample-base)); }
      .bp-preview[data-material=green],.bp-preview[data-material=orange] { background:repeating-linear-gradient(90deg,transparent 0 5px,#ffffff05 5px 6px),linear-gradient(155deg,var(--sample-top),var(--sample-base)); }
      .bp-preview[data-material=volt] { background:repeating-linear-gradient(135deg,transparent 0 12px,#ffffff09 12px 13px),linear-gradient(155deg,var(--sample-top),var(--sample-base)); }
      .bp-preview[data-material=blood] { background:linear-gradient(112deg,transparent 18%,#ce8b9421 20%,transparent 24%),linear-gradient(155deg,var(--sample-top),var(--sample-base)); }
      .bp-mini-tab { position:absolute; left:10px; top:8px; width:57%; height:12px; border-radius:4px 4px 0 0; background:#ffffff0c; border-top:1px solid #ffffff24; }
      .bp-mini-line { position:absolute; left:10px; right:10px; top:21px; height:1px; background:var(--sample-accent); opacity:.85; }
      .bp-mini-url { position:absolute; left:15px; right:15px; bottom:8px; height:7px; border:1px solid #ffffff16; background:#0003; border-radius:3px; }
      .bp-preview-mark { position:absolute; right:12px; top:3px; width:55px; height:37px; color:var(--sample-accent); opacity:.88; transform-origin:70% 50%; filter:drop-shadow(0 0 3px color-mix(in srgb,var(--sample-accent) 32%,transparent)); }
      .bp-preview[data-material=blood] .bp-preview-mark { color:#ff263e; filter:drop-shadow(0 1px 3px #fa14384d); }
      .bp-preview[data-material=grey] .bp-preview-mark { color:#c7d0df; }
      .bp-theme-card:is(:hover,:focus-visible) .bp-preview-mark { animation:bp-preview-reveal .36s cubic-bezier(.16,.8,.3,1) both; }
      @keyframes bp-preview-reveal { from { opacity:.35; transform:translateX(7px) scale(.84); } to { opacity:.95; transform:none; } }
      .bp-theme-copy { display:block; padding:7px 9px 8px; }
      .bp-theme-name { display:block; font-size:11px; font-weight:500; color:#e4e1ea; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:12px; }
      .bp-theme-detail { display:block; color:#8c8795; font-size:8.5px; margin-top:2px; }
      .bp-wall-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin:5px 0 12px; }
      .bp-visage-row { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; margin:0 0 10px; }
      .bp-visage { display:flex; flex-direction:column; align-items:center; gap:5px; padding:7px 2px 6px; border:1px solid #ffffff12; border-radius:8px; background:#ffffff05; }
      .bp-visage.on { border-color:var(--bp-accent); box-shadow:inset 0 -2px var(--bp-accent); }
      .bp-visage-sq { width:26px; height:26px; border-radius:6px; border:1px solid #ffffff25; box-shadow:inset 0 1px #ffffff22; }
      .bp-visage.on .bp-visage-sq { border-color:#fff; box-shadow:0 0 8px var(--bp-accent); }
      .bp-visage-nm { font-family:var(--blade-display,'Unbounded','Segoe UI',sans-serif); font-size:8px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:#e8e4ee; text-align:center; line-height:1.2; text-shadow:0 0 5px rgba(255,255,255,.28); }
      .bp-wall-entry { position:relative; min-width:0; }
      .bp-wall-zoom { position:absolute; top:6px; right:6px; display:grid; place-items:center; width:25px; height:25px; padding:0; color:#e1dbe8; border:1px solid #ffffff2e; border-radius:6px; background:#100e16bd; font-size:17px !important; }
      .bp-wall-zoom:hover { color:var(--bp-accent); border-color:var(--bp-accent); }
      .bp-wall-entry .bp-current { right:auto; left:6px; }
      .bp-wall-detail { position:absolute; inset:0; z-index:5; display:flex; flex-direction:column; gap:13px; padding:15px; border-radius:14px; background-image:var(--blade-material,linear-gradient(160deg,#261b21,#111217)); background-color:#121317; animation:bp-detail-in .15s ease-out; }
      .bp-detail-head { display:flex; align-items:center; gap:10px; }
      .bp-detail-back { flex:none; width:32px; height:30px; display:grid; place-items:center; border:1px solid #ffffff20; border-radius:7px; color:#d9d3e1; background:#ffffff05; font-size:18px !important; }
      .bp-detail-title { margin:0; font-size:13px; font-weight:500; line-height:1.4; color:#ece6f3; }
      .bp-detail-stage { flex:1; min-height:0; position:relative; display:grid; place-items:center; overflow:hidden; border:1px solid #ffffff16; border-radius:10px; background:#090a0d; }
      .bp-detail-stage img { width:100%; height:100%; min-height:0; object-fit:contain; position:absolute; inset:0; }
      .bp-detail-stage .bp-detail-live { position:absolute; inset:0; }
      .bp-detail-hint { margin:0; color:#a69dab; font-size:10px; line-height:1.5; }
      .bp-detail-apply { flex:none; justify-content:center; padding:11px; color:#eee7f3; border-color:color-mix(in srgb,var(--bp-accent) 40%,#ffffff10); box-shadow:inset 0 -2px var(--bp-accent); }
      @keyframes bp-detail-in { from { opacity:.5; transform:translateY(4px); } to { opacity:1; transform:none; } }
      .bp-wall-preview { position:relative; height:73px; overflow:hidden; background:linear-gradient(135deg,#25212e,#121219); }
      .bp-wall-preview img { display:block; width:100%; height:100%; object-fit:cover; }
      .bp-wall-preview::after { content:''; position:absolute; inset:0; pointer-events:none; box-shadow:inset 0 -16px 18px -15px #000a; }
      .bp-wall-fallback { position:absolute; inset:0; display:grid; place-items:center; color:#94889f; font-size:10px; }
      .bp-wall-preview[data-loaded=true] .bp-wall-fallback { display:none; }
      .bp-wall-preview[data-failed=true] img { display:none; }
      .bp-wall-card .bp-theme-copy { padding:7px 9px; }
      .bp-wall-card .bp-theme-name { font-size:10px; }
      .bp-live-tag { position:absolute; bottom:6px; left:7px; font-size:8px; color:#d8cfde; background:#08071099; padding:2px 5px; border-radius:3px; }
      .bp-current { position:absolute; right:6px; top:6px; width:17px; height:17px; display:grid; place-items:center; background:#111217; color:var(--sample-accent); border:1px solid var(--sample-accent); border-radius:50%; font-size:10px; font-weight:700; }
      .bp-sub { padding:13px 3px 6px; color:#a5a0ae; font-size:10px; font-weight:500; }
      .bp-folder { display:flex; align-items:center; gap:8px; width:100%; margin:7px 0 3px; padding:9px; color:#d1cbd9; border:1px solid #ffffff12; border-radius:7px; background:#ffffff05; }
      .bp-folder svg { width:15px; height:15px; color:var(--bp-accent); }
      .bp-farrow { width:10px; color:#958a9d; }
      .bp-fcnt { font-size:10px; color:#a69aae; }
      .bp-sound { display:grid; grid-template-columns:30px 1fr 35px 30px; gap:8px; align-items:center; padding:10px 13px; border-top:1px solid #ffffff10; flex:none; background:#00000017; }
      .bp-sound button { display:grid; place-items:center; width:30px; height:28px; border:1px solid #ffffff16; border-radius:7px; color:#c8c3d0; background:#ffffff05; font-size:13px; }
      .bp-sound button[aria-pressed=true] { color:#817987; }
      .bp-volume-box { display:flex; flex-direction:column; gap:3px; }
      .bp-volume-box label { color:#a6a0af; font-size:9px; }
      .bp-volume { width:100%; height:14px; margin:0; padding:0; appearance:none; background:transparent; accent-color:var(--bp-accent); cursor:pointer; }
      .bp-volume::-moz-range-track { height:4px; border:1px solid #ffffff14; border-radius:3px; background:#ffffff13; }
      .bp-volume::-moz-range-progress { height:4px; border-radius:3px; background:var(--bp-accent); }
      .bp-volume::-moz-range-thumb { width:10px; height:10px; border:2px solid var(--bp-accent); border-radius:50%; background:#211b25; box-shadow:0 0 0 2px #111217,inset 0 1px #ffffff32; }
      .bp-volume-value { font-size:10px; color:#c5bdce; text-align:right; font-variant-numeric:tabular-nums; }
      .bp-foot { display:flex; gap:4px; padding:5px 10px 9px; flex:none; }
      .bp-foot .bp-row { flex:1; width:auto; justify-content:center; font-size:10px; padding:7px 3px; margin:0; border-color:transparent; color:#a9a2b2; background:transparent; text-align:center; }
      .bp-perf-val { padding:8px; border:1px solid #ffffff10; border-radius:7px; background:#0002; font-family:var(--blade-mono,'JetBrains Mono',monospace); }
      .bp-perf-val .bp-lbl { font-size:11px; padding:3px 0; color:#c6bfce; }
      .bp-perf-hint { font-size:11px; line-height:1.5; color:#a6a0ae; padding:2px 3px 6px; }
      .bp-icon-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .bp-icon-card { display:flex; flex-direction:column; align-items:center; gap:0; padding:0; overflow:hidden; }
      .bp-icon-card .bp-icon-preview { position:relative; display:grid; place-items:center; width:100%; height:64px; background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--sample-accent) 22%,transparent),transparent 70%),linear-gradient(135deg,#25212e,#121219); }
      .bp-icon-card .bp-icon-preview img { width:44px; height:44px; filter:drop-shadow(0 3px 8px #000a); transition:transform .15s; }
      .bp-icon-card:is(:hover,:focus-visible) .bp-icon-preview img { transform:scale(1.12); }
      .bp-icon-card.on .bp-icon-preview { box-shadow:inset 0 -2px var(--sample-accent); }
      .bp-icon-card .bp-theme-copy { width:100%; text-align:center; padding:5px 4px 6px; }
      .bp-icon-card .bp-theme-name { font-size:9px; padding:0; }
      .bp-wrap :is(button,input):focus-visible { outline:2px solid var(--bp-accent); outline-offset:2px; }
      .bp-wrap button:active { transform:translateY(1px); }
      :root[data-blade-material-motion=off] .bp-wrap *, :root[data-blade-fx-mode=eco] .bp-wrap * { animation:none !important; transition:none !important; }
      @media(prefers-reduced-motion:reduce) { .bp-wrap * { animation:none !important; transition:none !important; } }
    `;
    const BP_TABS = [
      { id: 'theme',  label: 'ТЕМА',   icon: '<path d="M12 3s-6 6.5-6 10a6 6 0 0 0 12 0c0-3.5-6-10-6-10z"/>' },
      { id: 'bg',     label: 'ФОН',    icon: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><circle cx="8.5" cy="10" r="1.5"/><path d="M4 17l5-5 4 4 3-3 4 4"/>' },
      { id: 'tiles',  label: 'ПЛИТКИ', icon: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>' },
      { id: 'update', label: 'ОБНОВЫ', icon: '<path d="M12 3v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4 19.5h16"/>' },
      { id: 'perf',   label: 'ПЕРФ',   icon: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4.5-4.5"/><circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none"/>' },
      { id: 'system', label: 'СИСТЕМА', icon: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><rect x="10" y="10" width="4" height="4"/><path d="M10 3.5v3M14 3.5v3M10 17.5v3M14 17.5v3M3.5 10h3M3.5 14h3M17.5 10h3M17.5 14h3"/>' },
    ];
    function buildPopup(doc, popup) {
      closeWallpaperPreview(popup, false);
      window.BladeTilePanel?.destroy();
      // Обновляем активную вкладку + тело панели под преф blade.menu.tab
      const tab = Services.prefs.getStringPref('blade.menu.tab', 'theme');
      popup.querySelectorAll('.bp-tab').forEach((el) => {
        el.classList.toggle('on', el.dataset.tab === tab);
        el.setAttribute('aria-pressed', String(el.dataset.tab === tab));
      });
      const currentTheme = window.BladeEngine.activeTheme();
      const current = THEMES.find(t => t.id === currentTheme);
      const themeLabel = popup.querySelector('.bp-head-theme span');
      if (themeLabel) themeLabel.textContent = current ? current.label.replace(' (default)', '') : 'Blade';
      syncSound(popup);
      window.BladeMusic?.mount(popup);
      const ver = popup.querySelector('.bp-ver');
      if (ver) ver.textContent = BLADE_VERSION ? ('v' + BLADE_VERSION + (BLADE_CODENAME ? ' · ' + BLADE_CODENAME : '')) : '';
      const body = popup.querySelector('.bp-body');
      if (!body) return;
      popup._bladeBgCleanup?.();
      const scrollTop = body.dataset.tab === tab ? body.scrollTop : 0;
      const focused = body.contains(doc.activeElement) ? Object.entries(doc.activeElement.dataset || {}) : [];
      body.dataset.tab = tab;
      body.innerHTML = '';
      const H = 'http://www.w3.org/1999/xhtml';
      const mk = (cls) => { const el = doc.createElementNS(H, 'div'); el.className = cls; return el; };
      const sub = (label) => { const el = mk('bp-sub'); el.textContent = label; body.appendChild(el); };
      const button = (cls) => {
        const el = doc.createElementNS(H, 'button'); el.className = cls;
        el.setAttribute('type', 'button'); return el;
      };
      const row = (label, ds, o) => {
        o = o || {};
        const r = button('bp-row' + (o.on ? ' on' : '') + (o.accent ? ' accent' : '') + (o.indent ? ' indent' : ''));
        if (o.on != null) r.setAttribute('aria-pressed', String(!!o.on));
        if (!Object.keys(ds).length) r.disabled = true;
        if (o.chip) { const c = mk('bp-chip'); c.style.background = o.chip; r.appendChild(c); }
        else if (!o.noDot) { r.appendChild(mk('bp-dot')); }
        const l = mk('bp-lbl'); l.textContent = label; r.appendChild(l);
        for (const k in ds) r.dataset[k] = ds[k];
        body.appendChild(r);
      };
      // Заголовок папки-поколения (v1.1.0): иконка + имя + счётчик, клик
      // сворачивает/разворачивает (без закрытия меню — ре-рендер buildPopup)
      const folderRow = (label, ds, folded, count) => {
        const r = button('bp-folder');
        r.setAttribute('aria-expanded', String(!folded));
        const ar = mk('bp-farrow'); ar.textContent = folded ? '▸' : '▾'; r.appendChild(ar);
        const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7');
        svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
        svg.innerHTML = '<path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h4.4l1.5 2H18.5A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/>';
        r.appendChild(svg);
        const l = mk('bp-lbl'); l.textContent = label; r.appendChild(l);
        if (count != null) { const c = mk('bp-fcnt'); c.textContent = count; r.appendChild(c); }
        for (const k in ds) r.dataset[k] = ds[k];
        body.appendChild(r);
      };
      if (tab === 'theme') {
        const curTheme = window.BladeEngine.activeTheme();
        const section = mk('bp-section-head');
        const title = doc.createElementNS(H, 'strong'); title.textContent = 'Материалы и цвет';
        const count = doc.createElementNS(H, 'span'); count.textContent = THEMES.length + ' тем';
        section.append(title, count); body.appendChild(section);
        const grid = mk('bp-theme-grid'); body.appendChild(grid);
        for (const t of THEMES) {
          const card = button('bp-row bp-theme-card' + (curTheme === t.id ? ' on' : ''));
          card.dataset.bobliksTheme = t.id;
          card.setAttribute('aria-pressed', String(curTheme === t.id));
          const material = PREVIEWS[t.id] || PREVIEWS.custom;
          card.style.setProperty('--sample-accent', t.accent);
          card.style.setProperty('--sample-top', material[0]);
          card.style.setProperty('--sample-base', material[1]);
          const preview = mk('bp-preview'); preview.dataset.material = t.id;
          preview.setAttribute('aria-hidden', 'true');
          for (const cls of ['bp-mini-tab', 'bp-mini-line', 'bp-mini-url']) preview.appendChild(mk(cls));
          preview.appendChild(previewMark(doc, t.id));
          const copy = mk('bp-theme-copy');
          const name = mk('bp-theme-name'); name.textContent = t.label.replace(' (default)', '');
          const detail = mk('bp-theme-detail'); detail.textContent = material[2];
          copy.append(name, detail); card.append(preview, copy);
          if (curTheme === t.id) {
            const check = mk('bp-current'); check.textContent = '✓'; check.setAttribute('aria-hidden', 'true'); card.appendChild(check);
          }
          grid.appendChild(card);
        }
        row('Конструктор темы…', { bladeLab: '1' }, { noDot: true });
        // АВТО-ТЕМА: смена день/ночь по часам (8:00 / 20:00). Темы для слотов
        // циклятся кликом по строке; ручной выбор темы при включённой авто
        // её глушит — иначе циклер через минуту молча вернёт свою
        sub('АВТО-ТЕМА');
        const autoOn = Services.prefs.getBoolPref('blade.autotheme.on', false);
        row('Смена день/ночь автоматически (8:00 / 20:00)', { bladeAutoTheme: autoOn ? 'off' : 'on' }, { on: autoOn });
        const autoLbl = (id) => { const t = THEMES.find(x => x.id === id); return t ? t.label : id; };
        row('Тема дня: ' + autoLbl(Services.prefs.getStringPref('blade.autotheme.day', 'grey')), { bladeAutoDay: '1' });
        row('Тема ночи: ' + autoLbl(Services.prefs.getStringPref('blade.autotheme.night', 'blood')), { bladeAutoNight: '1' });
        // ЗНАЧОК: сетка 3x3 живых превью PNG из chrome/img/ico.
        // Пустой преф = авто от темы (BladeDesktopIcon.uc.js).
        sub('ЗНАЧОК БРАУЗЕРА');
        const ICONS = [
          {id:'1RED',label:'Красный',accent:'#ff2a2a'},
          {id:'2BLOOD',label:'Кровь',accent:'#a3121f'},
          {id:'3PURPLE',label:'Фиолет',accent:'#b06dff'},
          {id:'4GREEN',label:'Зелёный',accent:'#2ecc71'},
          {id:'5WHITE',label:'Белый',accent:'#c7d0df'},
          {id:'6ORANGE',label:'Оранжевый',accent:'#ff8c1a'},
          {id:'7CHERRY',label:'Вишня',accent:'#ff4d6d'},
          {id:'8BLUE',label:'Синий',accent:'#2f6bff'},
          {id:'9YELLOW',label:'Жёлтый',accent:'#ffd21a'},
        ];
        let manualIcon = '';
        try { manualIcon = Services.prefs.getStringPref('blade.icon.manual', ''); } catch (e) {}
        const iconGrid = mk('bp-theme-grid bp-icon-grid');
        body.appendChild(iconGrid);
        for (const ic of ICONS) {
          const card = button('bp-row bp-theme-card bp-icon-card' + (manualIcon === ic.id ? ' on' : ''));
          card.dataset.bladeIconPick = ic.id;
          card.setAttribute('aria-pressed', String(manualIcon === ic.id));
          card.title = ic.label;
          card.style.setProperty('--sample-accent', ic.accent);
          const preview = mk('bp-preview bp-icon-preview');
          preview.setAttribute('aria-hidden', 'true');
          const image = doc.createElementNS(H, 'img');
          image.setAttribute('width', '48'); image.setAttribute('height', '48');
          image.setAttribute('alt', ''); image.setAttribute('decoding', 'async');
          try {
            const dir = window.BladeEngine.getImgDir().clone();
            for (const part of ['ico', ic.id + '.png']) if (part) dir.append(part);
            image.src = PathUtils.toFileURI(dir.path);
          } catch (e) {}
          preview.appendChild(image);
          const copy = mk('bp-theme-copy');
          const name = mk('bp-theme-name'); name.textContent = ic.label;
          copy.appendChild(name); card.append(preview, copy);
          if (manualIcon === ic.id) {
            const check = mk('bp-current'); check.textContent = '✓'; check.setAttribute('aria-hidden', 'true'); card.appendChild(check);
          }
          iconGrid.appendChild(card);
        }
        row(manualIcon ? 'Значок → Авто (от темы)' : 'Значок: Авто (от темы) ✓', { bladeIconAuto: '1' }, { noDot: true, on: !manualIcon });
      } else if (tab === 'bg') {
        const curBg = window.BladeEngine.activeBg();
        const all = window.BladeEngine.getAllBgs();
        // Цветные квадратики перед обоями — те же bp-chip, что у тем во вкладке
        // ТЕМА. Обои из папки Original названы в честь цветов: CHERRY/WHITE/
        // YELLOW/RED/BLOOD. Цвет берём у соответствующей темы — квадратик всегда
        // совпадает с тем, что владелец видит у темы. WHITE/YELLOW — алиасы на
        // grey/volt (таких тем-идентификаторов нет, это имена из тайл-набора).
        // Original RED теперь называется BLOOD и использует кровавый акцент.
        // Любое другое имя файла → без квадратика, как раньше.
        const CHIP_ALIASES = { WHITE: 'grey', YELLOW: 'volt', BLUE: 'midnight', RED: 'blood' };
        const bgChip = (b) => {
          try {
            const base = String(b.file || '').split(/[\\/]/).pop().replace(/[.][^.]+$/, '').toUpperCase();
            const alias = Object.prototype.hasOwnProperty.call(CHIP_ALIASES, base) ? CHIP_ALIASES[base] : null;
            const t = (alias ? THEMES.find((x) => x.id === alias) : null)
                   || THEMES.find((x) => x.id.toUpperCase() === base);
            return t ? t.accent : null;
          } catch (e) { return null; }
        };
        const liveTextures = {
          pulse:'radial-gradient(ellipse at 50% 80%,#960a0a99,transparent 72%),#060404',
          flow:'radial-gradient(ellipse at 25% 30%,#a80f0f61,transparent 70%),radial-gradient(ellipse at 75% 70%,#ff2a2a29,transparent 70%),#060405',
          aurora:'radial-gradient(ellipse at 30% 25%,#00e5ff52,transparent 70%),radial-gradient(ellipse at 70% 60%,#2f6bff47,transparent 75%),#04060d',
          matrix:'repeating-linear-gradient(90deg,transparent 0 13px,#00ff8820 14px 15px,transparent 16px 28px),repeating-linear-gradient(180deg,#00ff882e,transparent 20px 53px),#050a07',
          ember:'repeating-linear-gradient(90deg,transparent 0 20px,#ffa02826 21px 22px,transparent 23px 42px),radial-gradient(ellipse at 50% 95%,#ff6a1f59,transparent 75%),#0c0a07',
          plasma:'radial-gradient(ellipse at 35% 40%,#fff82047,transparent 70%),conic-gradient(from 180deg,transparent,#fff82030,transparent,#ffff5025,transparent),#0d0d05',
          synthwave:'repeating-linear-gradient(90deg,transparent 0 20px,#b44bff26 21px 22px,transparent 23px 42px),repeating-linear-gradient(0deg,#b44bff33 0 1px,transparent 2px 17px),radial-gradient(ellipse at 50% 55%,#b44bff61,transparent 70%),#0c0a10',
          mist:'radial-gradient(ellipse at 20% 40%,#8a8f983d,transparent 75%),radial-gradient(ellipse at 80% 65%,#b4c3d72e,transparent 70%),#0e0f11',
          sakura:'radial-gradient(ellipse at 25% 40%,#d02d4e61,transparent 70%),radial-gradient(ellipse at 75% 60%,#ff96bf33,transparent 70%),#100508',
          inferno:'radial-gradient(ellipse at 50% 85%,#ff2a2a77,transparent 72%),radial-gradient(ellipse at 30% 95%,#f86c1740,transparent 70%),#060404',
        };
        const wallpaperGrid = (items) => {
          const grid = mk('bp-wall-grid'); body.appendChild(grid);
          for (const b of items) {
            const card = button('bp-row bp-theme-card bp-wall-card' + (curBg === b.id ? ' on' : ''));
            card.dataset.bobliksBg = b.id; card.setAttribute('aria-pressed', String(curBg === b.id));
            card.style.setProperty('--sample-accent', bgChip(b) || 'var(--bp-accent)');
            const preview = mk('bp-wall-preview'); preview.setAttribute('aria-hidden', 'true');
            if (b.file) {
              const fallback = mk('bp-wall-fallback'); fallback.textContent = '◇'; preview.appendChild(fallback);
              const image = doc.createElementNS(H, 'img'); image.setAttribute('width', '176'); image.setAttribute('height', '73');
              image.setAttribute('alt', ''); image.setAttribute('decoding', 'async');
              // Explicit viewport gating is reliable in native chrome panels:
              // native loading=lazy alone can eagerly decode every local file.
              try {
                const file = window.BladeEngine.getImgDir().clone();
                for (const part of String(b.file).split(/[\\/]/)) if (part) file.append(part);
                image.dataset.src = PathUtils.toFileURI(file.path);
              } catch (e) { preview.dataset.failed = 'true'; fallback.textContent = 'Нет миниатюры'; }
              image.addEventListener('load', () => { preview.dataset.loaded = 'true'; });
              image.addEventListener('error', () => {
                if (!image.hasAttribute('src')) return;
                preview.dataset.failed = 'true'; fallback.textContent = 'Нет миниатюры'; image.removeAttribute('src');
              });
              preview.appendChild(image);
            } else {
              preview.style.background = liveTextures[b.id] || liveTextures.pulse;
              const tag = mk('bp-live-tag'); tag.textContent = 'Живой фон'; preview.appendChild(tag);
            }
            const copy = mk('bp-theme-copy'); const label = mk('bp-theme-name');
            label.textContent = b.label.replace(' (CSS-анимация)', ''); copy.appendChild(label);
            card.append(preview, copy); card.title = b.label;
            if (curBg === b.id) { const check = mk('bp-current'); check.textContent = '✓'; check.setAttribute('aria-hidden', 'true'); card.appendChild(check); }
            const entry = mk('bp-wall-entry'); entry.appendChild(card);
            const zoom = button('bp-wall-zoom'); zoom.dataset.bladeWallpaperPreview = b.id;
            zoom.textContent = '⤢'; zoom.title = 'Рассмотреть: ' + b.label;
            zoom.setAttribute('aria-label', zoom.title); entry.appendChild(zoom); grid.appendChild(entry);
          }
        };
        // 4 папки-поколения (Original/Standart/Samurai/Animation) + хвост
        // «Свои файлы» — обои, добавленные через файлпикер
        const GROUPS = [
          { id: 'original',  label: 'Original' },
          { id: 'standart',  label: 'Standart' },
          { id: 'samurai',   label: 'Samurai' },
          { id: 'animation', label: 'Animation' },
          { id: 'custom', label: 'Мои обои' },
        ];
        for (const g of GROUPS) {
          const items = all.filter((b) => b.group === g.id);
          if (!items.length) continue;
          const folded = Services.prefs.getBoolPref('blade.menu.bgfold.' + g.id, false);
          folderRow(g.label, { bladeBgFold: g.id }, folded, items.length);
          if (folded) continue;
          wallpaperGrid(items);
        }
        const rest = all.filter((b) => !b.group);
        if (rest.length) {
          sub('СВОИ ФАЙЛЫ');
          wallpaperGrid(rest);
        }
        row('+ Добавить свои обои…', { bladePickBg: '1' }, { noDot: true });
        row('Открыть папку моих обоев', { bladeCustomBgFolder: '1' }, { noDot: true });
      } else if (tab === 'tiles') {
        row('Настроить расположение главной', { bladeHomeLayout: '1' }, { noDot: true });
        const tileHost = mk('bt-panel'); body.appendChild(tileHost);
        window.BladeTilePanel?.mount(tileHost);
        const editOn = Services.prefs.getBoolPref('bobliks.dial.edit', false);
        row('Показать меню на самих плитках', { bobliksEdit: editOn ? 'off' : 'on' }, { on: editOn });
      } else if (tab === 'system') {
        // «ЧТЕНИЕ / Принудительный тёмный» снесено 2026-09-13: тёмный режим
        // сайтов делает Dark Reader (ставится политикой), наш инверт удалён
        sub('АККАУНТЫ / КОНТЕЙНЕРЫ');
        const accounts = window.BladeAccounts;
        if (accounts && accounts.available()) {
          if (window.BladeAccountPanel) {
            const accountHost = mk('ba-panel');
            body.appendChild(accountHost);
            window.BladeAccountPanel.mount(accountHost);
          } else {
            row('Управление аккаунтами…', { bladeAccountsManage: '1' }, { noDot: true });
          }
        } else {
          row('Контейнеры недоступны в приватном окне или выключены', {}, { noDot: true });
        }
        sub('DNS-ЗАЩИТА');
        const trrMode = Services.prefs.getIntPref('network.trr.mode', 0);
        const trrUri = Services.prefs.getStringPref('network.trr.uri', 'https://cloudflare-dns.com/dns-query');
        const DNS_LIST = [
          { id: 'cloudflare', label: 'Cloudflare (скорость)' },
          { id: 'adguard',    label: 'AdGuard (+блок рекламы)' },
          { id: 'quad9',      label: 'Quad9 (приватность)' },
        ];
        for (const d of DNS_LIST) {
          row(d.label, { bladeDns: d.id }, { on: trrMode === 2 && trrUri === DNS_URI[d.id] });
        }
        row('Выключена (системный DNS)', { bladeDns: 'off' }, { on: trrMode !== 2 });
        sub('ИНТЕРФЕЙС');
        const fxMode = window.BladeEffects ? window.BladeEffects.mode() : 'vivid';
        for (const [mode, label] of [['vivid', 'Яркие'], ['balanced', 'Сбалансированные'], ['eco', 'Экономия']]) {
          row('Эффекты: ' + label, { bladeFxMode: mode }, { on: fxMode === mode });
        }
        const idleOn = Services.prefs.getBoolPref('blade.idle.on', true);
        row('Заставка простоя (3 мин)', { bladeIdle: idleOn ? 'off' : 'on' }, { on: idleOn });
        row('Очистить память', { bladePurge: '1' }, { noDot: true });
        sub('БЭКАП');
        row('Сохранить профиль в zip', { bladeBackup: '1' }, { noDot: true });
        sub('WINDOWS');
        if (window.BladeUpdater?.canSetDefault()) row('Сделать браузером по умолчанию', { bladeDefault: '1' }, { noDot: true });
      } else if (tab === 'update') {
        let upd = null;
        try { upd = (typeof window.BladeUpdater === 'object' && window.BladeUpdater) ? window.BladeUpdater.state() : null; } catch (e) {}
        if (upd && upd.available) {
          row('Доступна v' + upd.available + ' — обновить', { bladeUpdate: 'install' }, { noDot: true, accent: true });
        }
        row('Проверить сейчас', { bladeUpdate: 'check' }, { noDot: true });
        const updAuto = Services.prefs.getBoolPref('blade.update.auto', true);
        row('Автопроверка (раз в сутки)', { bladeUpdate: updAuto ? 'autooff' : 'autoon' }, { on: updAuto });
      } else if (tab === 'perf') {
        sub('ЭФФЕКТЫ');
        const fx = window.BladeEffects ? window.BladeEffects.state() : null;
        const fxInfo = mk('bp-perf-hint');
        const modeNames = { vivid: 'Яркие', balanced: 'Сбалансированные', eco: 'Экономия' };
        fxInfo.textContent = fx ? (modeNames[fx.mode] || fx.mode) + (fx.paused ? ' · Пауза в фоне' : '') + (fx.battery ? ' · Экономия батареи' : '') : 'Контроллер эффектов недоступен';
        body.appendChild(fxInfo);
        sub('СТАРТ ПОСЛЕДНЕГО ОКНА');
        const box = mk('bp-perf-val');
        const fill = (line) => {
          box.textContent = '';
          const addLine = (txt) => { const l = mk('bp-lbl'); l.textContent = txt; box.appendChild(l); };
          const s = String(line || '').trim();
          if (!s) { addLine('Замеров ещё нет — перезапусти браузер'); return; }
          const parts = s.split(/\s+/);
          addLine('Замер: ' + parts[0] + (parts[1] ? ' · ' + parts[1] : ''));
          for (let i = 2; i < parts.length; i++) {
            const m = /^([a-z]+)=(\d+)ms$/.exec(parts[i]);
            if (m) addLine(m[1] + ' → ' + m[2] + ' ms');
          }
        };
        body.appendChild(box);
        // рендер из кэша — сразу; файл пишет текущая сессия, поэтому тут же
        // перечитываем и подменяем числа на месте, без переоткрытия меню
        fill(PERF_LINE);
        readPerfMark().then((line) => { try { fill(line); } catch (e) { mark('ERR perfFill ' + e); } });
        sub('ЧТО ЭТО');
        const hint = mk('bp-perf-hint');
        hint.textContent = 'dcl→load — скрипты · load→paint — отрисовка · ssr — сессия. Меньше — лучше.';
        body.appendChild(hint);
      }
      body.scrollTop = scrollTop;
      const images = body.querySelectorAll('.bp-wall-preview img[data-src]');
      if (images.length) {
        // Native XUL panels report every descendant as intersecting even when
        // it is clipped by their HTML scroll body. Compare actual rectangles.
        let frame = 0;
        const updateImages = () => {
          frame = 0;
          if (popup.state !== 'open' && popup.state !== 'showing') return;
          const clip = body.getBoundingClientRect();
          if (!clip.height || !clip.width) return;
          for (const image of images) {
            const rect = image.getBoundingClientRect();
            const visible = rect.bottom > clip.top - 80 && rect.top < clip.bottom + 80;
            if (visible && image.parentElement.dataset.failed !== 'true') {
              if (!image.hasAttribute('src')) image.src = image.dataset.src;
            } else {
              image.removeAttribute('src'); delete image.parentElement.dataset.loaded;
            }
          }
          popup.dataset.bgGate = 'active';
          popup.dataset.bgLoaded = String(Array.from(images).filter(image => image.hasAttribute('src')).length);
        };
        const scheduleImages = () => { if (!frame) frame = window.requestAnimationFrame(updateImages); };
        const cleanupImages = () => {
          if (frame) window.cancelAnimationFrame(frame); frame = 0;
          body.removeEventListener('scroll', scheduleImages);
          popup.removeEventListener('popupshown', scheduleImages);
          window.removeEventListener('resize', scheduleImages);
          window.removeEventListener('unload', cleanupImages);
          for (const image of images) image.removeAttribute('src');
          popup._bladeBgCleanup = null;
          popup.dataset.bgGate = 'cleaned'; popup.dataset.bgLoaded = '0';
        };
        popup._bladeBgCleanup = cleanupImages;
        body.addEventListener('scroll', scheduleImages, { passive:true });
        popup.addEventListener('popupshown', scheduleImages);
        window.addEventListener('resize', scheduleImages);
        window.addEventListener('unload', cleanupImages, { once:true });
        scheduleImages();
      }
      if (focused.length) {
        const replacement = Array.from(body.querySelectorAll('button')).find(el => focused.every(([key, value]) => el.dataset[key] === value));
        replacement?.focus({ preventScroll: true });
      }
    }
    function closeWallpaperPreview(popup, restoreFocus = true) {
      const overlay = popup.querySelector('.bp-wall-detail');
      if (!overlay) return;
      const trigger = popup._bladePreviewTrigger;
      overlay.querySelector('img')?.removeAttribute('src'); overlay.remove();
      for (const child of popup.querySelector('.bp-wrap').children) child.inert = false;
      popup._bladePreviewTrigger = null;
      if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll:true });
    }
    function openWallpaperPreview(popup, trigger) {
      closeWallpaperPreview(popup, false);
      const doc = popup.ownerDocument, H = 'http://www.w3.org/1999/xhtml';
      const make = (tag, cls) => { const el = doc.createElementNS(H, tag); el.className = cls; return el; };
      const card = trigger.parentElement.querySelector('.bp-wall-card');
      if (!card) return;
      const overlay = make('div', 'bp-wall-detail');
      overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'blade-wall-preview-title');
      const head = make('div', 'bp-detail-head');
      const back = make('button', 'bp-detail-back'); back.setAttribute('type', 'button'); back.dataset.bladePreviewClose = '1';
      back.textContent = '‹'; back.title = 'Назад к обоям'; back.setAttribute('aria-label', back.title);
      const title = make('h2', 'bp-detail-title'); title.id = 'blade-wall-preview-title'; title.textContent = card.title.replace(' (CSS-анимация)', '');
      head.append(back, title); overlay.appendChild(head);
      const stage = make('div', 'bp-detail-stage');
      const thumbnail = card.querySelector('img');
      const fallback = make('span', 'bp-wall-fallback'); fallback.textContent = 'Загрузка…';
      if (thumbnail?.dataset.src) {
        stage.appendChild(fallback);
        const image = make('img', 'bp-detail-image'); image.alt = title.textContent; image.setAttribute('decoding', 'async');
        image.addEventListener('load', () => fallback.remove(), { once:true });
        image.addEventListener('error', () => { image.removeAttribute('src'); fallback.textContent = 'Файл недоступен'; }, { once:true });
        image.src = thumbnail.dataset.src; stage.appendChild(image);
      } else if (!thumbnail) {
        const live = make('div', 'bp-detail-live'); live.style.background = card.querySelector('.bp-wall-preview').style.background;
        stage.appendChild(live);
      } else { fallback.textContent = 'Файл недоступен'; stage.appendChild(fallback); }
      overlay.appendChild(stage);
      const hint = make('p', 'bp-detail-hint'); hint.textContent = thumbnail ? 'Полное изображение без обрезки. Нажми Escape, чтобы вернуться.' : 'Кадр живого фона. Анимация включится после применения.';
      const apply = make('button', 'bp-row bp-detail-apply'); apply.setAttribute('type', 'button');
      apply.dataset.bobliksBg = card.dataset.bobliksBg;
      const current = card.classList.contains('on'); apply.textContent = current ? '✓ Уже установлен' : 'Применить этот фон';
      apply.setAttribute('aria-label', apply.textContent);
      overlay.append(hint, apply);
      const wrap = popup.querySelector('.bp-wrap');
      for (const child of wrap.children) child.inert = true;
      popup._bladePreviewTrigger = trigger; wrap.appendChild(overlay); back.focus();
    }
    function syncSound(popup) {
      const on = Services.prefs.getBoolPref('blade.sounds.on', true);
      const volume = Math.max(0, Math.min(100, Services.prefs.getIntPref('blade.sounds.volume', 100)));
      const slider = popup.querySelector('.bp-volume');
      if (slider) { slider.value = String(volume); slider.setAttribute('aria-valuetext', volume + '%'); }
      const value = popup.querySelector('.bp-volume-value');
      if (value) value.textContent = volume + '%';
      const mute = popup.querySelector('[data-blade-sound-mute]');
      if (mute) { mute.setAttribute('aria-pressed', String(!on)); mute.title = on ? 'Выключить звук' : 'Включить звук'; mute.setAttribute('aria-label', mute.title); mute.textContent = on ? '♪' : '−'; }
      const preview = popup.querySelector('[data-blade-sound-preview]');
      if (preview) preview.disabled = !on || volume === 0;
    }
    function ensurePopup(doc) {
      // Existing userChrome hover rules are USER !important. Override only
      // those legacy interactions at the same origin, with tighter scope.
      const hoverCSS = `@-moz-document url("chrome://browser/content/browser.xhtml") {
        #bobliks-settings-popup .bp-wrap :is(.bp-row,.bp-tab):hover {
          transform:none !important; background-image:none !important;
          border-color:#ffffff32 !important; box-shadow:inset 0 1px #ffffff0b !important;
        }
        #bobliks-settings-popup .bp-wrap .bp-row.bp-theme-card:hover {
          border-color:var(--sample-accent) !important; box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sample-accent) 20%,transparent) !important;
        }
        #bobliks-settings-popup .bp-wrap .bp-tab.on:hover { box-shadow:inset 0 -2px var(--bob-accent,#ff2a2a) !important; }
        #bobliks-settings-popup .bp-wrap :is(.bp-row,.bp-tab):focus {
          box-shadow:none !important; outline:none !important;
        }
        #bobliks-settings-popup .bp-wrap :is(.bp-row,.bp-tab):focus-visible {
          outline:2px solid var(--bob-accent,#ff2a2a) !important; outline-offset:-2px !important; box-shadow:none !important;
        }
        :root[data-blade-material-motion=off] #bobliks-settings-popup .bp-wrap :is(.bp-row,.bp-tab) { transition:none !important; }
        @media(prefers-reduced-motion:reduce) { #bobliks-settings-popup .bp-wrap :is(.bp-row,.bp-tab) { transition:none !important; } }
      }`;
      try {
        const sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
        const uri = Services.io.newURI('data:text/css;charset=UTF-8,' + encodeURIComponent(hoverCSS));
        if (!sss.sheetRegistered(uri, sss.USER_SHEET)) sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
      } catch (e) { mark('ERR interactionStyle ' + e); }
      if (!doc.getElementById('blade-menu-style')) {
        const st = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
        st.id = 'blade-menu-style';
        st.textContent = MENU_CSS;
        doc.documentElement.appendChild(st);
      }
      let popup = doc.getElementById(POPUP_ID);
      if (popup) return popup;
      const host = doc.getElementById('mainPopupSet') || doc.documentElement;
      popup = host.appendChild(doc.createXULElement('panel'));
      popup.id = POPUP_ID;
      const H = 'http://www.w3.org/1999/xhtml';
      const wrap = doc.createElementNS(H, 'div'); wrap.className = 'bp-wrap';
      const head = doc.createElementNS(H, 'div'); head.className = 'bp-head';
      const emblem = doc.createElementNS(H, 'span'); emblem.className = 'bp-emblem'; emblem.textContent = 'B'; emblem.setAttribute('aria-hidden', 'true');
      const brand = doc.createElementNS(H, 'div'); brand.className = 'bp-brand';
      const logo = doc.createElementNS(H, 'span'); logo.className = 'bp-logo'; logo.textContent = 'BLADE';
      const ver = doc.createElementNS(H, 'span'); ver.className = 'bp-ver';
      brand.append(logo, ver);
      const active = doc.createElementNS(H, 'div'); active.className = 'bp-head-theme'; active.title = 'Текущая тема';
      active.appendChild(doc.createElementNS(H, 'span'));
      head.append(emblem, brand, active);
      const tabs = doc.createElementNS(H, 'div'); tabs.className = 'bp-tabs';
      tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Разделы Blade');
      const SVGNS = 'http://www.w3.org/2000/svg';
      for (const t of BP_TABS) {
        const el = doc.createElementNS(H, 'button'); el.className = 'bp-tab'; el.setAttribute('type', 'button');
        el.dataset.tab = t.id;
        const svg = doc.createElementNS(SVGNS, 'svg');
        svg.setAttribute('class', 'bp-tico');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.6');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.innerHTML = t.icon;
        const lbl = doc.createElementNS(H, 'span'); lbl.className = 'bp-tlbl';
        lbl.textContent = ({theme:'Темы',bg:'Фон',tiles:'Плитки',update:'Обновы',perf:'Перф',system:'Система'})[t.id];
        el.appendChild(svg); el.appendChild(lbl);
        tabs.appendChild(el);
      }
      const body = doc.createElementNS(H, 'div'); body.className = 'bp-body';
      const foot = doc.createElementNS(H, 'div'); foot.className = 'bp-foot';
      const footLink = (label, ds) => {
        const r = doc.createElementNS(H, 'button'); r.className = 'bp-row'; r.setAttribute('type', 'button');
        const l = doc.createElementNS(H, 'span'); l.className = 'bp-lbl'; l.textContent = label;
        r.appendChild(l); for (const k in ds) r.dataset[k] = ds[k];
        foot.appendChild(r);
      };
      footLink('Папка img', { bobliksFolder: '1' });
      footLink('Диагностика', { bladeSupport: '1' });
      footLink('О Blade', { bladeAbout: '1' });
      const sound = doc.createElementNS(H, 'div'); sound.className = 'bp-sound';
      const mute = doc.createElementNS(H, 'button'); mute.setAttribute('type', 'button'); mute.dataset.bladeSoundMute = '1';
      const volumeBox = doc.createElementNS(H, 'div'); volumeBox.className = 'bp-volume-box';
      const volumeLabel = doc.createElementNS(H, 'label'); volumeLabel.textContent = 'Звук интерфейса'; volumeLabel.setAttribute('for', 'blade-menu-volume');
      const volume = doc.createElementNS(H, 'input'); volume.className = 'bp-volume'; volume.id = 'blade-menu-volume';
      volume.setAttribute('type', 'range'); volume.setAttribute('min', '0'); volume.setAttribute('max', '100'); volume.setAttribute('step', '1');
      volumeBox.append(volumeLabel, volume);
      const volumeValue = doc.createElementNS(H, 'span'); volumeValue.className = 'bp-volume-value';
      const sample = doc.createElementNS(H, 'button'); sample.setAttribute('type', 'button'); sample.dataset.bladeSoundPreview = '1'; sample.textContent = '▷'; sample.title = 'Прослушать звук'; sample.setAttribute('aria-label', sample.title);
      sound.append(mute, volumeBox, volumeValue, sample);
      volume.addEventListener('input', () => {
        const value = Math.max(0, Math.min(100, Number(volume.value) || 0));
        Services.prefs.setIntPref('blade.sounds.volume', value); syncSound(popup);
      });
      mute.addEventListener('click', () => {
        Services.prefs.setBoolPref('blade.sounds.on', !Services.prefs.getBoolPref('blade.sounds.on', true)); syncSound(popup);
      });
      sample.addEventListener('click', () => { try { window.BladeSounds?.play('select'); } catch (e) { mark('ERR soundPreview ' + e); } });
      wrap.append(head, tabs, body, sound, foot);
      popup.appendChild(wrap);
      // Содержимое обновляется при каждом ОТКРЫТИИ (popupshowing): точки
      // всегда актуальны (Gemini раунд 10)
      popup.addEventListener('popupshowing', (ev) => {
        if (ev.target !== popup) return;
        if (popup._bladeTileResume) { delete popup._bladeTileResume; return; }
        try { buildPopup(popup.ownerDocument, popup); } catch (e) { mark('ERR showing ' + e); }
      });
      popup.addEventListener('popupshown', (ev) => {
        if (ev.target !== popup || popup._bladeBgCleanup) return;
        if (Services.prefs.getStringPref('blade.menu.tab', 'theme') === 'bg') {
          try { buildPopup(doc, popup); } catch (e) { mark('ERR shownGallery ' + e); }
        }
      });
      popup.addEventListener('popuphidden', (ev) => {
        if (ev.target !== popup) return;
        // A delayed hidden event can arrive after the same native panel was
        // already reopened. It must not tear down that new gallery.
        if (popup.state === 'open' || popup.state === 'showing') {
          popup.dataset.bgHiddenIgnored = 'reopened'; return;
        }
        closeWallpaperPreview(popup, false);
        popup._bladeBgCleanup?.();
        for (const image of popup.querySelectorAll('.bp-wall-preview img')) image.removeAttribute('src');
      });
      popup.addEventListener('keydown', (ev) => {
        const overlay = popup.querySelector('.bp-wall-detail');
        if (!overlay) return;
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); closeWallpaperPreview(popup); }
        else if (ev.key === 'Tab') {
          const controls = Array.from(overlay.querySelectorAll('button'));
          const first = controls[0], last = controls[controls.length - 1];
          if (ev.shiftKey && doc.activeElement === first) { ev.preventDefault(); last.focus(); }
          else if (!ev.shiftKey && doc.activeElement === last) { ev.preventDefault(); first.focus(); }
        }
      }, true);
      // Один делегированный клик: вкладки, строки, подвал
      popup.addEventListener('click', async (ev) => {
        const zoom = ev.target.closest('[data-blade-wallpaper-preview]');
        if (zoom) { openWallpaperPreview(popup, zoom); return; }
        if (ev.target.closest('[data-blade-preview-close]')) { closeWallpaperPreview(popup); return; }
        const tabEl = ev.target.closest('.bp-tab');
        if (tabEl && tabEl.dataset.tab) {
          Services.prefs.setStringPref('blade.menu.tab', tabEl.dataset.tab);
          try { buildPopup(doc, popup); } catch (e) { mark('ERR tab ' + e); }
          return;
        }
        const rowEl = ev.target.closest('.bp-row');
        if (!rowEl) {
          // Папка-поколение (вкладка ФОН): аккордеон, меню не закрываем
          const foldEl = ev.target.closest('.bp-folder');
          if (foldEl && foldEl.dataset.bladeBgFold) {
            const p = 'blade.menu.bgfold.' + foldEl.dataset.bladeBgFold;
            try { Services.prefs.setBoolPref(p, !Services.prefs.getBoolPref(p, false)); } catch (e) {}
            try { buildPopup(doc, popup); } catch (e) { mark('ERR fold ' + e); }
          }
          return;
        }
        const ds = rowEl.dataset;
        let close = false;
        try {
          if (ds.bobliksTheme) {
            // Ручная смена темы глушит авто-тему: иначе циклер через минуту
            // молча вернёт свою (день/ночь) и решение юзера потеряется
            if (Services.prefs.getBoolPref('blade.autotheme.on', false)) {
              Services.prefs.setBoolPref('blade.autotheme.on', false);
            }
            window.BladeEngine.setTheme(ds.bobliksTheme);
          }
          else if (ds.bobliksBg) { await window.BladeEngine.setBg(ds.bobliksBg); }
          else if (ds.bladeVisage) { try { window.BladeVisages.applyVisage(ds.bladeVisage); close = true; } catch (e) { mark('ERR visage ' + e); } }
          else if (ds.bladeVisageSave === '1') { try { window.BladeVisages.saveVisage(); } catch (e) { mark('ERR visageSave ' + e); } }
          else if (ds.bobliksEdit === 'on') { Services.prefs.setBoolPref('bobliks.dial.edit', true); }
          else if (ds.bobliksEdit === 'off') { Services.prefs.clearUserPref('bobliks.dial.edit'); }
          // bladeReader on/off снесён 2026-09-13 вместе с инверт-механикой (Dark Reader)
          else if (ds.bladeUpdate === 'install') { try { window.BladeUpdater.install(); close = true; } catch (e) { mark('ERR updInst ' + e); } }
          else if (ds.bladeUpdate === 'check') { try { window.BladeUpdater.check(true); } catch (e) { mark('ERR updCheck ' + e); } }
          else if (ds.bladeUpdate === 'autoon') { Services.prefs.setBoolPref('blade.update.auto', true); }
          else if (ds.bladeUpdate === 'autooff') { Services.prefs.setBoolPref('blade.update.auto', false); }
          else if (ds.bladeHomeLayout === '1') { close = true; window.setTimeout(() => window.BladeHomeLayout?.begin(), 100); }
          else if (ds.bladeDefault === '1') { try { window.BladeUpdater.setDefault(); } catch (e) { mark('ERR setDefault ' + e); } close = true; }
          else if (ds.bladeDns) {
            // смена DoH: uri + mode; «off» глушит TRR целиком (mode 0)
            if (ds.bladeDns === 'off') {
              Services.prefs.setIntPref('network.trr.mode', 0);
            } else {
              Services.prefs.setStringPref('network.trr.uri', DNS_URI[ds.bladeDns]);
              Services.prefs.setIntPref('network.trr.mode', 2);
            }
          }
          else if (ds.bladePurge) {
            // принудительный GC/CC/минимизация памяти во всех процессах
            for (const topic of ['child-gc-request', 'child-cc-request', 'child-mmu-request']) {
              try { Services.obs.notifyObservers(null, topic); } catch (e) {}
            }
            try {
              const nb = window.gNotificationBox;
              nb.appendNotification('blade-ram-purge', {
                label: '⚡ Память очищена',
                image: 'chrome://browser/skin/notification-icons/popup.svg',
                priority: nb.PRIORITY_INFO_MEDIUM,
              }, [], false);
            } catch (e) { mark('ERR purgeNote ' + e); }
          }
          else if (ds.bladeSounds === 'on' || ds.bladeSounds === 'off') {
            Services.prefs.setBoolPref('blade.sounds.on', ds.bladeSounds === 'on');
          }
          else if (ds.bladeFxMode) { if (window.BladeEffects) window.BladeEffects.setMode(ds.bladeFxMode); }
          else if (ds.bladeIdle) {
            Services.prefs.setBoolPref('blade.idle.on',
              !Services.prefs.getBoolPref('blade.idle.on', true));
          }
          else if (ds.bladeAccountsManage === '1') {
            window.BladeAccounts.manage();
            close = true;
          }
          else if (ds.bladeAccountOpen || ds.bladeAccountSite) {
            const sameSite = !!ds.bladeAccountSite;
            const id = Number(ds.bladeAccountSite || ds.bladeAccountOpen);
            window.BladeAccounts.open(id, sameSite);
            close = true;
          }
          else if (ds.bladeBackup === '1') { close = true; window.BladeSystemTools.launchBackup(); }
          else if (ds.bladeAutoTheme === 'on') { Services.prefs.setBoolPref('blade.autotheme.on', true); }
          else if (ds.bladeAutoTheme === 'off') { Services.prefs.setBoolPref('blade.autotheme.on', false); }
          else if (ds.bladeIconPick) { try { Services.prefs.setStringPref('blade.icon.manual', ds.bladeIconPick); } catch (e) {} }
          else if (ds.bladeAutoDay === '1' || ds.bladeAutoNight === '1') {
            const isDay = (ds.bladeAutoDay === '1');
            const prefName = isDay ? 'blade.autotheme.day' : 'blade.autotheme.night';
            const curId = Services.prefs.getStringPref(prefName, isDay ? 'grey' : 'blood');
            const list = THEMES.filter(t => t.id !== 'custom');
            const cur = list.findIndex(t => t.id === curId);
            const next = list[((cur < 0 ? 0 : cur) + 1) % list.length];
            if (next) Services.prefs.setStringPref(prefName, next.id);
          }
          else if (ds.bladeIconAuto === '1') {
            try { Services.prefs.setStringPref('blade.icon.manual', ''); } catch (e) {}
          }
          else if (ds.bladeCustomBgFolder) { window.BladeEngine.getCustomBgDir().launch(); close = true; }
          else if (ds.bladePickBg) { close = true; window.BladeVisages.chooseCustomWallpaper(); }
          else if (ds.bladeLab) { close = true; window.BladeThemeLab.open(); }
          else if (ds.bobliksFolder) {
            close = true;
            try { window.BladeEngine.getImgDir().launch(); } catch (e) { try { window.BladeEngine.getImgDir().reveal(); } catch (e2) {} }
          }
          else if (ds.bladeSupport) { close = true; window.openTrustedLinkIn('about:support', 'tab'); }
          else if (ds.bladeAbout) {
            close = true;
            try { window.openDialog('chrome://browser/content/aboutDialog.xhtml', 'About Blade', 'chrome,centerscreen,dialog,resizable=no'); }
            catch (e2) { mark('ERR aboutDlg ' + e2); }
          }
        } catch (e) { mark('ERR cmd ' + e); }
        if (close) { try { popup.hidePopup(); } catch (e) {} }
        else { try { buildPopup(doc, popup); } catch (e) {} }
      });
      buildPopup(doc, popup);
      return popup;
    }
    // ═══════════════════════════════════════════════════════════════════
    // API — window.BladeMenuPopup. BladeMenuButton вешает command на кнопке
    // и hotkey на вызов open(); ensurePopup — для нетиповых встраиваний
    // ═══════════════════════════════════════════════════════════════════
    const open = (btn) => {
        try {
            const p = ensurePopup(btn.ownerDocument);
            p.openPopup(btn, 'after_start', 0, 0, false, false);
        } catch (e) { mark('ERR open ' + e); }
    };
    window.BladeMenuPopup = { ensurePopup, open };
    const refreshFx = () => {
      const popup = document.getElementById(POPUP_ID);
      if (popup && popup.state !== 'closed') buildPopup(document, popup);
    };
    window.Blade.bus.on('fx:changed', refreshFx);
    window.addEventListener('unload', () => window.Blade.bus.off('fx:changed', refreshFx), { once: true });
    mark('LOADED');
})();
