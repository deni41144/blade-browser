// ==UserScript==
// @name            Bobliks Settings
// @description     Кнопка настроек Bobliks-Creations: смена темы и фона в один клик
// @author          Bobliks-Creations
// @include         main
// @version         1.14.5
// ==/UserScript==
// ═══════════════════════════════════════════════════════════════════════
// КАРТА ФАЙЛА (Волна 2 «Blade Studio», разметка по карте Analyst):
//   CORE — контракт/диагностика/версия/CUI (26)
//   ДАННЫЕ — THEMES/DNS константы (92)
//   THEMES+BGS — вынесены в BladeThemeEngine.uc.js v1.0.0 (@loadOrder 8, 103)
//   VISAGES — вынесены в BladeVisages.uc.js v1.0.0 (@loadOrder 12, 119)
//   SYSTEM — уведомления/бэкап вынесены в BladeSystemTools.uc.js v1.0.0 (128)
//   MENU — CSS, вкладки, рендер, dispatcher, виджет, клавиши (136)
//   INIT — boot()->плитки->docObs->виджет->keyset (порядок важен) (453)
//   API — window.BladeSettings: делегирует в движок (743)
//   ФИНАЛ — mark/catch (765)
// Риски 1-10 и план полной неймспейс-декомпозиции — ROADMAP-2.0.md раздел 10.
// ═══════════════════════════════════════════════════════════════════════
(function () {
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: CORE — контракт, диагностика, версия, CUI-bootstrap
    // WIDGET_ID/mark/BLADE_VERSION/PERF_LINE/CustomizableUI; Core не имеет зависимостей
    // ═══════════════════════════════════════════════════════════════════
  const WIDGET_ID = 'bobliks-settings-button';
  const POPUP_ID  = 'bobliks-settings-popup';
  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\bobliks_settings_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.14.5 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };
    mark('START');
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
    try {
    // --- CustomizableUI: неубиваемый двойной фолбэк ---
    let CustomizableUI = null;
    try { CustomizableUI = window.CustomizableUI; if (CustomizableUI) mark('CUI window'); } catch (e0) {}
    if (!CustomizableUI) {
      try { CustomizableUI = ChromeUtils.importESModule('resource:///modules/CustomizableUI.sys.mjs').CustomizableUI; mark('CUI esm'); }
      catch (e1) { mark('CUI esm fail', e1); }
    }
    // Третий фолбэк через JSM удалён: в FF155 CustomizableUI.jsm не существует,
    // ветка падала всегда
    if (!CustomizableUI) { mark('ERR no CUI'); return; }
    // Массив тем живёт в BladeCore (единый источник для Settings/ChromeStyle;
    // там же поле selFg — цвет текста выделения на акценте)
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: ДАННЫЕ — темы, DoH (общие константы)
    // THEMES/DNS_URI — единственный источник: BladeCore. Каталоги фонов
    // (BUILTIN_BGS) уехали вместе с движком в BladeThemeEngine.uc.js
    // ═══════════════════════════════════════════════════════════════════
    const THEMES = window.Blade.themes;
    // DoH-провайдеры для секции DNS-ЗАЩИТА (mode 2: TRR-first, фолбэк на системный DNS)
    const DNS_URI = {
      cloudflare: 'https://cloudflare-dns.com/dns-query',
      adguard:    'https://dns.adguard-dns.com/dns-query',
      quad9:      'https://dns.quad9.net/dns-query',
    };
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: THEMES+BGS — ВЫНЕСЕНА в BladeThemeEngine.uc.js v1.0.0
    // (@loadOrder 8 — грузится детерминированно РАНЬШЕ этого скрипта;
    // API window.BladeEngine). Каталоги фонов, цветная математика кастомной
    // темы, тематический щит USER_SHEET, живые data-атрибуты, setTheme/setBg
    // и стартовая раскраска boot(). Монолит зовёт boot() в INIT; цикл
    // setTheme <-> setBg остался внутри модуля — данные локальны (риск 1
    // переехал вместе с кодом; разрыв через шину отменён — async-риск без
    // выигрыша, подробнее ROADMAP-2.0 шаг 7). Контракт window.BladeSettings
    // делегирует в движок — BladeThemeLab/BladeVisages/BladePalette/
    // BladeAutoTheme не замечают переезда.
    // THEMES — контракт BladeCore — читается здесь напрямую: buildPopup и
    // keyset работают с сырым массивом (.pref/.accent/.page), как и раньше.
    // ═══════════════════════════════════════════════════════════════════

    // --- ОБЛИКИ КЛИНКА: пресеты «тема + фон» одним кликом ---
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: VISAGES — вынесена в BladeVisages.uc.js v1.0.0
    // (@loadOrder 12, API window.BladeVisages: allVisages/applyVisage/
    //  saveVisage/chooseCustomWallpaper). setTheme/setBg/activeTheme/
    //  activeBg/getImgDir/invalidateBgCache открыты как контракт
    // для этого модуля; шаг 7 уберет их в BladeThemeEngine
    // ════════════════════════════════════════════════════════════
    // Локальное уведомление в nb окна (сигнатура FF155 — как notify() в
    // BladeUpdater): appendNotification(type, {label, image, priority})
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: SYSTEM — уведомления, бэкап
    // notifyBlade/launchBackup вынесены в BladeSystemTools.uc.js v1.0.0
    // (@loadOrder 12, API window.BladeSystemTools.launchBackup)
    // ═══════════════════════════════════════════════════════════════════
    // ПАНЕЛЬ МЕНЮ (GX, вкладочная): кастомный panel с HTML внутри.
    // Рамка/фон/тени — только через ::part(content): в FF155 попапы рисуются
    // в Shadow DOM (проверено ранее на панелях).
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: MENU — CSS, вкладки, рендер, dispatcher, виджет, клавиши
    // MENU_CSS/BP_TABS/buildPopup(риск 3)/ensurePopup+dispatcher(риск 2)/виджет B/onBuild/keyset(риск 9). Dispatcher — шов Menu->все секции
    // ═══════════════════════════════════════════════════════════════════
    const MENU_CSS = `
      #bobliks-settings-popup::part(content) {
        appearance: none; -moz-appearance: none;
        border: 1px solid color-mix(in srgb, var(--accent, #ff2a2a) 80%, transparent);
        border-radius: 14px;
        padding: 0;
        background: linear-gradient(180deg, #17171f 0%, #0a0a0e 100%);
        box-shadow: 0 14px 50px rgba(0,0,0,0.85), 0 0 30px color-mix(in srgb, var(--accent, #ff2a2a) 20%, transparent);
        overflow: hidden;
      }
      .bp-wrap { width: 352px; font-family: var(--blade-ui, 'Rubik', 'Segoe UI', sans-serif); color: #e9e9ee; animation: bp-in .16s ease-out; }
      @keyframes bp-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
      .bp-head { display: flex; align-items: center; gap: 9px; padding: 12px 14px 9px; }
      .bp-logo { font-family: var(--blade-display, 'Unbounded', sans-serif); font-weight: 800; font-size: 15px; letter-spacing: 2px; color: #fff; text-shadow: 0 0 14px color-mix(in srgb, var(--accent, #ff2a2a) 70%, transparent); }
      .bp-ver { font-family: var(--blade-mono, 'JetBrains Mono', monospace); font-size: 10.5px; font-weight: 700; color: var(--accent, #ff2a2a); border: 1px solid color-mix(in srgb, var(--accent, #ff2a2a) 45%, transparent); background: color-mix(in srgb, var(--accent, #ff2a2a) 12%, transparent); border-radius: 20px; padding: 2px 9px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bp-tabs { display: flex; gap: 2px; padding: 0 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .bp-tab { flex: 1; text-align: center; font-size: 10.5px; font-weight: 700; letter-spacing: 0.8px; color: #8f8f9c; padding: 7px 2px 8px; cursor: pointer; border-radius: 6px 6px 0 0; border-bottom: 2px solid transparent; }
      .bp-tab:hover { color: #dcdce4; background: rgba(255,255,255,0.04); }
      .bp-tab.on { color: #fff; border-bottom-color: var(--accent, #ff2a2a); background: color-mix(in srgb, var(--accent, #ff2a2a) 12%, transparent); text-shadow: 0 0 10px color-mix(in srgb, var(--accent, #ff2a2a) 60%, transparent); }
      .bp-body { max-height: 46vh; overflow-y: auto; padding: 6px 4px 8px; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--accent, #ff2a2a) 55%, transparent) transparent; }
      .bp-sub { font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #7f7f8c; padding: 9px 12px 3px; }
      .bp-row { display: flex; align-items: center; gap: 9px; margin: 1px 5px; padding: 7px 10px; border-radius: 8px; font-size: 13px; color: #c9c9d2; cursor: pointer; transition: transform 0.12s ease, background 0.12s ease; }
      .bp-row:hover { transform: translateY(1px); background: color-mix(in srgb, var(--accent, #ff2a2a) 15%, transparent); color: #fff; box-shadow: inset 2px 0 0 var(--accent, #ff2a2a); }
      .bp-dot { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid #55555f; flex: none; }
      .bp-row.on .bp-dot { background: var(--accent, #ff2a2a); border-color: var(--accent, #ff2a2a); box-shadow: 0 0 8px color-mix(in srgb, var(--accent, #ff2a2a) 70%, transparent); }
      .bp-row.on { color: var(--accent, #ff2a2a); font-weight: 600; }
      .bp-row.on:hover { color: #fff; }
      .bp-chip { width: 12px; height: 12px; border-radius: 50%; flex: none; border: 1px solid rgba(255,255,255,0.25); }
      .bp-row.on .bp-chip { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #ff2a2a) 45%, transparent); }
      .bp-row.accent { color: var(--accent, #ff2a2a); font-weight: 700; }
      .bp-lbl { flex: 1; }
      .bp-foot { display: flex; border-top: 1px solid rgba(255,255,255,0.08); padding: 4px 6px; }
      .bp-foot .bp-row { flex: 1; justify-content: center; font-size: 11.5px; color: #9a9aa6; }
      .bp-foot .bp-row:hover { box-shadow: none; color: #fff; }
      /* Смена вкладки: контент мягко въезжает (transform+opacity) */
      .bp-body.bp-anim { animation: bp-body-in .18s ease-out; }
      @keyframes bp-body-in {
        from { opacity: 0; transform: translateX(8px); }
        to   { opacity: 1; transform: none; }
      }
      /* Вкладка ПЕРФ: строки замеров — не строки-кнопки, отступ как у sub */
      .bp-perf-val { padding: 2px 12px; font-family: var(--blade-mono, 'JetBrains Mono', monospace); }
      .bp-perf-val .bp-lbl { font-size: 12px; color: #b9b9c4; padding: 2px 0; font-family: var(--blade-mono, 'JetBrains Mono', monospace); }
      .bp-perf-hint { font-size: 11px; color: #8a8f98; padding: 2px 12px 6px; }
    `;
    const BP_TABS = [
      { id: 'theme',  label: 'ТЕМА' },
      { id: 'bg',     label: 'ФОН' },
      { id: 'tiles',  label: 'ПЛИТКИ' },
      { id: 'update', label: 'ОБНОВЫ' },
      { id: 'perf',   label: 'ПЕРФ' },
      { id: 'system', label: 'СИСТЕМА' },
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
      for (const t of BP_TABS) {
        const el = doc.createElementNS(H, 'div'); el.className = 'bp-tab';
        el.textContent = t.label; el.dataset.tab = t.id;
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
    // Синхронизация Blade Reader и выделения при старте (THEMES уже объявлен)
    // Авто-тема день/ночь вынесена в BladeAutoTheme.uc.js v1.0.0 (@loadOrder 12)
    // — внешний клиент API: читает data-blade-theme, переключает setTheme()
    // ═══════════════════════════════════════════════════════════════════

    // СЕКЦИЯ: INIT — стартовая последовательность (ПОРЯДОК ВАЖЕН, риск 7)
    // reader->selection->themeSheet->liveAttrs->customBgSheet->seeding->docObs->виджет->keyset. Каждый блок — try с mark-диагностикой.
    // Очистка — BladeHousekeeping.uc.js; эффекты окна (лазер/ghost/splash/idle) — BladeWindowFx.uc.js (оба @loadOrder 12, свои mark-файлы)
    // Очистка (about-стиль, verticalTabs, чистильщик, «Чистый лист», закладки) вынесена
    // в BladeHousekeeping.uc.js (@loadOrder 12, свой mark-файл) — гоняется отдельным скриптом
    // ═══════════════════════════════════════════════════════════════════
    try {
      // Движок тем/фонов грузится @loadOrder 8 — детерминированно раньше
      // этого скрипта — и сам делает стартовую раскраску: override->
      // selection->themeSheet->liveAttrs->customBgSheet (см. boot() в
      // BladeThemeEngine.uc.js). fail-режим: движок не загрузился — браузер
      // остаётся без темы, ERR boot пишется в mark (Pulse ловит виджет).
      window.BladeEngine.boot();
    } catch (e) { mark('ERR boot', e); }

    // About-стиль, verticalTabs, чистильщик вкладок, «Чистый лист» (меню +
    // закладки) вынесены в BladeHousekeeping.uc.js v1.0.0 (@loadOrder 12)

    // ПЛИТКИ НОВОЙ ВКЛАДКИ: пиннам НАШИ сайты при первом запуске (раунд 25)
    (async () => {
      const tileLog = (m) => {
        try {
          const df = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
          df.append('JS'); df.append('tiles_log.txt');
          IOUtils.writeUTF8(df.path, m).catch(()=>{});
        } catch (e) {}
      };
      tileLog('START');
      try {
        if (Services.prefs.getBoolPref('blade.tiles.seeded', false)) return;
        // toolkit-модуль: resource://gre/, НЕ resource:/// (browser omni его не содержит)
        const { NewTabUtils } = ChromeUtils.importESModule('resource://gre/modules/NewTabUtils.sys.mjs');
        const SITES = [
          { url: 'https://youtube.com',       title: 'YouTube' },
          { url: 'https://music.youtube.com', title: 'YouTube Music' },
          { url: 'https://instagram.com',     title: 'Instagram' },
          { url: 'https://www.olx.ua',        title: 'OLX' },
          { url: 'https://pinterest.com',     title: 'Pinterest' },
          { url: 'https://rozetka.com.ua',    title: 'Rozetka' },
          { url: 'https://temu.com',          title: 'Temu' },
          { url: 'https://aliexpress.com',    title: 'AliExpress' },
          { url: 'https://mail.google.com',   title: 'Gmail' },
          { url: 'https://classroom.google.com', title: 'Classroom' }
        ];
        for (let i = 0; i < SITES.length; i++) {
          try {
            NewTabUtils.pinnedLinks.pin({ url: SITES[i].url, title: SITES[i].title, baseDomain: SITES[i].url.replace('https://','').split('/')[0] }, i);
            tileLog('PIN ' + i + ': ' + SITES[i].url);
          } catch (e) { tileLog('ERR pin ' + SITES[i].url + ' ' + e); }
        }
        Services.prefs.setBoolPref('blade.tiles.seeded', true);
        tileLog('SEEDED OK');
      } catch (e) { tileLog('ERR ' + e + ' | ' + (e.stack || '').slice(0, 200)); }
    })();

    // Атрибуты живого переключения (хром) + старт юзер-щитов. Ветка newtab
    // в observer удалена (v1.8): about:newtab всегда remote — её документы
    // вставляются в контентном процессе и сюда не доходит; контент красит
    // тематический щит applyThemeSheet.
    try {
      // Атрибуты живого переключения и старт юзер-щитов — в
      // BladeThemeEngine.boot() (модуль @loadOrder 8 отработал раньше).
      // Здесь остаётся только PiP-неон: observer на вставку документа.
      // Ветка newtab удалена (v1.8): about:newtab всегда remote — её
      // документы вставляются в контентном процессе и сюда не доходит;
      // контент красит тематический щит движка.
      const TE = window.BladeEngine;
      const docObs = (doc) => {
        try {
          if (!doc || !doc.documentElement) return;
          const url = doc.documentURI || '';
          // PiP-плеер: неоновая рамка в цвет темы (окно родительское —
          // observer сюда доходит; Gemini раунд 13)
          if (url.includes('pictureinpicture/player.xhtml')) {
            try {
              if (doc.getElementById('blade-pip-neon')) return;
              const theme = TE.activeTheme();
              const t = THEMES.find(x => x.id === theme) || THEMES[0];
              const accent = (theme === 'custom') ? TE.getCustomColor() : t.accent;
              const st = doc.createElement('style');
              st.id = 'blade-pip-neon';
              st.textContent =
                'body { border: 1px solid ' + accent + ' !important; ' +
                'box-shadow: 0 0 16px color-mix(in srgb, ' + accent + ' 45%, transparent) !important; ' +
                'border-radius: 8px !important; overflow: hidden !important; background: #0a0a0c !important; } ' +
                '.controls, #controls { background: rgba(10, 10, 14, 0.82) !important; backdrop-filter: blur(12px) !important; } ' +
                /* селекторы из chrome/toolkit/content/global/pictureinpicture/player.xhtml */
                '.control-button { background: rgba(255,255,255,0.07) !important; ' +
                'border: 1px solid rgba(255,255,255,0.16) !important; border-radius: 8px !important; } ' +
                '#scrubber, #audio-scrubber, #playback-rate-slider { accent-color: ' + accent + ' !important; } ' +
                '#timestamp { color: #e8e8ea !important; text-shadow: 0 1px 4px rgba(0,0,0,0.9) !important; } ' +
                '#controls-bottom-gradient { display: none !important; } ' +
                '.panel { background: #14141a !important; border: 1px solid rgba(255,255,255,0.16) !important; border-radius: 10px !important; } ' +
                'button:hover { color: ' + accent + ' !important; filter: drop-shadow(0 0 6px ' + accent + ') !important; }';
              doc.documentElement.appendChild(st);
            } catch (e) {}
            return;
          }
        } catch (e) {}
      };
      Services.obs.addObserver(docObs, 'document-element-inserted');
      // Утечка (v1.8): раньше КАЖДОЕ окно вешало свой observer навсегда.
      // Снимаем при закрытии окна: пока жив хоть один экземпляр — живёт и
      // observer. Guard-преф не годится — пережил бы перезапуск и навсегда
      // погасил бы PiP-неон в новых сессиях.
      window.addEventListener('unload', () => {
        try { Services.obs.removeObserver(docObs, 'document-element-inserted'); } catch (e) {}
      });
    } catch (e) { mark('ERR attrsInit', e); }

    // Эффекты окна (лазер загрузки, ghost-карточка, сплеш, заставка простоя)
    // вынесены в BladeWindowFx.uc.js v1.0.0 (@loadOrder 12, свой mark-файл)

    // 1.14.4: CustomizableUI в FF155 не строит узел и не сохраняет плейсмент
    // позднерегистрируемого custom-виджета (placement без DOM — тот же корень,
    // что у часов в 1.9.2; свежие профили установщика оставались без кнопки B,
    // Pulse RED node-menub, живой тест 2026-09-14). Переведено на прямую
    // DOM-вставку — нативный паттерн движка, как BladeClock. Регистрацию через
    // CustomizableUI.createWidget убрали полностью: в старых профилях CUI
    // построил бы кнопку по сохранённому плейсменту + наша вставка = дубликат;
    // неизвестный id движок сам выкинет из стейта при следующем сохранении
    // (штатная санитизация, миграция безопасна).
    // Структура узла — та же, что была в onBuild: ребёнок .toolbarbutton-icon
    // несёт весь облик кнопки (иконка btn_blade, рамка, ховер, пульсации тем
    // из userChrome 5.1 «живые темы»); слушатель command вешаем сами.
    const buildMenuButton = (doc) => {
      const btn = doc.createXULElement('toolbarbutton');
      btn.id = WIDGET_ID;
      btn.className = 'toolbarbutton-1 chromeclass-toolbar-additional';
      btn.setAttribute('label', 'Blade');
      btn.setAttribute('tooltiptext', 'Настройки Blade (тема, фон, плитки)');
      const icon = doc.createXULElement('image');
      icon.className = 'toolbarbutton-icon';
      btn.appendChild(icon);
      btn.addEventListener('command', () => {
        try {
          const p = ensurePopup(btn.ownerDocument);
          p.openPopup(btn, 'after_start', 0, 0, false, false);
        } catch (e) { mark('ERR open ' + e); }
      });
      return btn;
    };
    // Эталон BladeClock: гвард дублей → nav-bar → вставка перед overflow-кнопкой,
    // иначе appendChild.
    // 1.14.5: дубль кнопки (живой тест стенда): ранний mount попадал под
    // buildArea CustomizableUI — узел стэшился, ретрай вставлял второго,
    // стэш возвращался = две кнопки. Монтирование перенесено на
    // browser-delayed-startup-finished (nav-bar финален) + таймер-страховка
    // 2.5с + дедуп.
    const mountMenuButton = () => {
      try {
        const doc = window.document;
        const nav = doc.getElementById('nav-bar');
        if (!nav) return;
        // Гвард + дедуп-броня одним запросом: узел уже есть — выходим;
        // если пережили ДВА узла — оставляем последний, младшие сносим
        // и тоже выходим (кнопка уже есть, лишние убраны)
        const dups = doc.querySelectorAll('#' + WIDGET_ID);
        if (dups.length > 1) {
          for (let i = 0; i < dups.length - 1; i++) dups[i].remove();
          return;
        }
        if (dups.length) return;
        const btn = buildMenuButton(doc);
        const anchor = doc.getElementById('nav-bar-overflow-button');
        if (anchor && anchor.parentElement === nav) nav.insertBefore(btn, anchor);
        else nav.appendChild(btn);
      } catch (e) { mark('ERR menub-mount ' + e); }
    };
    // Монтирование ТОЛЬКО после завершения стартовой инициализации окна,
    // когда nav-bar уже финален и CustomizableUI его больше не перестраивает.
    // Топик глобальный (main-процесс), фильтровать не нужно: mountMenuButton
    // сам гвардится в СВОЁМ окне (getElementById) и по отсутствию nav-bar;
    // окно уже загружено к моменту топика.
    const tryMount = () => mountMenuButton();
    const onDelayedStartup = () => {
      try {
        // наблюдатель разовый: сняли себя и смонтировали
        Services.obs.removeObserver(onDelayedStartup, 'browser-delayed-startup-finished');
        tryMount();
      } catch (e) { mark('ERR menub-obs ' + e); }
    };
    Services.obs.addObserver(onDelayedStartup, 'browser-delayed-startup-finished');
    // Наблюдатель держит замыкание — на unload окна снимаем, чтобы не течь
    window.addEventListener('unload', () => {
      try { Services.obs.removeObserver(onDelayedStartup, 'browser-delayed-startup-finished'); } catch (e) {}
    }, { once: true });
    // Страховка: если топик уже успел пройти до регистрации наблюдателя
    // (скрипт поздний) — таймер вставит кнопку; оба пути идемпотентны
    setTimeout(tryMount, 2500);
    // Кнопка загрузок обязана быть в тулбаре: после обновления движка FF155
    // виджет выпадал из nav-bar — панель загрузок становилась недоступна
    // (репорт владельца 2026-09-14). ensure-плейсмент идемпотентен: если
    // кнопка уже на месте — ничего не делает
    try {
      // строго: кнопка обязана жить в nav-bar (после FF155 выпадала в
      // overflow/palette — панель загрузок становилась недоступна)
      const pl = CustomizableUI && CustomizableUI.getPlacementOfWidget('downloads-button');
      if (!pl || pl.area !== 'nav-bar') {
        CustomizableUI.addWidgetToArea('downloads-button', 'nav-bar');
        mark('OK downloads-button restored');
      }
    } catch (e) { mark('ERR dlbtn ' + e); }
    // Блокировка плитки aha-music (Shazam): фича отозвана владельцем 2026-09-14
    // («калл, плитка не удаляется»). Через штатный NewTabUtils — работает и для
    // frecency-плиток (новые визиты больше не воскресают), и для pinned.
    // Идемпотентно: link уже заблокирован — no-op
    // Страховка клика по кнопке загрузок: на некоторых профилях встроенный
    // обработчик виджета мёртв (кнопка есть, клик не открывает панель — репорт
    // владельца 2026-09-14). Наш command-обработчик открывает панель напрямую
    // через движковый DownloadsPanel (downloads.js). Гвард от двойного
    // открытия: если панель уже открыта — выходим
    try {
      const dlBtn = window.document.getElementById('downloads-button');
      if (dlBtn && !dlBtn.dataset.bladeDlHook) {
        dlBtn.dataset.bladeDlHook = '1';
        dlBtn.addEventListener('command', (ev) => {
          try {
            const DP = window.DownloadsPanel;
            // isPanelShowing — геттер downloads.js:235 (включая состояние
            // закрытия); showPanel(openedManually) — открывает и грузит данные
            if (DP && !DP.isPanelShowing) {
              DP.showPanel(true);
              mark('OK dl panel shown');
            }
          } catch (e) { mark('ERR dlShow ' + e); }
        });
        mark('OK dl hook');
      }
    } catch (e) { mark('ERR dlHook ' + e); }
    try {
      const NTU = ChromeUtils.importESModule('resource://gre/modules/NewTabUtils.sys.mjs').NewTabUtils;
      const shazamUrl = 'https://aha-music.com/';
      if (NTU && NTU.blockedLinks && !NTU.blockedLinks.isBlocked({ url: shazamUrl })) {
        NTU.blockedLinks.block({ url: shazamUrl });
        mark('OK shazam tile blocked');
      }
    } catch (e) { mark('ERR shazamBlock ' + e); }
    // Горячие клавиши ЧЕРЕЗ KEYSET: настоящие <key> работают при любом фокусе,
    // включая страницу (window-keydown из контента не долетал — баг красной команды №11)
    try {
      // toggleReader (F2) снесён 2026-09-13 вместе с blade.reader.on: тёмный
      // режим сайтов делает Dark Reader, хоткей-лабиринты — вето конвенции 12
      const cycleTheme = (dir) => {
        const cur = THEMES.findIndex(t => t.pref && Services.prefs.getBoolPref(t.pref, false));
        const next = THEMES[((cur < 0 ? 0 : cur) + dir + THEMES.length) % THEMES.length];
        window.BladeEngine.setTheme(next.id);
      };
      const keyset = window.document.getElementById('mainKeyset');
      if (keyset) {
        const mkKey = (id, keyAttr, mods, fn) => {
          const k = window.document.createXULElement('key');
          k.setAttribute('id', id);
          // VK_* — виртуальные клавиши (F1 и пр.) идут через keycode, не key
          if (keyAttr.startsWith('VK_')) k.setAttribute('keycode', keyAttr);
          else k.setAttribute('key', keyAttr);
          if (mods) k.setAttribute('modifiers', mods);
          k.addEventListener('command', fn);
          keyset.appendChild(k);
        };
        // F2 (reader) снесён 2026-09-13 — Dark Reader и конвенция 12
        mkKey('blade-key-theme-prev', 'F2', 'shift', () => cycleTheme(-1));
        mkKey('blade-key-theme-next', 'F3', 'shift', () => cycleTheme(1));
        // Alt+B и F1: открыть меню Blade из любого места (раунд 20; F1 —
        // клавиша справки свободна, дефолтную помощь Blade не использует)
        const openBladeMenu = () => {
          try {
            const btn = window.document.getElementById(WIDGET_ID);
            const popup = ensurePopup(window.document);
            if (btn && popup) popup.openPopup(btn, 'after_start', 0, 0, false, false);
          } catch (e) { mark('ERR menuKey ' + e); }
        };
        mkKey('blade-key-menu', 'B', 'alt', openBladeMenu);
        mkKey('blade-key-menu-f1', 'VK_F1', null, openBladeMenu);
        mark('OK keys');
      } else {
        mark('ERR no mainKeyset');
      }
    } catch (e) { mark('ERR keys', e); }

    // АВТО-ТЕМА ДЕНЬ/НОЧЬ: меняет тему по часам (8:00 / 20:00). Почему таймер,
    // а не планировщик: окно живёт в своей сессии, cycles достаточно раз в
    // минуту — граница часа ловится с точностью до 60 с, чего достаточно.
    // Каждое окно циклит само (как и прочая живая синхронизация файла);
    // setTheme идемпотентен — гонки между окнами безвредны.
    // ═══════════════════════════════════════════════════════════════════
    // Авто-тема (циклер день/ночь) — BladeAutoTheme.uc.js (@loadOrder 12)

    // ---- API для будущей командной палитры (по образцу window.BladeUpdater) ----
    // Гварда не нужно: fx-autoconfig запускает скрипт один раз на окно, а при
    // повторном запуске в том же окне ссылка просто перезапишется на свежие
    // функции того же скоупа — состояния не ломаются
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: API — window.BladeSettings: тонкая делегация (риск 8).
    // Шаг 7: темы/фоны уехали в BladeThemeEngine.uc.js (@loadOrder 8) —
    // каждый метод просто перенаправляет в window.BladeEngine. Внешние
    // клиенты (BladeThemeLab/BladeVisages/BladePalette/BladeAutoTheme)
    // работают через этот контракт и переезда не замечают. Реализация
    // должна оставаться делегирующей стрелкой — прямой проброс указателя
    // сломал бы все потребители, если бы движок не загрузился.
    // ═══════════════════════════════════════════════════════════════════
    window.BladeSettings = {
      themes: () => window.BladeEngine.themes().map(t => ({ id: t.id, label: t.label })),
      bgs: () => window.BladeEngine.getAllBgs().map(b => ({ id: b.id, label: b.label })),
      setTheme: (id) => window.BladeEngine.setTheme(id),
      setBg: (id) => window.BladeEngine.setBg(id),
      // Цветная математика конструктора темы (клиент — BladeThemeLab, шаг 5)
      customVars: (...a) => window.BladeEngine.customVars(...a),
      hexToRgb: (...a) => window.BladeEngine.hexToRgb(...a),
      applyCustomToDoc: (...a) => window.BladeEngine.applyCustomToDoc(...a),
      applyLiveAttrs: () => window.BladeEngine.applyLiveAttrs(),
      getCustomColor: () => window.BladeEngine.getCustomColor(),
      // Чтение текущих темы/фона, каталог img, инвалидация кэша скана
      // (клиент — BladeVisages, шаг 6)
      activeTheme: () => window.BladeEngine.activeTheme(),
      activeBg: () => window.BladeEngine.activeBg(),
      getImgDir: () => window.BladeEngine.getImgDir(),
      invalidateBgCache: () => window.BladeEngine.invalidateBgCache(),
      // Облики — BladeVisages.uc.js v1.0.0 (шаг 6)
      visages: () => window.BladeVisages.allVisages().map(v => ({ id: v.id, label: v.label })),
      applyVisage: (id) => window.BladeVisages.applyVisage(id),
      saveVisage: () => window.BladeVisages.saveVisage(),
      toggleSounds() { const on = !Services.prefs.getBoolPref('blade.sounds.on', true); Services.prefs.setBoolPref('blade.sounds.on', on); return on; },
      toggleIdle() { const v = !Services.prefs.getBoolPref('blade.idle.on', true); Services.prefs.setBoolPref('blade.idle.on', v); return v; },
      backup() { window.BladeSystemTools.launchBackup(); },
    };

    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: ФИНАЛ — mark OK / catch fatal
    // ═══════════════════════════════════════════════════════════════════
    mark('OK widget');
  } catch (e) {
    mark('ERR fatal', e);
    console.error('Bobliks fatal:', e);
  }
})();
