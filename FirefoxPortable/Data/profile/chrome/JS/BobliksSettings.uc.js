// ==UserScript==
// @name            Bobliks Settings
// @description     Кнопка настроек Bobliks-Creations: смена темы и фона в один клик
// @author          Bobliks-Creations
// @include         main
// @version         1.11.0
// ==/UserScript==
(function () {
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
      const text = 'v1.11.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
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
    const THEMES = window.Blade.themes;
    // DoH-провайдеры для секции DNS-ЗАЩИТА (mode 2: TRR-first, фолбэк на системный DNS)
    const DNS_URI = {
      cloudflare: 'https://cloudflare-dns.com/dns-query',
      adguard:    'https://dns.adguard-dns.com/dns-query',
      quad9:      'https://dns.quad9.net/dns-query',
    };
    // Системный цвет выделения в полях ввода (urlbar, формы на сайтах):
    // CSS ::selection их не перебивает, а этот преф — да. Синхронизируем с темой.
    function syncSelectionPrefs(themeId) {
      const t = THEMES.find(x => x.id === themeId) || THEMES[0];
      const accent = (themeId === 'custom') ? getCustomColor() : t.accent;
      try {
        Services.prefs.setStringPref('ui.textSelectBackground', accent);
        Services.prefs.setStringPref('ui.textSelectForeground', '#ffffff');
      } catch (e) { mark('ERR selSync ' + e); }
    }
    const BUILTIN_BGS = window.Blade.builtinBgs;
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
    // открытии меню и из applyThemeSheet. Инвалидация — в
    // chooseCustomWallpaper после копирования нового файла
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
          st.textContent = 'body.activity-stream { background: linear-gradient(180deg, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.22) 45%, rgba(10,10,12,0.45) 100%), #0a0a0a url("img/' + b.file + '") center bottom / cover no-repeat fixed !important; }';
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
          ' --bob-accent-soft: rgba(' + rgbStr + ', 0.35) !important;' +
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
              'background: linear-gradient(180deg, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.22) 45%, rgba(10,10,12,0.45) 100%), ' +
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
        '--bob-accent-soft': 'rgba(' + rgb.join(', ') + ', 0.35)',
        '--bob-page': 'hsl(' + h + ', 22%, 4%)'
      };
    }
    // Ставит/снимает кастомные переменные + ::selection на документе
    function applyCustomToDoc(doc, color) {
      try {
        const el = doc.documentElement;
        if (!el) return;
        for (const p of ['--accent', '--accent-soft', '--bg', '--panel', '--panel-hover', '--text',
                         '--bob-accent', '--bob-accent-soft', '--bob-page']) {
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
    // --- КОНСТРУКТОР ТЕМ: свои слайдеры HSL (системный <input type=color>
    //     в chrome-диалоге палитру не открывает — проверено), hex + превью ---
    function openThemeLab() {
      try {
        const dlg = window.openDialog('about:blank', 'blade-theme-lab',
          'chrome,centerscreen,dialog=no,width=470,height=520,resizable=no');
        // закрыли крестиком без «Применить» — откат живых изменений к сохранённым.
        // 'close' есть у chrome-окон, 'unload' — гарантированный общий случай:
        // вешаем оба, applyLiveAttrs идемпотентен (Gemini ревью-2, баг 1)
        const onLabClose = () => { try { applyLiveAttrs(); } catch (e) {} };
        dlg.addEventListener('close', onLabClose);
        dlg.addEventListener('unload', onLabClose);
        // about:blank грузится мгновенно: load может стрельнуть ДО подписки —
        // строим идемпотентно, кто первый (load или таймаут), тот и построил
        let built = false;
        const build = () => {
          if (built) return;
          built = true;
          try {
            const d = dlg.document;
            d.title = 'Конструктор темы Blade';
            const st = d.createElement('style');
            st.textContent = [
              // !important: userChrome.css красит body chrome-диалогов акцентом
              // рамки — перебиваем (скриншот-аудит Gemini раунд 3)
              'html, body { background: #0a0a0c !important; color: #e8e8e8 !important; font: 13px/1.5 system-ui, sans-serif; margin: 0; }',
              '.wrap { padding: 18px 22px; min-height: 100vh; box-sizing: border-box; }',
              'h1 { color: #ff2a2a; font-size: 15px; letter-spacing: 3px; margin: 0 0 14px; }',
              '.row { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }',
              '.cur { width: 52px; height: 52px; border-radius: 12px; border: 1px solid #2a2a34; box-shadow: 0 0 16px rgba(255,42,42,.25); }',
              '#hexin, input[type=text] { background: #14141a; color: #e8e8e8; border: 1px solid #2a2a34; border-radius: 8px; padding: 8px 10px; font-family: monospace; font-size: 14px; width: 96px; }',
              '.hint { color: #8a8f98; }',
              '.slider { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }',
              '.slider label { width: 108px; color: #b8b8c0; }',
              '.slider input { flex: 1; }',
              '.slider output { width: 34px; text-align: right; color: #8a8f98; font-family: monospace; }',
              'input[type=range] { appearance: none; height: 10px; border-radius: 6px; background: #1a1a22; border: 1px solid #2a2a34; padding: 0; margin: 0; }',
              '.hue-slider { background: linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00) !important; border: none !important; }',
              'input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #e8e8e8; border: 2px solid #0a0a0c; box-shadow: 0 0 8px rgba(255,42,42,.7); }',
              '.swatches { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0 16px; }',
              '.sw { width: 26px; height: 26px; border-radius: 8px; border: 1px solid #2a2a34; cursor: pointer; }',
              '.sw:hover { transform: scale(1.16); }',
              '.preview { border-radius: 10px; padding: 16px; margin-bottom: 16px; border: 1px solid #2a2a34; transition: background .15s; }',
              '.pbtn { display: inline-block; padding: 6px 14px; border-radius: 8px; margin-right: 8px; font-weight: 700; transition: all .15s; }',
              '.ptile { display: inline-block; width: 64px; height: 44px; border-radius: 8px; margin-right: 8px; vertical-align: middle; }',
              '.btns { display: flex; gap: 10px; }',
              'button { flex: 1; padding: 9px 0; border-radius: 8px; font-weight: 700; cursor: pointer; border: 1px solid #2a2a34; }',
              '#apply { background: #ff2a2a; color: #fff; border: none; }',
              '#apply:hover { filter: brightness(1.15); }',
              '#reset { background: #14141a; color: #e8e8e8; }'
            ].join('\n');
            d.head.appendChild(st);
            // Статичный каркас — innerHTML (div/span в chrome-документе ок),
            // интерактивные контролы — createElement: input из innerHTML
            // в chrome-доке теряет id (диагностировано)
            d.body.innerHTML = '<div class="wrap">' +
              '<h1>⚡ СВОЯ ТЕМА</h1>' +
              '<div class="row"><div class="cur" id="cur"></div>' +
              '<div><div style="margin-bottom:6px" id="hexbox"></div>' +
              '<div class="hint">крути слайдеры — тема соберётся сама</div></div></div>' +
              '<div id="sliders"></div>' +
              '<div class="swatches" id="sw"></div>' +
              '<div class="preview" id="pv"><span class="ptile" id="ptile"></span>' +
              '<span class="pbtn" id="pbtn">Кнопка</span>' +
              '<span> Текст · <span id="paccent">акцент</span></span></div>' +
              '<div class="btns" id="btnbox"></div></div>';

            function sliderRow(labelText, min, max) {
              const row = d.createElement('div');
              row.className = 'slider';
              const lab = d.createElement('label');
              lab.textContent = labelText;
              const inp = d.createElement('input');
              inp.type = 'range'; inp.min = min; inp.max = max; inp.step = 1;
              const out = d.createElement('output');
              row.append(lab, inp, out);
              d.getElementById('sliders').appendChild(row);
              return { inp, out };
            }
            const hueS = sliderRow('Оттенок', 0, 360);
            const satS = sliderRow('Насыщенность', 30, 100);
            const ligS = sliderRow('Яркость', 35, 75);
            const hueEl = hueS.inp, satEl = satS.inp, ligEl = ligS.inp;
            const hueO = hueS.out, satO = satS.out, ligO = ligS.out;
            hueEl.className = 'hue-slider';

            const hexIn = d.createElement('input');
            hexIn.type = 'text';
            hexIn.value = '#ff2a2a';
            d.getElementById('hexbox').appendChild(hexIn);

            const applyB = d.createElement('button');
            applyB.id = 'apply';
            applyB.textContent = 'Применить';
            const resetB = d.createElement('button');
            resetB.id = 'reset';
            resetB.textContent = 'Вернуть GX Red';
            d.getElementById('btnbox').append(resetB, applyB);

            function hslToHex(h, s, l) {
              s /= 100; l /= 100;
              const k = n => (n + h / 30) % 12;
              const a = s * Math.min(l, 1 - l);
              const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
              const to = x => Math.round(255 * x).toString(16).padStart(2, '0');
              return '#' + to(f(0)) + to(f(8)) + to(f(4));
            }
            function hexToHsl(hex) {
              const rgb = hexToRgb(hex).map(x => x / 255);
              const mx = Math.max(rgb[0], rgb[1], rgb[2]), mn = Math.min(rgb[0], rgb[1], rgb[2]);
              let h = 0, s = 0;
              const l = (mx + mn) / 2;
              if (mx !== mn) {
                const dd = mx - mn;
                s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
                if (mx === rgb[0]) h = ((rgb[1] - rgb[2]) / dd + 6) % 6;
                else if (mx === rgb[1]) h = (rgb[2] - rgb[0]) / dd + 2;
                else h = (rgb[0] - rgb[1]) / dd + 4;
                h *= 60;
              }
              return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
            }

            function currentHex() {
              return hslToHex(Number(hueEl.value), Number(satEl.value), Number(ligEl.value));
            }
            function render() {
              const hex = currentHex();
              const v = customVars(hex);
              d.getElementById('cur').style.background = hex;
              d.getElementById('cur').style.boxShadow = '0 0 16px ' + v['--accent-soft'];
              if (d.activeElement !== hexIn) hexIn.value = hex;
              hueO.value = hueEl.value;
              satO.value = satEl.value + '%';
              ligO.value = ligEl.value + '%';
              d.getElementById('pv').style.background = v['--bg'];
              const pb = d.getElementById('pbtn');
              pb.style.background = hex;
              pb.style.color = customVars._selText;
              pb.style.boxShadow = '0 0 14px ' + v['--accent-soft'];
              const tile = d.getElementById('ptile');
              tile.style.background = v['--panel'];
              tile.style.border = '1px solid ' + hex;
              d.getElementById('paccent').style.color = hex;
              // Живое применение: браузер перекрашивается прямо при движении
              // слайдера (Gemini №2.5). Не сохранили и закрыли — applyLiveAttrs
              // вернёт сохранённое состояние.
              applyCustomToDoc(window.document, hex);
            }
            function setHex(hex) {
              const hsl = hexToHsl(hex);
              hueEl.value = hsl.h; satEl.value = hsl.s; ligEl.value = hsl.l;
              render();
            }

            for (const el of [hueEl, satEl, ligEl]) el.addEventListener('input', render);
            hexIn.addEventListener('input', () => {
              if (/^#[0-9a-f]{6}$/i.test(hexIn.value.trim())) {
                setHex(hexIn.value.trim());
              }
            });
            const presets = ['#ff2a2a', '#ff6a1f', '#fff820', '#00ff88', '#2f6bff', '#b44bff', '#ff2a78', '#00e5ff'];
            for (const c of presets) {
              const s = d.createElement('span');
              s.className = 'sw';
              s.style.background = c;
              s.addEventListener('click', () => setHex(c));
              d.getElementById('sw').appendChild(s);
            }
            applyB.addEventListener('click', () => {
              Services.prefs.setStringPref('blade.theme.customColor', currentHex());
              // Цвет кастомной темы запекается в covers.css (тематизация
              // сайтов) — дергаем тумблер перегенерации для BobliksCovers
              try {
                Services.prefs.setBoolPref('bobliks.covers.dirty', !Services.prefs.getBoolPref('bobliks.covers.dirty', false));
              } catch (e) {}
              setTheme('custom');
              applyLiveAttrs();
              dlg.close();
            });
            resetB.addEventListener('click', () => {
              setTheme('red');
              applyLiveAttrs();
              dlg.close();
            });
            setHex(getCustomColor());
          } catch (e) { mark('ERR lab build ' + e); }
        };
        dlg.addEventListener('load', build, { once: true });
        setTimeout(build, 250);
      } catch (e) { mark('ERR lab ' + e); }
    }
    function setTheme(themeId) {
      for (const t of THEMES) { if (t.pref) Services.prefs.clearUserPref(t.pref); }
      const t = THEMES.find(x => x.id === themeId);
      if (t && t.pref) Services.prefs.setBoolPref(t.pref, true);
      syncSelectionPrefs(themeId);
      applyLiveAttrs();
      // Тематический щит — для ЛЮБОЙ темы, включая red: единственный живой
      // канал до remote-контента (newtab, скроллбары сайтов, about:-страницы)
      applyThemeSheet(themeId);
    }
    // Живой фон через nsIStyleSheetService USER_SHEET (раунд 23): новая
    // вкладка удалённая, DOM не дотянуться — а юзер-щит доходит до контентного
    // процесса и применяется МГНОВЕННО, без перезапуска
    let currentCustomBgUri = null;
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
          'background: linear-gradient(180deg, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.22) 45%, rgba(10,10,12,0.45) 100%), ' +
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
    // Проводник: init требует BrowsingContext (window больше не конвертится —
    // раунд 23), open() — callback-based (Promise-вариант от Gemini ждал бы
    // undefined). Имя файла: транслит-безопасное + таймстамп от коллизий
    function chooseCustomWallpaper() {
      try {
        const fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
        const parentBC = window.browsingContext || (window.docShell && window.docShell.browsingContext) || null;
        fp.init(parentBC, 'Выберите изображение для фона Blade', Ci.nsIFilePicker.modeOpen);
        fp.appendFilters(Ci.nsIFilePicker.filterImages);
        fp.open((res) => {
          try {
            if (res !== Ci.nsIFilePicker.returnOK || !fp.file) return;
            const ext = fp.file.leafName.split('.').pop().toLowerCase();
            if (!['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'].includes(ext)) return;
            const cleanBase = fp.file.leafName.replace(/[.][^.]+$/, '')
              .replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20) || 'wallpaper';
            const safeName = 'custom_' + cleanBase + '_' + Date.now().toString(36) + '.' + ext;
            const imgDir = getImgDir();
            const target = imgDir.clone(); target.append(safeName);
            if (target.exists()) target.remove(false);
            fp.file.copyTo(imgDir, safeName);
            // новый файл = новый скан каталога и новый преф bobliks.bg.file_*
            customBgsCache = null;
            // Тумблер для BobliksCovers (@onlyonce, слушает преф): правило под
            // новый преф должно появиться в covers.css без перезапуска
            try {
              Services.prefs.setBoolPref('bobliks.covers.dirty', !Services.prefs.getBoolPref('bobliks.covers.dirty', false));
            } catch (e) {}
            setBg('file:' + safeName);
          } catch (e) { mark('ERR pickCopy ' + e); }
        });
      } catch (e) { mark('ERR pickBg ' + e); }
    }
    // Локальное уведомление в nb окна (сигнатура FF155 — как notify() в
    // BladeUpdater): appendNotification(type, {label, image, priority})
    function notifyBlade(label) {
      try {
        const nb = window.gNotificationBox;
        nb.appendNotification('blade-backup-notification', {
          label,
          image: 'chrome://browser/skin/notification-icons/popup.svg',
          priority: nb.PRIORITY_INFO_HIGH,
        }, [], false);
      } catch (e) { mark('ERR notify ' + e); }
    }
    // Бэкап профиля: BladeCore.runPsEncoded гонит resources\blade-backup.ps1
    // через powershell.exe -EncodedCommand (base64 UTF-16LE, без аргументов
    // командной строки — пробелы в путях не рвутся)
    function launchBackup() {
      try {
        const script = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
        script.append('resources'); script.append('blade-backup.ps1');
        if (!script.exists()) {
          notifyBlade('нет chrome\\resources\\blade-backup.ps1');
          return;
        }
        const q = (s) => String(s).replace(/'/g, "''");
        const profDir = Services.dirsvc.get('ProfD', Ci.nsIFile).path;
        const psLine = "& '" + q(script.path) + "' -ProfileDir '" + q(profDir) + "'";
        try {
          window.Blade.runPsEncoded(psLine);
          notifyBlade('⚡ Бэкап профиля создаётся — архив появится в папке Backups рядом с браузером.');
        } catch (e) {
          notifyBlade('не удалось запустить бэкап: ' + e.message);
        }
      } catch (e) { mark('ERR backup ' + e); }
    }
    // ПАНЕЛЬ МЕНЮ (GX, вкладочная): кастомный panel с HTML внутри.
    // Рамка/фон/тени — только через ::part(content): в FF155 попапы рисуются
    // в Shadow DOM (проверено ранее на панелях).
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
        const curTheme = activeTheme();
        for (const t of THEMES) {
          row(t.label, { bobliksTheme: t.id }, { on: curTheme === t.id, chip: t.accent });
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
      } else if (tab === 'bg') {
        const curBg = activeBg();
        for (const b of getAllBgs()) {
          row(b.label, { bobliksBg: b.id }, { on: curBg === b.id });
        }
        row('+ Выбрать свой файл обоев…', { bladePickBg: '1' }, { noDot: true });
      } else if (tab === 'tiles') {
        const editOn = Services.prefs.getBoolPref('bobliks.dial.edit', false);
        row('Режим правки (кнопка «...» на плитках)', { bobliksEdit: editOn ? 'off' : 'on' }, { on: editOn });
      } else if (tab === 'system') {
        sub('ЧТЕНИЕ');
        const readerOn = Services.prefs.getBoolPref('blade.reader.on', false);
        row('Принудительный тёмный для сайтов', { bladeReader: readerOn ? 'off' : 'on' }, { on: readerOn });
        sub('DNS-ЗАЩИТА');
        const trrMode = Services.prefs.getIntPref('network.trr.mode', 2);
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
            setTheme(ds.bobliksTheme);
          }
          else if (ds.bobliksBg) { await setBg(ds.bobliksBg); }
          else if (ds.bobliksEdit === 'on') { Services.prefs.setBoolPref('bobliks.dial.edit', true); }
          else if (ds.bobliksEdit === 'off') { Services.prefs.clearUserPref('bobliks.dial.edit'); }
          else if (ds.bladeReader === 'on' || ds.bladeReader === 'off') {
            const enable = (ds.bladeReader === 'on');
            Services.prefs.setBoolPref('blade.reader.on', enable);
            // Вкл: сайты рендерят СВЕТЛУЮ версию (prefers=1), инверт делает её тёмной
            Services.prefs.setIntPref('layout.css.prefers-color-scheme.content-override', enable ? 1 : 2);
          }
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
          else if (ds.bladeBackup === '1') { close = true; launchBackup(); }
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
          else if (ds.bladePickBg) { close = true; chooseCustomWallpaper(); }
          else if (ds.bladeLab) { close = true; openThemeLab(); }
          else if (ds.bobliksFolder) {
            close = true;
            try { getImgDir().launch(); } catch (e) { try { getImgDir().reveal(); } catch (e2) {} }
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
    try {
      const readerOn = Services.prefs.getBoolPref('blade.reader.on', false);
      Services.prefs.setIntPref('layout.css.prefers-color-scheme.content-override', readerOn ? 1 : 2);
      const savedTheme = activeTheme();
      syncSelectionPrefs(savedTheme);
      applyThemeSheet(savedTheme);
    } catch (e) { mark('ERR sync', e); }

    // Стиль About-диалога «О Blade»: тёмный, без текстов сообщества Mozilla
    const ABOUT_DLG_CSS = `
      #aboutDialog, #aboutDialogContainer, #clientBox, #leftBox, #rightBox, #detailsBox {
        background: #0a0a0c !important;
        color: #e8e8e8 !important;
      }
      #version { color: #ff2a2a !important; font-weight: 700 !important; }
      label, description, button { color: #e8e8e8 !important; }
      .text-link { color: #ff2a2a !important; }
      #submit-feedback, #communityDesc, #communityExperimentalDesc,
      #contributeDesc, #contributeDescReferrals, #currentChannelText {
        display: none !important;
      }
    `;

    // About-диалог: стиль через nsIStyleSheetService (USER_SHEET). <style>
    // внутри XUL-окна не работает (проверено), а регистрация листа действует
    // на все окна; id-селекторы ограничивают его только этим диалогом.
    try {
      const cssUri = Services.io.newURI('data:text/css,' + encodeURIComponent(ABOUT_DLG_CSS), null, null);
      const SSS = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
      if (!SSS.sheetRegistered(cssUri, SSS.USER_SHEET)) {
        SSS.loadAndRegisterSheet(cssUri, SSS.USER_SHEET);
      }
      mark('OK aboutSheet');
    } catch (e) { mark('ERR aboutSheet ' + e); }

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
      applyLiveAttrs();
      // сохранённый кастомный фон — юзер-щит живёт только до перезапуска
      const initBg = getAllBgs().find(x => x.id === activeBg());
      if (initBg && initBg.isCustom && initBg.file) applyCustomBgSheet(initBg.file);
      const docObs = (doc) => {
        try {
          if (!doc || !doc.documentElement) return;
          const url = doc.documentURI || '';
          // PiP-плеер: неоновая рамка в цвет темы (окно родительское —
          // observer сюда доходит; Gemini раунд 13)
          if (url.includes('pictureinpicture/player.xhtml')) {
            try {
              if (doc.getElementById('blade-pip-neon')) return;
              const theme = activeTheme();
              const t = THEMES.find(x => x.id === theme) || THEMES[0];
              const accent = (theme === 'custom') ? getCustomColor() : t.accent;
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

    // Чистильщик первого запуска: расширения (SponsorBlock) открывают свой
    // help при автоустановке. Закрываем их — только в первую минуту после
    // старта, дальше юзер сам решает, что открывать.
    try {
      const BORN = Date.now();
      const NOISE = /moz-extension:\/\/[^/]+\/help\/index\.html/;
      const closeNoise = (tab) => {
        if (Date.now() - BORN > 60000) return;
        try {
          if (NOISE.test(tab.linkedBrowser.currentURI.spec)) window.gBrowser.removeTab(tab);
        } catch (e) {}
      };
      window.gBrowser.tabContainer.addEventListener('TabOpen', (ev) => {
        setTimeout(() => closeNoise(ev.target), 900);
      });
      for (const t of window.gBrowser.tabs) closeNoise(t);
      mark('OK janitor');
    } catch (e) { mark('ERR janitor ' + e); }

    // ЧИСТЫЙ ЛИСТ: вырезаем порталы Mozilla из всех меню (Help и ≡).
    // Работает по data-l10n-id — стабильно между версиями и языками.
    try {
      const BANNED = new Set([
        'menu-get-help', 'menu-report-broken-site',
        'menu-help-report-deceptive-site', 'menu-help-not-deceptive',
        'menu-help-switch-device', 'menu-help-enter-troubleshoot-mode2',
        'appmenuitem-get-help', 'appmenuitem-report-broken-site',
        'appmenuitem-report-deceptive-site', 'appmenuitem-switch-device',
        'appmenuitem-enter-troubleshoot-mode'
      ]);
      const hideBanned = (root) => {
        for (const mi of root.querySelectorAll('[data-l10n-id]')) {
          if (BANNED.has(mi.getAttribute('data-l10n-id')) || mi.id === 'aboutName') {
            mi.hidden = true;
          }
        }
      };
      window.document.addEventListener('popupshowing', (ev) => {
        try { hideBanned(ev.target); } catch (e) {}
      }, true);
      // Стартовый проход не гонщик: меню, открытые до idle, прикроет
      // popupshowing-слушатель выше
      const hideBannedIdle = () => { try { hideBanned(window.document); } catch (e) {} };
      if (window.requestIdleCallback) requestIdleCallback(hideBannedIdle, { timeout: 2000 });
      else setTimeout(hideBannedIdle, 2000);
      mark('OK menuclean');
    } catch (e) { mark('ERR menuclean ' + e); }

    // ЧИСТЫЙ ЛИСТ: дефолтные mozilla-закладки свежего профиля — в утиль.
    // Удаляем только известные дефолтные URL, свои закладки не трогаем.
    (async () => {
      try {
        const DEFAULTS = [
          'https://www.mozilla.org/ru/firefox/central/',
          'https://www.mozilla.org/en-US/firefox/central/',
          'https://www.mozilla.org/ru/about/',
          'https://www.mozilla.org/en-US/about/',
          'https://support.mozilla.org/',
          'https://addons.mozilla.org/',
          // дефолтная закладка PortableApps (наследие портабл-сборки)
          'https://portableapps.com/',
          'http://portableapps.com/',
          'https://portableapps.com/apps/internet/firefox_portable',
          'https://portableapps.com/apps'
        ];
        const { PlacesUtils } = ChromeUtils.importESModule('resource://gre/modules/PlacesUtils.sys.mjs');
        for (const url of DEFAULTS) {
          for (let i = 0; i < 10; i++) {
            try {
              const bm = await PlacesUtils.bookmarks.fetch({ url });
              if (!bm) break;
              await PlacesUtils.bookmarks.remove(bm);
            } catch (e) { break; }
          }
        }
        mark('OK bookmarks');
      } catch (e) { mark('ERR bookmarks ' + e); }
    })();

    // ЛАЗЕРНЫЙ ЛУЧ ЗАГРУЗКИ: пока активная вкладка грузится, тулбокс несёт
    // data-blade-loading — линия под ним бежит лучом (CSS, userChrome §12)
    try {
      // Тулбокс один на окно — кэш в замыкании вместо getElementById на каждый
      // TabAttrModified; запись тем же значением не делается (каждый
      // setAttribute = пересчёт стилей)
      let toolbox = null;
      const syncLaser = () => {
        try {
          if (!toolbox) toolbox = window.document.getElementById('navigator-toolbox');
          if (!toolbox) return;
          const tab = window.gBrowser.selectedTab;
          const want = !!(tab && tab.hasAttribute('busy'));
          if (want === (toolbox.getAttribute('data-blade-loading') === '1')) return;
          if (want) toolbox.setAttribute('data-blade-loading', '1');
          else toolbox.removeAttribute('data-blade-loading');
        } catch (e) {}
      };
      window.gBrowser.tabContainer.addEventListener('TabAttrModified', (ev) => {
        if (ev.target === window.gBrowser.selectedTab) syncLaser();
      });
      window.gBrowser.tabContainer.addEventListener('TabSelect', syncLaser);
      syncLaser();
      mark('OK laser');
    } catch (e) { mark('ERR laser ' + e); }

    // Сплеш-заставка: клинок вспыхивает при старте браузера (только первое
    // окно сессии — новые окна сплешем не мучаем)
    try {
      let winCount = 0;
      const en0 = Services.wm.getEnumerator('navigator:browser');
      while (en0.hasMoreElements()) { en0.getNext(); winCount++; }
      if (winCount <= 1) {
        const d = window.document;
        let logoUri = '';
        try {
          const logo = getImgDir().clone();
          logo.append('btn_blade.png');
          logoUri = PathUtils.toFileURI(logo.path);
        } catch (e2) {}
        const ov = d.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        ov.id = 'blade-splash';
        ov.innerHTML = (logoUri ? '<img src="' + logoUri + '">' : '') +
          '<div class="word">B L A D E</div>';
        const st = d.createElementNS('http://www.w3.org/1999/xhtml', 'style');
        st.textContent = [
          '#blade-splash { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;',
          '  background: radial-gradient(ellipse 60% 50% at 50% 60%, #1a0505, #050303 75%);',
          '  display: flex; flex-direction: column; align-items: center; justify-content: center;',
          '  gap: 18px; transition: opacity .45s ease; }',
          '#blade-splash img { width: 108px; filter: drop-shadow(0 0 18px rgba(255,42,42,.8));',
          '  animation: bladeSplashIn .55s cubic-bezier(.2,.9,.3,1.4); }',
          '#blade-splash .word { color: #ff2a2a; font-weight: 800; font-size: 32px;',
          '  letter-spacing: 14px; text-shadow: 0 0 22px rgba(255,42,42,.65);',
          '  animation: bladeSplashIn .7s ease-out; }',
          '@keyframes bladeSplashIn { from { opacity: 0; transform: scale(.82); }',
          '  to { opacity: 1; transform: scale(1); } }'
        ].join('\n');
        d.documentElement.appendChild(ov);
        d.documentElement.appendChild(st);
        setTimeout(() => { try { ov.style.opacity = '0'; } catch (e3) {} }, 1050);
        setTimeout(() => { try { ov.remove(); st.remove(); } catch (e3) {} }, 1550);
        mark('OK splash');
      }
    } catch (e) { mark('ERR splash ' + e); }

    // Кнопка: если виджет уже зарегистрирован (повторный запуск скрипта) — пропускаем
    try {
      if (!CustomizableUI.getWidget(WIDGET_ID)) {
      CustomizableUI.createWidget({
      id: WIDGET_ID,
      type: 'custom',
      label: 'Blade',
      tooltiptext: 'Настройки Blade (тема, фон, плитки)',
      defaultArea: CustomizableUI.AREA_NAVBAR,
      // FF155: без type:'custom'+onBuild движок строит голую кнопку с текстовой
      // меткой — БЕЗ ребёнка .toolbarbutton-icon, на котором висит весь облик
      // кнопки (иконка btn_blade, рамка, ховер и пульсации тем из userChrome
      // 5.1 «живые темы»). Строим структуру сами — как BladeClock.
      // ВАЖНО: для type:'custom' движок НЕ вызывает ни onBeforeCreated, ни
      // onCreated (весь блок сборки в buildWidgetNode пропускается) — слушатель
      // клика вешаем здесь же, в onBuild, иначе кнопка мертва.
      onBuild(doc) {
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
      },
      });
      }
    } catch (e) { mark('ERR createWidget', e); }
    // Горячие клавиши ЧЕРЕЗ KEYSET: настоящие <key> работают при любом фокусе,
    // включая страницу (window-keydown из контента не долетал — баг красной команды №11)
    try {
      const toggleReader = () => {
        const on = Services.prefs.getBoolPref('blade.reader.on', false);
        Services.prefs.setBoolPref('blade.reader.on', !on);
        Services.prefs.setIntPref('layout.css.prefers-color-scheme.content-override', on ? 2 : 1);
        try {
          const p = window.document.getElementById(POPUP_ID);
          if (p) buildPopup(window.document, p);
        } catch (e) {}
      };
      const cycleTheme = (dir) => {
        const cur = THEMES.findIndex(t => t.pref && Services.prefs.getBoolPref(t.pref, false));
        const next = THEMES[((cur < 0 ? 0 : cur) + dir + THEMES.length) % THEMES.length];
        setTheme(next.id);
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
        mkKey('blade-key-reader', 'F2', null, toggleReader);
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
    function autoThemeTick() {
      try {
        if (!Services.prefs.getBoolPref('blade.autotheme.on', false)) return;
        const hour = new Date().getHours();
        const prefName = (hour >= 8 && hour < 20) ? 'blade.autotheme.day' : 'blade.autotheme.night';
        const target = Services.prefs.getStringPref(prefName, prefName === 'blade.autotheme.day' ? 'grey' : 'blood');
        if (activeTheme() !== target) setTheme(target);
      } catch (e) { mark('ERR autoTheme ' + e); }
    }
    autoThemeTick();
    const autoThemeTimer = setInterval(autoThemeTick, 60e3);
    window.addEventListener('unload', () => { clearInterval(autoThemeTimer); }, { once: true });

    mark('OK widget');
  } catch (e) {
    mark('ERR fatal', e);
    console.error('Bobliks fatal:', e);
  }
})();