// ==UserScript==
// @name            Blade Theme Engine
// @description     Движок тем и фонов: каталоги, цветная математика кастомной
//                  темы, тематический щит USER_SHEET, живые атрибуты,
//                  setTheme/setBg и стартовая раскраска. Шаг 7 декомпозиции
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       8
// ==/UserScript==
// Вынесен из BobliksSettings.uc.js (шаг 7 декомпозиции, 2026-09-22): целиком
// секция THEMES+BGS — выделение/каталоги фонов, генерация переменных из цвета,
// USER_SHEET темы и фона, живые data-атрибуты, setTheme/setBg и старт boot().
// @loadOrder 8 — детерминированно РАНЬШЕ BobliksSettings (default 10):
// монолит зовёт window.BladeEngine.boot() в самом начале INIT.
// Цикл setTheme <-> applyThemeSheet <-> activeBg/setBg (риск 1) намеренно
// остаётся ВНУТРИ модуля: связанность данных локальна, разрыв через шину
// theme:changed добавил бы async-риск без выигрыша (ROADMAP-2.0 шаг 7 исходно
// планировал шину — отменено по тому же основанию).
(function () {
    if (window.BladeEngine) return;
    window.BladeEngine = true;

    // ═══════════════════════════════════════════════════════════════════
    // mark-файл (конвенция 2): первая строка v1.0.0 <event>
    // ═══════════════════════════════════════════════════════════════════
    let markPath = '';
    try {
        const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
        d.append('JS');
        markPath = d.path + '\\BladeThemeEngine_mark.txt';
    } catch (e) {}
    const mark = (m, e) => {
        try {
            if (!markPath) return;
            const text = 'v1.0.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
            IOUtils.writeUTF8(markPath, text).catch(() => {});
        } catch (e2) {}
    };

    // Единственный источник каталогов — BladeCore (@loadOrder 5, грузится
    // раньше). BUILTIN_BGS объявлен ниже внутри перенесённого блока
    const THEMES = window.Blade.themes;

    // Системный цвет выделения в полях ввода (urlbar, формы на сайтах):
    // CSS ::selection их не перебивает, а этот преф — да. Синхронизируем с темой.
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: THEMES: ВЫДЕЛЕНИЕ + СПИСОК ФОНОВ + КАТАЛОГ
    // syncSelectionPrefs..applyBgToDoc. ВНИМАНИЕ (риск 1): applyLiveAttrs ниже зовёт activeBg/applyBgToDoc — цикл Themes<->Bgs
    // ═══════════════════════════════════════════════════════════════════
    function syncSelectionPrefs(themeId) {
      const t = THEMES.find(x => x.id === themeId) || THEMES[0];
      const accent = (themeId === 'custom') ? getCustomColor() : t.accent;
      try {
        Services.prefs.setStringPref('ui.textSelectBackground', accent);
        Services.prefs.setStringPref('ui.textSelectForeground', '#ffffff');
      } catch (e) { mark('ERR selSync ' + e); }
    }
    const BUILTIN_BGS = window.Blade.builtinBgs;
    // BLADE_VISAGES + userVisage/allVisages/applyVisage/saveVisage вынесены в
    // BladeVisages.uc.js v1.0.0 (@loadOrder 12, API window.BladeVisages)
    function getImgDir() {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('img');
      return d;
    }
    // --- СВОИ ОБОИ (раунд 22): автоскан chrome/img/ — любой jpg/png/webp/gif/avif
    // попадает в меню. Преф-имя файла санитизируется (file_<safe>) — правила
    // генерит BobliksCovers в covers.css, контентный процесс их прочитает ---
    function bgPrefId(fileName) {
      // Реализация в BladeCore — единый хэш для Settings и Covers
      return window.Blade.bgPrefId(fileName);
    }
    // Кэш на окно: скан chrome/img/ вызывается из getAllBgs() при каждом
    // открытии меню и из applyThemeSheet. Инвалидация — через
    // window.BladeSettings.invalidateBgCache() из BladeVisages после копирования
    // нового файла
    let customBgsCache = null;
    function getCustomBgs() {
      if (customBgsCache) return customBgsCache;
      const customs = [];
      try {
        const dir = getImgDir();
        if (!dir.exists() || !dir.isDirectory()) return customs;
        const builtin = new Set(BUILTIN_BGS.filter(x => x.file).map(x => x.file.toLowerCase()));
        builtin.add('btn_blade.png');
        builtin.add('current_bg.jpg'); // мёртвый артефакт старого механизма
        const iter = dir.directoryEntries;
        while (iter.hasMoreElements()) {
          const entry = iter.getNext().QueryInterface(Ci.nsIFile);
          if (entry.isDirectory()) continue;
          const name = entry.leafName;
          if (!/[.](jpg|jpeg|png|webp|avif|gif)$/i.test(name)) continue;
          if (builtin.has(name.toLowerCase())) continue;
          const clean = name.replace(/[.][^.]+$/, '').replace(/^bg_/, '').replace(/[-_]+/g, ' ').trim();
          const label = clean.length > 22 ? clean.slice(0, 20) + '…' : clean;
          customs.push({
            id: 'file:' + name,
            label: '📁 ' + (label || name),
            file: name,
            isCustom: true,
            prefId: bgPrefId(name)
          });
        }
      } catch (e) { mark('ERR getCustomBgs ' + e); }
      customBgsCache = customs;
      return customs;
    }
    function getAllBgs() {
      return BUILTIN_BGS.concat(getCustomBgs());
    }
    function activeTheme() {
      // Последняя истинная по массиву — как в CSS-каскаде, где побеждает
      // последний @media -moz-pref-блок (v1.8)
      let id = 'red';
      for (const t of THEMES) { if (t.pref && Services.prefs.getBoolPref(t.pref, false)) id = t.id; }
      return id;
    }
    function activeBg() {
      const saved = Services.prefs.getStringPref('bobliks.bg.current', '');
      if (getAllBgs().some(x => x.id === saved)) return saved;
      return 'acheron';
    }
    // Живое внедрение кастомного фона (если newtab в родительском процессе;
    // для удалённой вкладки правила уже сгенерены в covers.css — сработают
    // после перезапуска, преф переключается живьём)
    function applyBgToDoc(doc, bgId) {
      try {
        if (!doc || !doc.documentElement) return;
        let st = doc.getElementById('blade-custom-bg-style');
        const b = getAllBgs().find(x => x.id === bgId);
        if (b && b.isCustom && b.file) {
          if (!st) {
            st = doc.createElement('style');
            st.id = 'blade-custom-bg-style';
            doc.documentElement.appendChild(st);
          }
          st.textContent = 'body.activity-stream { background: linear-gradient(180deg, rgba(10,10,12,0.35) 0%, rgba(10,10,12,0.10) 45%, rgba(10,10,12,0.25) 100%), #0a0a0a url("img/' + b.file + '") center bottom / cover no-repeat fixed !important; }';
        } else if (st) {
          st.remove();
        }
      } catch (e) {}
    }
    // --- СВОЯ ТЕМА: генерация всех переменных из одного базового цвета ---
    // Тематический щит (v1.8, обобщение кастомного канала v1.6 на ВСЕ темы):
    // переменные --bob-* активной темы регистрируются USER_SHEET'ом БЕЗ
    // @media-обёртки — перерегистрация листа принудительно рестайлит все
    // документы во всех процессах, включая remote-контент (newtab, сайты,
    // about:-страницы), до которого -moz-pref() в userContent.css не
    // доезжает без перезапуска. Снятие + повторная регистрация того же
    // листа и есть «перекрасить» (идемпотентно).
    let currentThemeSheetUri = null;
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: THEMES: ЩИТ И ЖИВОЕ ПЕРЕКЛЮЧЕНИЕ
    // applyThemeSheet(USER_SHEET)/customVars/applyCustomToDoc/newtabDocs/applyLiveAttrs/setTheme. applyThemeSheet читает getAllBgs (риск 1); setTheme эмитит theme:changed в шину (BladeSounds шинг). openThemeLab → BladeThemeLab.uc.js v1.0.0 (шаг 5)
    // ═══════════════════════════════════════════════════════════════════
    function applyThemeSheet(themeId) {
      try {
        const SSS = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
        if (currentThemeSheetUri) {
          if (SSS.sheetRegistered(currentThemeSheetUri, SSS.USER_SHEET)) {
            SSS.unregisterSheet(currentThemeSheetUri, SSS.USER_SHEET);
          }
          currentThemeSheetUri = null;
        }
        const t = THEMES.find(x => x.id === themeId) || THEMES[0];
        let accent, page;
        if (themeId === 'custom') {
          accent = getCustomColor();
          if (!/^#[0-9a-fA-F]{6}$/.test(accent)) return;
          page = customVars(accent)['--bob-page'];
        } else {
          accent = t.accent;
          page = t.page || '#0a0a0c';
        }
        const rgb = hexToRgb(accent);
        const rgbStr = rgb.join(', ');
        const contrast = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) > 150 ? '#0a0a0c' : '#fff';
        let cssText = ':root { ' +
          '--bob-accent: ' + accent + ' !important;' +
          ' --bob-accent-rgb: ' + rgbStr + ' !important;' +
          ' --bob-accent-contrast: ' + contrast + ' !important;' +
          ' --bob-page: ' + page + ' !important; }';
        // Фон newtab в тот же щит: только встроенным фонам с файлом; URL —
        // абсолютный file:// (относительный url() в data:-листе не
        // разрешается). Кастомные обои красит отдельный applyCustomBgSheet,
        // CSS-анимации (pulse/flow) живут только в userContent.css.
        let bgNote = '';
        const bg = getAllBgs().find(x => x.id === activeBg());
        if (bg && !bg.isCustom && bg.file) {
          const f = getImgDir();
          f.append(bg.file);
          if (f.exists()) {
            cssText += ' @-moz-document url("about:home"), url("about:newtab") { body.activity-stream { ' +
              'background: linear-gradient(180deg, rgba(10,10,12,0.35) 0%, rgba(10,10,12,0.10) 45%, rgba(10,10,12,0.25) 100%), ' +
              '#0a0a0a url("' + PathUtils.toFileURI(f.path) + '") center bottom / cover no-repeat fixed !important; } }';
            bgNote = ' bg=' + bg.id;
          }
        }
        const uri = Services.io.newURI('data:text/css,' + encodeURIComponent(cssText), null, null);
        if (!SSS.sheetRegistered(uri, SSS.USER_SHEET)) SSS.loadAndRegisterSheet(uri, SSS.USER_SHEET);
        currentThemeSheetUri = uri;
        mark('OK themeSheet ' + themeId + bgNote);
      } catch (e) { mark('ERR themeSheet ' + e); }
    }
    function getCustomColor() {
      try { return Services.prefs.getStringPref('blade.theme.customColor', '#ff2a2a'); }
      catch (e) { return '#ff2a2a'; }
    }
    function hexToRgb(hex) {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
      if (!m) return [255, 42, 42];
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function customVars(color) {
      const rgb = hexToRgb(color);
      const c = rgb.map(x => x / 255);
      const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
      let h = 0;
      if (mx !== mn) {
        const d = mx - mn;
        if (mx === c[0]) h = ((c[1] - c[2]) / d + 6) % 6;
        else if (mx === c[1]) h = (c[2] - c[0]) / d + 2;
        else h = (c[0] - c[1]) / d + 4;
        h = Math.round(h * 60);
      }
      const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      customVars._selText = lum > 0.65 ? '#000000' : '#ffffff';
      return {
        '--accent': color,
        '--accent-soft': 'rgba(' + rgb.join(', ') + ', 0.35)',
        '--bg': 'hsl(' + h + ', 22%, 4%)',
        '--panel': 'hsl(' + h + ', 22%, 8%)',
        '--panel-hover': 'hsl(' + h + ', 22%, 13%)',
        '--text': 'hsl(' + h + ', 15%, 92%)',
        '--bob-accent': color,
        '--bob-page': 'hsl(' + h + ', 22%, 4%)'
      };
    }
    // Ставит/снимает кастомные переменные + ::selection на документе
    function applyCustomToDoc(doc, color) {
      try {
        const el = doc.documentElement;
        if (!el) return;
        for (const p of ['--accent', '--accent-soft', '--bg', '--panel', '--panel-hover', '--text',
                         '--bob-accent', '--bob-page']) {
          el.style.removeProperty(p);
        }
        let st = doc.getElementById('blade-custom-sel');
        if (color) {
          const v = customVars(color);
          for (const k of Object.keys(v)) el.style.setProperty(k, v[k]);
          if (!st) {
            st = doc.createElement('style');
            st.id = 'blade-custom-sel';
            el.appendChild(st);
          }
          st.textContent = '::selection, input::selection, textarea::selection, ' +
            '#urlbar-input::selection, .urlbar-input::selection { background-color: ' + color +
            ' !important; color: ' + customVars._selText + ' !important; }';
        } else if (st) {
          st.remove();
        }
      } catch (e) {}
    }
    // --- ЖИВОЕ ПЕРЕКЛЮЧЕНИЕ ЧЕРЕЗ АТРИБУТЫ -----------------------------------
    // -moz-pref() в юзер-стилях иногда замерзает до перезапуска: префы меняются,
    // а стили не переоцениваются («фоны и темы перестают меняться»). Атрибут на
    // документе триггерит обычный пересчёт стилей — работает всегда. Префы
    // остаются источником правды для холодного старта; в CSS лежат дубли на
    // [data-blade-theme] / [data-blade-bg] с большей специфичностью.
    function newtabDocs() {
      // Обходим ВСЕ окна браузера (Gemini раунд 10) и берём currentURI:
      // у <browser> нет documentURI — старый вариант всегда возвращал []
      const docs = [];
      try {
        const wins = Services.wm.getEnumerator('navigator:browser');
        while (wins.hasMoreElements()) {
          const w = wins.getNext();
          if (!w.gBrowser) continue;
          for (const tab of w.gBrowser.tabs) {
            const b = tab.linkedBrowser;
            if (!b) continue;
            try {
              const spec = b.currentURI ? b.currentURI.spec : '';
              if (/^about:(newtab|home)/.test(spec) && !b.isRemoteBrowser && b.contentDocument) {
                docs.push(b.contentDocument);
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
      return docs;
    }
    function applyLiveAttrs() {
      try {
        const theme = activeTheme();
        const bg = activeBg();
        const customColor = (theme === 'custom') ? getCustomColor() : null;
        // интерфейс: все открытые окна браузера (#main-window = :root)
        try {
          const wins = Services.wm.getEnumerator('navigator:browser');
          while (wins.hasMoreElements()) {
            const w = wins.getNext();
            try {
              w.document.documentElement.setAttribute('data-blade-theme', theme);
              applyCustomToDoc(w.document, customColor);
            } catch (e) {}
          }
        } catch (e) {}
        // открытые новые вкладки: в FF155 они remote, цикл практически пуст —
        // контент красит тематический щит applyThemeSheet
        for (const d of newtabDocs()) {
          try {
            d.documentElement.setAttribute('data-blade-theme', theme);
            d.documentElement.setAttribute('data-blade-bg', bg);
            applyCustomToDoc(d, customColor);
            applyBgToDoc(d, bg);
          } catch (e) {}
        }
      } catch (e) { mark('ERR liveAttrs ' + e); }
    }
    // --- КОНСТРУКТОР ТЕМ: вынесен в BladeThemeLab.uc.js v1.0.0
    //     (@loadOrder 12, API window.BladeThemeLab.open). Цветная математика
    //     (customVars/hexToRgb/applyCustomToDoc/getCustomColor/applyLiveAttrs)
    //     осталась здесь и уйдёт в BladeThemeEngine (шаг 7) ---
    function setTheme(themeId) {
      for (const t of THEMES) { if (t.pref) Services.prefs.clearUserPref(t.pref); }
      const t = THEMES.find(x => x.id === themeId);
      if (t && t.pref) Services.prefs.setBoolPref(t.pref, true);
      syncSelectionPrefs(themeId);
      applyLiveAttrs();
      // Тематический щит — для ЛЮБОЙ темы, включая red: единственный живой
      // канал до remote-контента (newtab, скроллбары сайтов, about:-страницы)
      applyThemeSheet(themeId);
      // Звуковая волна 2.0: объявляем смену темы в шину — BladeSounds играет
      // шинг тембра новой темы (data-blade-theme уже обновлён выше)
      try {
        if (window.Blade && window.Blade.bus) window.Blade.bus.emit('theme:changed', themeId);
      } catch (e) {}
    }
    // Живой фон через nsIStyleSheetService USER_SHEET (раунд 23): новая
    // вкладка удалённая, DOM не дотянуться — а юзер-щит доходит до контентного
    // процесса и применяется МГНОВЕННО, без перезапуска
    let currentCustomBgUri = null;
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: BGS: ЩИТ ФОНА + SETBG
    // applyCustomBgSheet/setBg. setBg зовёт applyThemeSheet (риск 1)
    // ═══════════════════════════════════════════════════════════════════
    function applyCustomBgSheet(fileLeafName) {
      try {
        const SSS = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
        if (currentCustomBgUri) {
          if (SSS.sheetRegistered(currentCustomBgUri, SSS.USER_SHEET)) {
            SSS.unregisterSheet(currentCustomBgUri, SSS.USER_SHEET);
          }
          currentCustomBgUri = null;
        }
        if (!fileLeafName) return;
        const file = getImgDir();
        file.append(fileLeafName);
        if (!file.exists()) return;
        const fileUri = PathUtils.toFileURI(file.path);
        const cssText = '@-moz-document url("about:home"), url("about:newtab") { ' +
          ':root body.activity-stream { ' +
          'background: linear-gradient(180deg, rgba(10,10,12,0.35) 0%, rgba(10,10,12,0.10) 45%, rgba(10,10,12,0.25) 100%), ' +
          '#0a0a0a url("' + fileUri + '") center bottom / cover no-repeat fixed !important; } }';
        const sheetUri = Services.io.newURI('data:text/css,' + encodeURIComponent(cssText), null, null);
        if (!SSS.sheetRegistered(sheetUri, SSS.USER_SHEET)) {
          SSS.loadAndRegisterSheet(sheetUri, SSS.USER_SHEET);
        }
        currentCustomBgUri = sheetUri;
        mark('OK customBgSheet ' + fileLeafName);
      } catch (e) { mark('ERR customBgSheet ' + e); }
    }
    function setBg(bgId) {
      const b = getAllBgs().find(x => x.id === bgId);
      if (!b) return;
      // CSS-фоны (file: null) идут мимо файлов — им нужен только преф
      if (b.file) {
        const src = getImgDir().clone(); src.append(b.file);
        if (!src.exists()) { mark('FAIL no file ' + b.file); return; }
      }
      // Префы — источник правды; правила кастомных генерит BobliksCovers
      Services.prefs.setStringPref('bobliks.bg.current', bgId);
      for (const x of BUILTIN_BGS) Services.prefs.clearUserPref('bobliks.bg.' + x.id);
      for (const x of getCustomBgs()) Services.prefs.clearUserPref('bobliks.bg.' + x.prefId);
      if (bgId !== 'acheron') {
        Services.prefs.setBoolPref('bobliks.bg.' + (b.isCustom ? b.prefId : bgId), true);
      }
      // Кастомный — мгновенно через юзер-щит; штатный — снять юзер-щит
      applyCustomBgSheet(b.isCustom && b.file ? b.file : null);
      applyLiveAttrs();
      // перегенерировать тематический щит: в нём же правило фона newtab
      applyThemeSheet(activeTheme());
      mark('OK setBg=' + bgId);
    }
    // ═══════════════════════════════════════════════════════════════════
    // STARTUP — стартовая последовательность (ПОРЯДОК ВАЖЕН, риск 7).
    // Вызывается из INIT монолита (boot зовётся после загрузки этого
    // модуля): selection->themeSheet->liveAttrs->customBgSheet. Плитки
    // newtab, docObs (PiP-неон), виджет и keyset остаются в монолите —
    // они к движку тем отношения не имеют.
    // Идемпотентна: повторный вызов безопасен (щиты перерегистрируются).
    // ═══════════════════════════════════════════════════════════════════
    function boot() {
        try {
            // blade.reader.on снесён 2026-09-13 (Dark Reader); преференс сайтов
            // остаётся «тёмный» — сайты с родной тёмной темой включают её сами
            Services.prefs.setIntPref('layout.css.prefers-color-scheme.content-override', 2);
            const savedTheme = activeTheme();
            syncSelectionPrefs(savedTheme);
            applyThemeSheet(savedTheme);
        } catch (e) { mark('ERR sync', e); }

        try {
            applyLiveAttrs();
            // сохранённый кастомный фон — юзер-щит живёт только до перезапуска
            const initBg = getAllBgs().find(x => x.id === activeBg());
            if (initBg && initBg.isCustom && initBg.file) applyCustomBgSheet(initBg.file);
        } catch (e) { mark('ERR attrsInit', e); }
        mark('OK boot');
    }

    // ═══════════════════════════════════════════════════════════════════
    // API — window.BladeEngine. window.BladeSettings делегирует сюда же
    // (обратная совместимость: BladeThemeLab/BladeVisages/BladePalette/
    // BladeAutoTheme работают через window.BladeSettings и ничего не замечают)
    // ═══════════════════════════════════════════════════════════════════
    window.BladeEngine = {
        boot,
        // каталоги (сырой массив тем: .pref/.accent/.page — нужно buildPopup)
        themes: () => THEMES,
        getAllBgs, getCustomBgs, bgPrefId,
        // текущее состояние
        activeTheme, activeBg, getImgDir,
        invalidateBgCache: () => { customBgsCache = null; },
        // запись
        setTheme, setBg, applyThemeSheet, applyCustomBgSheet,
        applyLiveAttrs, syncSelectionPrefs,
        // цветная математика кастомной темы (для BladeThemeLab)
        getCustomColor, customVars, hexToRgb, applyCustomToDoc,
        // живое внедрение в документы
        applyBgToDoc, newtabDocs,
    };
    mark('LOADED');
})();
