// ==UserScript==
// @name            Blade Menu Popup
// @description     Панель меню «B»: вкладки ТЕМА/ФОН/ПЛИТКИ/ОБНОВЫ/ПЕРФ/
//                  СИСТЕМА, рендер строк, делегированный клик-диспетчер.
//                  Шаг 8 декомпозиции BobliksSettings
// @author          Blade-Creations
// @include         main
// @version         1.0.0
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
            const text = 'v1.0.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
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
    const MENU_CSS = `
      #bobliks-settings-popup::part(content) {
        appearance: none; -moz-appearance: none;
        border: 1px solid color-mix(in srgb, var(--bob-accent, var(--accent, #ff2a2a)) 80%, transparent);
        border-radius: 10px;
        padding: 0;
        /* part(content) — единственная поверхность, реально рисующая фон panel
           в FF155. backdrop-filter здесь мёртв: panel — отдельное нативное
           окно ОС и не сэмплирует родителя, полупрозрачный фон просто
           проваливается в системный чёрный. Поэтому даём плотный материал:
           базовый вертикальный градиент + верхний блик + акцентный подмес
           снизу (тема читается даже без рамки). --bob-accent инжектит
           BladeThemeEngine USER_SHEET-ом гарантированно (PROJECT_MAP конв. 26) */
        background:
          linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 38%, transparent 100%),
          linear-gradient(180deg, color-mix(in srgb, var(--bob-accent, #ff2a2a) 7%, #181820) 0%, #0d0d13 62%, color-mix(in srgb, var(--bob-accent, #ff2a2a) 4%, #0a0a0e) 100%);
        box-shadow: 0 14px 50px rgba(0,0,0,0.85), 0 0 30px color-mix(in srgb, var(--bob-accent, #ff2a2a) 20%, transparent), inset 0 1px 0 rgba(255,255,255,0.07);
        overflow: hidden;
      }
      .bp-wrap { width: 352px; font-family: var(--blade-ui, 'Rubik', 'Segoe UI', sans-serif); color: #e9e9ee; animation: bp-in .16s ease-out; }
      @keyframes bp-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
      .bp-head { display: flex; align-items: center; gap: 9px; padding: 12px 14px 9px; }
      .bp-logo { font-family: var(--blade-display, 'Unbounded', sans-serif); font-weight: 800; font-size: 15px; letter-spacing: 2px; color: #fff; text-shadow: 0 0 14px color-mix(in srgb, var(--bob-accent, #ff2a2a) 70%, transparent); }
      .bp-ver { font-family: var(--blade-mono, 'JetBrains Mono', monospace); font-size: 10.5px; font-weight: 700; color: var(--bob-accent, #ff2a2a); border: 1px solid color-mix(in srgb, var(--bob-accent, #ff2a2a) 45%, transparent); background: color-mix(in srgb, var(--bob-accent, #ff2a2a) 12%, transparent); border-radius: 20px; padding: 2px 9px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bp-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 8px 8px 9px; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .bp-tab {
        position: relative; overflow: hidden;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
        min-height: 48px; padding: 6px 2px;
        border-radius: 2px;
        border: 1px solid rgba(255,255,255,0.06);
        background-color: #131214;
        background-image: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.35) 55%, color-mix(in srgb, var(--bob-accent, #ff2a2a) 20%, transparent) 100%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        color: #8f8f9c;
        font-size: 9.5px; font-weight: 700; letter-spacing: 0.6px;
        cursor: pointer;
        transition: color 0.12s ease, background 0.16s ease, border-color 0.12s ease, box-shadow 0.16s ease, transform 0.12s ease;
      }
      .bp-tab svg { width: 16px; height: 16px; flex: none; }
      .bp-tab:hover { color: #e8e8f0; transform: translateY(-1px); border-color: rgba(255,255,255,0.12); }
      .bp-tab.on {
        color: var(--bob-accent, #ff2a2a);
        border-color: color-mix(in srgb, var(--bob-accent, #ff2a2a) 55%, transparent);
        background-image: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, color-mix(in srgb, var(--bob-accent, #ff2a2a) 14%, #0d0d10) 55%, color-mix(in srgb, var(--bob-accent, #ff2a2a) 34%, transparent) 100%);
        box-shadow: inset 0 -2px 0 var(--bob-accent, #ff2a2a), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 16px -10px color-mix(in srgb, var(--bob-accent, #ff2a2a) 80%, transparent);
        text-shadow: 0 0 10px color-mix(in srgb, var(--bob-accent, #ff2a2a) 60%, transparent);
      }
      .bp-body { max-height: 46vh; overflow-y: auto; padding: 8px 8px 10px; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--bob-accent, #ff2a2a) 55%, transparent) transparent; }
      .bp-sub { font-size: 9.5px; font-weight: 700; letter-spacing: 1.8px; color: #6f6f7c; padding: 10px 4px 5px; }
      .bp-row {
        display: flex; align-items: center; gap: 9px;
        margin: 3px 0; padding: 7px 10px;
        border-radius: 2px;
        border: 1px solid rgba(255,255,255,0.05);
        background-color: #15141a;
        background-image: linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(0,0,0,0.30) 55%, color-mix(in srgb, var(--bob-accent, #ff2a2a) 13%, transparent) 100%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        font-size: 13px; color: #c9c9d2; cursor: pointer;
        transition: color 0.12s ease, background 0.16s ease, border-color 0.12s ease, box-shadow 0.16s ease, transform 0.12s ease;
      }
      .bp-row:hover { color: #fff; transform: translateY(-1px); border-color: color-mix(in srgb, var(--bob-accent, #ff2a2a) 45%, transparent); box-shadow: inset 0 -2px 0 var(--bob-accent, #ff2a2a), inset 0 1px 0 rgba(255,255,255,0.07); }
      .bp-dot { width: 8px; height: 8px; border-radius: 1px; border: 1.5px solid #55555f; flex: none; }
      .bp-row.on .bp-dot { background: var(--bob-accent, #ff2a2a); border-color: var(--bob-accent, #ff2a2a); box-shadow: 0 0 8px color-mix(in srgb, var(--bob-accent, #ff2a2a) 70%, transparent); }
      .bp-row.on { color: var(--bob-accent, #ff2a2a); font-weight: 600; border-color: color-mix(in srgb, var(--bob-accent, #ff2a2a) 55%, transparent); box-shadow: inset 0 -2px 0 var(--bob-accent, #ff2a2a), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 16px -10px color-mix(in srgb, var(--bob-accent, #ff2a2a) 80%, transparent); }
      .bp-row.on:hover { color: #fff; }
      .bp-chip { width: 12px; height: 12px; border-radius: 2px; flex: none; border: 1px solid rgba(255,255,255,0.25); }
      .bp-row.on .bp-chip { box-shadow: 0 0 0 2px color-mix(in srgb, var(--bob-accent, #ff2a2a) 45%, transparent); }
      .bp-row.accent { color: var(--bob-accent, #ff2a2a); font-weight: 700; }
      .bp-lbl { flex: 1; }
      .bp-foot { display: flex; gap: 4px; border-top: 1px solid rgba(255,255,255,0.08); padding: 6px 8px 8px; }
      .bp-foot .bp-row { flex: 1; justify-content: center; font-size: 11.5px; color: #9a9aa6; padding: 6px 4px; }
      .bp-foot .bp-row:hover { color: #fff; }
      /* Смена вкладки: контент мягко въезжает (transform+opacity) */
      .bp-body.bp-anim { animation: bp-body-in .18s ease-out; }
      @keyframes bp-body-in {
        from { opacity: 0; transform: translateX(8px); }
        to   { opacity: 1; transform: none; }
      }
      /* Вкладка ПЕРФ: строки замеров — не строки-кнопки, отступ как у sub */
      .bp-perf-val { padding: 2px 4px; font-family: var(--blade-mono, 'JetBrains Mono', monospace); }
      .bp-perf-val .bp-lbl { font-size: 12px; color: #b9b9c4; padding: 2px 0; font-family: var(--blade-mono, 'JetBrains Mono', monospace); }
      .bp-perf-hint { font-size: 11px; color: #8a8f98; padding: 2px 4px 6px; }
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
      // Обновляем активную вкладку + тело панели под преф blade.menu.tab
      const tab = Services.prefs.getStringPref('blade.menu.tab', 'theme');
      popup.querySelectorAll('.bp-tab').forEach((el) => {
        el.classList.toggle('on', el.dataset.tab === tab);
      });
      const ver = popup.querySelector('.bp-ver');
      if (ver) ver.textContent = BLADE_VERSION ? ('v' + BLADE_VERSION + (BLADE_CODENAME ? ' · ' + BLADE_CODENAME : '')) : '';
      const body = popup.querySelector('.bp-body');
      if (!body) return;
      body.innerHTML = '';
      const H = 'http://www.w3.org/1999/xhtml';
      const mk = (cls) => { const el = doc.createElementNS(H, 'div'); el.className = cls; return el; };
      const sub = (label) => { const el = mk('bp-sub'); el.textContent = label; body.appendChild(el); };
      const row = (label, ds, o) => {
        o = o || {};
        const r = mk('bp-row' + (o.on ? ' on' : '') + (o.accent ? ' accent' : ''));
        if (o.chip) { const c = mk('bp-chip'); c.style.background = o.chip; r.appendChild(c); }
        else if (!o.noDot) { r.appendChild(mk('bp-dot')); }
        const l = mk('bp-lbl'); l.textContent = label; r.appendChild(l);
        for (const k in ds) r.dataset[k] = ds[k];
        body.appendChild(r);
      };
      if (tab === 'theme') {
        const curTheme = window.BladeEngine.activeTheme();
        for (const t of THEMES) {
          row(t.label, { bobliksTheme: t.id }, { on: curTheme === t.id, chip: t.accent });
        }
        row('Конструктор темы…', { bladeLab: '1' }, { noDot: true });
        // ОБЛИКИ: готовое сочетание «тема + фон» одним кликом; «Мой Облик»
        // появляется только после первого сохранения
        sub('ОБЛИКИ');
        const curBgV = window.BladeEngine.activeBg();
        for (const v of window.BladeVisages.allVisages()) {
          row(v.label, { bladeVisage: v.id }, { on: (curTheme === v.theme && curBgV === v.bg) });
        }
        row('Сохранить текущее как «Мой Облик»', { bladeVisageSave: '1' }, { noDot: true });
        // АВТО-ТЕМА: смена день/ночь по часам (8:00 / 20:00). Темы для слотов
        // циклятся кликом по строке; ручной выбор темы при включённой авто
        // её глушит — иначе циклер через минуту молча вернёт свою
        sub('АВТО-ТЕМА');
        const autoOn = Services.prefs.getBoolPref('blade.autotheme.on', false);
        row('Смена день/ночь автоматически (8:00 / 20:00)', { bladeAutoTheme: autoOn ? 'off' : 'on' }, { on: autoOn });
        const autoLbl = (id) => { const t = THEMES.find(x => x.id === id); return t ? t.label : id; };
        row('Тема дня: ' + autoLbl(Services.prefs.getStringPref('blade.autotheme.day', 'grey')), { bladeAutoDay: '1' });
        row('Тема ночи: ' + autoLbl(Services.prefs.getStringPref('blade.autotheme.night', 'blood')), { bladeAutoNight: '1' });
      } else if (tab === 'bg') {
        const curBg = window.BladeEngine.activeBg();
        for (const b of window.BladeEngine.getAllBgs()) {
          row(b.label, { bobliksBg: b.id }, { on: curBg === b.id });
        }
        row('+ Выбрать свой файл обоев…', { bladePickBg: '1' }, { noDot: true });
      } else if (tab === 'tiles') {
        const editOn = Services.prefs.getBoolPref('bobliks.dial.edit', false);
        row('Режим правки (кнопка «...» на плитках)', { bobliksEdit: editOn ? 'off' : 'on' }, { on: editOn });
      } else if (tab === 'system') {
        // «ЧТЕНИЕ / Принудительный тёмный» снесено 2026-09-13: тёмный режим
        // сайтов делает Dark Reader (ставится политикой), наш инверт удалён
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
        const sndOn = Services.prefs.getBoolPref('blade.sounds.on', true);
        row('Звуки интерфейса (GX)', { bladeSounds: sndOn ? 'off' : 'on' }, { on: sndOn });
        const idleOn = Services.prefs.getBoolPref('blade.idle.on', true);
        row('Заставка простоя (3 мин)', { bladeIdle: idleOn ? 'off' : 'on' }, { on: idleOn });
        row('Очистить память', { bladePurge: '1' }, { noDot: true });
        sub('БЭКАП');
        row('Сохранить профиль в zip', { bladeBackup: '1' }, { noDot: true });
        sub('WINDOWS');
        row('Сделать браузером по умолчанию', { bladeDefault: '1' }, { noDot: true });
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
      // Перезапуск анимации въезда контента (reflow сбрасывает класс)
      body.classList.remove('bp-anim');
      void body.offsetWidth;
      body.classList.add('bp-anim');
    }
    function ensurePopup(doc) {
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
      const logo = doc.createElementNS(H, 'span'); logo.className = 'bp-logo'; logo.textContent = '⚡ BLADE';
      const ver = doc.createElementNS(H, 'span'); ver.className = 'bp-ver';
      head.appendChild(logo); head.appendChild(ver);
      const tabs = doc.createElementNS(H, 'div'); tabs.className = 'bp-tabs';
      const SVGNS = 'http://www.w3.org/2000/svg';
      for (const t of BP_TABS) {
        const el = doc.createElementNS(H, 'div'); el.className = 'bp-tab';
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
        const lbl = doc.createElementNS(H, 'span'); lbl.className = 'bp-tlbl'; lbl.textContent = t.label;
        el.appendChild(svg); el.appendChild(lbl);
        tabs.appendChild(el);
      }
      const body = doc.createElementNS(H, 'div'); body.className = 'bp-body';
      const foot = doc.createElementNS(H, 'div'); foot.className = 'bp-foot';
      const footLink = (label, ds) => {
        const r = doc.createElementNS(H, 'div'); r.className = 'bp-row';
        const l = doc.createElementNS(H, 'span'); l.className = 'bp-lbl'; l.textContent = label;
        r.appendChild(l); for (const k in ds) r.dataset[k] = ds[k];
        foot.appendChild(r);
      };
      footLink('Папка img', { bobliksFolder: '1' });
      footLink('Диагностика', { bladeSupport: '1' });
      footLink('О Blade', { bladeAbout: '1' });
      wrap.appendChild(head); wrap.appendChild(tabs); wrap.appendChild(body); wrap.appendChild(foot);
      popup.appendChild(wrap);
      // Содержимое обновляется при каждом ОТКРЫТИИ (popupshowing): точки
      // всегда актуальны (Gemini раунд 10)
      popup.addEventListener('popupshowing', () => {
        try { buildPopup(popup.ownerDocument, popup); } catch (e) { mark('ERR showing ' + e); }
      });
      // Один делегированный клик: вкладки, строки, подвал
      popup.addEventListener('click', async (ev) => {
        const tabEl = ev.target.closest('.bp-tab');
        if (tabEl && tabEl.dataset.tab) {
          Services.prefs.setStringPref('blade.menu.tab', tabEl.dataset.tab);
          try { buildPopup(doc, popup); } catch (e) { mark('ERR tab ' + e); }
          return;
        }
        const rowEl = ev.target.closest('.bp-row');
        if (!rowEl) return;
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
          else if (ds.bladeVisage) { try { window.BladeVisages.applyVisage(ds.bladeVisage); } catch (e) { mark('ERR visage ' + e); } }
          else if (ds.bladeVisageSave === '1') { try { window.BladeVisages.saveVisage(); } catch (e) { mark('ERR visageSave ' + e); } }
          else if (ds.bobliksEdit === 'on') { Services.prefs.setBoolPref('bobliks.dial.edit', true); }
          else if (ds.bobliksEdit === 'off') { Services.prefs.clearUserPref('bobliks.dial.edit'); }
          // bladeReader on/off снесён 2026-09-13 вместе с инверт-механикой (Dark Reader)
          else if (ds.bladeUpdate === 'install') { try { window.BladeUpdater.install(); close = true; } catch (e) { mark('ERR updInst ' + e); } }
          else if (ds.bladeUpdate === 'check') { try { window.BladeUpdater.check(true); } catch (e) { mark('ERR updCheck ' + e); } }
          else if (ds.bladeUpdate === 'autoon') { Services.prefs.setBoolPref('blade.update.auto', true); }
          else if (ds.bladeUpdate === 'autooff') { Services.prefs.setBoolPref('blade.update.auto', false); }
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
          else if (ds.bladeIdle) {
            Services.prefs.setBoolPref('blade.idle.on',
              !Services.prefs.getBoolPref('blade.idle.on', true));
          }
          else if (ds.bladeBackup === '1') { close = true; window.BladeSystemTools.launchBackup(); }
          else if (ds.bladeAutoTheme === 'on') { Services.prefs.setBoolPref('blade.autotheme.on', true); }
          else if (ds.bladeAutoTheme === 'off') { Services.prefs.setBoolPref('blade.autotheme.on', false); }
          else if (ds.bladeAutoDay === '1' || ds.bladeAutoNight === '1') {
            // Цикл темы слота: следующий id из THEMES без 'custom' — конструктор
            // не может быть автослотом (у него нет фиксированного вида)
            const isDay = (ds.bladeAutoDay === '1');
            const prefName = isDay ? 'blade.autotheme.day' : 'blade.autotheme.night';
            const curId = Services.prefs.getStringPref(prefName, isDay ? 'grey' : 'blood');
            const list = THEMES.filter(t => t.id !== 'custom');
            const cur = list.findIndex(t => t.id === curId);
            const next = list[((cur < 0 ? 0 : cur) + 1) % list.length];
            if (next) Services.prefs.setStringPref(prefName, next.id);
          }
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
    mark('LOADED');
})();
