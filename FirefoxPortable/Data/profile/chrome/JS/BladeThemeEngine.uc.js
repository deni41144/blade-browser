// ==UserScript==
// @name            Blade Theme Engine
// @description     Движок тем и фонов: каталоги, цветная математика кастомной
//                  темы, тематический щит USER_SHEET, живые атрибуты,
//                  setTheme/setBg и стартовая раскраска. Шаг 7 декомпозиции
// @author          Blade-Creations
// @include         main
// @version         1.2.2
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
    // mark-файл (конвенция 2): первая строка v1.1.0 <event>
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
            const text = 'v1.2.2 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
            IOUtils.writeUTF8(markPath, text).catch(() => {});
        } catch (e2) {}
    };

    // Единственный источник каталогов — BladeCore (@loadOrder 5, грузится
    // раньше). BUILTIN_BGS объявлен ниже внутри перенесённого блока
    const THEMES = window.Blade.themes;
    let fieldSelectionURI = null;

    // Системный цвет выделения в полях ввода (urlbar, формы на сайтах):
    // CSS ::selection их не перебивает, а этот преф — да. Синхронизируем с темой.
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: THEMES: ВЫДЕЛЕНИЕ + СПИСОК ФОНОВ + КАТАЛОГ
    // syncSelectionPrefs..applyBgToDoc. ВНИМАНИЕ (риск 1): applyLiveAttrs ниже зовёт activeBg/applyBgToDoc — цикл Themes<->Bgs
    // ═══════════════════════════════════════════════════════════════════
    function syncSelectionPrefs(themeId) {
      const t = THEMES.find(x => x.id === themeId) || THEMES[0];
      const accent = (themeId === 'custom') ? getCustomColor() : t.accent;
      // Firefox's urlbar also uses lightweight-theme highlight tokens.
      // Keep the real input selection in sync, including existing windows.
      const linear = n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
      const rgb = hexToRgb(accent).map(n => linear(n / 255));
      const luminance = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
      const fieldForeground = (luminance + .05) / .05 > 1.05 / (luminance + .05) ? '#000000' : '#ffffff';
      const windows = Services.wm.getEnumerator('navigator:browser');
      while (windows.hasMoreElements()) {
        const doc = windows.getNext().document;
        const root = doc.documentElement;
        root.setAttribute('data-blade-field-selection', accent + fieldForeground);
        root.style.setProperty('--lwt-toolbar-field-highlight', accent);
        root.style.setProperty('--lwt-toolbar-field-highlight-text', fieldForeground);
        let style = doc.getElementById('blade-field-selection-style');
        if (!style) {
          style = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
          style.id = 'blade-field-selection-style'; root.appendChild(style);
        }
        style.textContent = `:root[data-blade-theme] #urlbar-input.urlbar-input::selection,
          :root[data-blade-theme] .searchbar-textbox::selection {
          background-color:${accent} !important; color:${fieldForeground} !important;
          text-shadow:none !important;
        }`;
      }
      // The base userChrome USER !important selection beats AUTHOR rules.
      // Use a scoped USER rule with literal colors for the actual HTML field.
      const sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
      const css = `@-moz-document url("chrome://browser/content/browser.xhtml") {
        :root[data-blade-field-selection="${accent + fieldForeground}"] #urlbar-input::selection,
        :root[data-blade-field-selection="${accent + fieldForeground}"] .searchbar-textbox::selection {
          background-color:${accent} !important; color:${fieldForeground} !important; text-shadow:none !important;
        }
      }`;
      const uri = Services.io.newURI('data:text/css;charset=UTF-8,' + encodeURIComponent(css));
      if (!fieldSelectionURI || fieldSelectionURI.spec !== uri.spec) {
        if (fieldSelectionURI && sss.sheetRegistered(fieldSelectionURI, sss.USER_SHEET)) sss.unregisterSheet(fieldSelectionURI, sss.USER_SHEET);
        if (!sss.sheetRegistered(uri, sss.USER_SHEET)) sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
        fieldSelectionURI = uri;
      }
      try {
        // Gecko 155 paints native input selection with Highlight/Highlighttext;
        // the historical ui.textSelectBackground/Foreground prefs are ignored.
        Services.prefs.setStringPref('ui.highlight', accent);
        Services.prefs.setStringPref('ui.highlighttext', fieldForeground);
        Services.prefs.setStringPref('ui.textSelectDisabledBackground', accent);
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
        // Единый контракт зарезервированных имён с BobliksCovers (BladeCore):
        // встроенные фоны + служебные файлы (кнопка, аватарки заставки)
        const builtin = window.Blade.reservedImgFiles();
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
    // Путь относительно chrome/img/ (поддерживает подпапку original/):
    // append() умеет только одно звено за раз, режем по обоим разделителям
    function resolveImgFile(rel) {
      const f = getImgDir().clone();
      for (const seg of String(rel || '').split(/[\\/]/)) if (seg) f.append(seg);
      return f;
    }
    // --- ПАПКА ORIGINAL (v1.1.0): исходники владельца из V3-папки дизайнера
    // копируются в chrome/img/original/. Преф blade.bg.v3dir хранит
    // путь-источник (если 404 — пункт молча пропадёт, файлы не трогаются).
    // Скан самой папки-источника каждый раз берёт НОВЫЕ файлы автоматически —
    // владелец кладёт обои в V3-папку, перезапуск браузера подхватывает их.
    const V3DIR_PREF = 'blade.bg.v3dir';
    const DEFAULT_V3DIR = ''; // релиз: автосинк из папки дизайнера выключен;
    // своя папка задаётся префом blade.bg.v3dir (about:config). Фабричный
    // набор Original (9 PNG в img/original/) работает независимо от синка.
    let originalBgsCache = null;
    const retiredOriginalPrefIds = new Set([bgPrefId('original/BLOOD.png')]);
    function v3SourceDir() {
      try {
        const p = Services.prefs.getStringPref(V3DIR_PREF, DEFAULT_V3DIR);
        if (!p) return null;
        const f = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
        f.initWithPath(p);
        return (f.exists() && f.isDirectory()) ? f : null;
      } catch (e) { return null; }
    }
    // «CHERRY» → «Cherry», «my cool_wall» → «My Cool Wall»
    function niceOrigLabel(leaf) {
      const base = String(leaf).replace(/[.][^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      return base.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }
    function getOriginalBgs() {
      if (originalBgsCache) return originalBgsCache;
      const out = [];
      try {
        const dest = getImgDir().clone(); dest.append('original');
        if (!dest.exists()) dest.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
        // СИНХРОНИЗАЦИЯ: копируем только недостающее (copyTo валится, если
        // цель есть — двойной вызов в catch-щите). Удалений НЕТ: если D:
        // временно отмонтирован, папка не должна «съесть» контент
        const src = v3SourceDir();
        if (src) {
          let copiedNew = false;
          const it = src.directoryEntries;
          while (it.hasMoreElements()) {
            const e = it.getNext().QueryInterface(Ci.nsIFile);
            if (e.isDirectory()) continue;
            const name = e.leafName;
            if (!/[.](jpg|jpeg|png|webp|avif|gif)$/i.test(name)) continue;
            if (Object.hasOwn(window.Blade.originalWallpaperAliases, name.replace(/[.][^.]+$/, '').toUpperCase())) continue;
            const target = dest.clone(); target.append(name);
            try {
              if (!target.exists()) { e.copyTo(dest, name); copiedNew = true; }
            } catch (e2) { if (!target.exists()) mark('ERR origCopy ' + name + ' ' + e2); }
          }
          // Тумблер для BobliksCovers (@onlyonce, слушает преф): правило под
          // новый преф orig_* должно появиться в covers.css без перезапуска
          if (copiedNew) {
            try {
              Services.prefs.setBoolPref('bobliks.covers.dirty', !Services.prefs.getBoolPref('bobliks.covers.dirty', false));
            } catch (e) {}
          }
        }
        const iter = dest.directoryEntries;
        while (iter.hasMoreElements()) {
          const entry = iter.getNext().QueryInterface(Ci.nsIFile);
          if (entry.isDirectory()) continue;
          const name = entry.leafName;
          if (!/[.](jpg|jpeg|png|webp|avif|gif)$/i.test(name)) continue;
          const stem = name.replace(/[.][^.]+$/, '').toUpperCase();
          if (Object.hasOwn(window.Blade.originalWallpaperAliases, stem)) {
            retiredOriginalPrefIds.add(bgPrefId('original/' + name));
            continue;
          }
          const rel = 'original/' + name;
          out.push({
            id: 'orig:' + name,
            label: window.Blade.originalWallpaperLabels[stem] || niceOrigLabel(name),
            file: rel,
            isCustom: true,
            prefId: bgPrefId(rel),
            group: 'original',
          });
        }
      } catch (e) { mark('ERR getOriginalBgs ' + e); }
      originalBgsCache = out;
      return out;
    }
    function getAllBgs() {
      return BUILTIN_BGS.concat(getOriginalBgs(), getCustomBgs());
    }
    function activeTheme() {
      // Последняя истинная по массиву — как в CSS-каскаде, где побеждает
      // последний @media -moz-pref-блок (v1.8)
      let id = 'red';
      for (const t of THEMES) { if (t.pref && Services.prefs.getBoolPref(t.pref, false)) id = t.id; }
      return id;
    }
    function normalizeBgId(bgId) {
      const original = /^orig:(.+)[.]([^.]+)$/i.exec(String(bgId || ''));
      if (!original) return bgId;
      const target = window.Blade.originalWallpaperAliases[original[1].toUpperCase()];
      if (!target) return bgId;
      const items = getOriginalBgs();
      const sameExtension = items.find(x => x.id.toUpperCase() === ('orig:' + target + '.' + original[2]).toUpperCase());
      return (sameExtension || items.find(x => x.id.toUpperCase().startsWith('ORIG:' + target + '.')))?.id || 'acheron';
    }
    function migrateSavedBg() {
      getOriginalBgs();
      for (const prefId of retiredOriginalPrefIds) Services.prefs.clearUserPref('bobliks.bg.' + prefId);
      const saved = Services.prefs.getStringPref('bobliks.bg.current', '');
      const next = normalizeBgId(saved);
      if (next !== saved) {
        Services.prefs.clearUserPref('bobliks.bg.' + bgPrefId('original/' + saved.slice(5)));
        Services.prefs.setStringPref('bobliks.bg.current', next);
        const b = getAllBgs().find(x => x.id === next);
        if (b && next !== 'acheron') Services.prefs.setBoolPref('bobliks.bg.' + (b.prefId || next), true);
      }
      return next;
    }
    function activeBg() {
      const saved = migrateSavedBg();
      if (getAllBgs().some(x => x.id === saved)) return saved;
      return 'acheron';
    }
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: ЖИВОЙ КАНАЛ ДО REMOTE-NEWTAB (v1.2.0)
    // about:newtab в FF155 ВСЕГДА remote: newtabDocs() пуст, атрибуты
    // data-blade-theme/data-blade-bg на открытую вкладку не доходят, а
    // @media -moz-pref() в userContent.css/covers.css замерзает до
    // перезапуска. Единственный живой канал до контентного процесса —
    // USER_SHEET: снятие + повторная регистрация листа принудительно
    // рестайлит ВСЕ документы во ВСЕХ процессах. Поэтому в тематический щит
    // едут ещё два блока:
    //  • обложки плиток АКТИВНОЙ темы для всех доменов из img/themes/
    //    (covers.css подключён @import'ом в userContent.css:42 и не
    //     перезагружается — его Pref-блоки остались бы от старой темы);
    //  • фон newtab для ЛЮБОГО активного фона: растр — абсолютный file://
    //    URI, CSS-анимация (file: null) — дубли правил из userContent.css.
    //    Анимации (pulse/flow/aurora/matrix/ember/plasma/synthwave/mist/
    //    sakura/inferno) были доступны только через -moz-pref()/атрибут,
    //    которые до remote-newtab не доезжают — в USER_SHEET они не
    //    попадали вовсе.
    // Любой url() здесь обязан быть абсолютным: относительный url("img/...")
    // в data:-листе разрешается от about:newtab, а не от chrome/.
    // ═══════════════════════════════════════════════════════════════════
    const BG_GRAD = 'linear-gradient(180deg, rgba(10,10,12,0.35) 0%, rgba(10,10,12,0.10) 45%, rgba(10,10,12,0.25) 100%)';
    const NT_DOCS = '@-moz-document url("about:home"), url("about:newtab") {';

    // --- Обложки плиток активной темы для всех доменов из img/themes/ ---
    const coversCssCache = new Map();
    function buildActiveCoversCss(themeId) {
      try {
        const themesDir = getImgDir().clone();
        themesDir.append('themes');
        if (!themesDir.exists() || !themesDir.isDirectory()) return '';
        // Кастомной теме отдельных обложек не делают (BobliksCovers не
        // генерирует правила для custom) — для неё используется базовая
        // red.jpg, как в covers.css
        const coverTheme = (themeId === 'custom') ? 'red' : themeId;
        const items = [];
        const dIter = themesDir.directoryEntries;
        while (dIter.hasMoreElements()) {
          const dEntry = dIter.getNext().QueryInterface(Ci.nsIFile);
          const domain = dEntry.leafName.toLowerCase();
          if (!dEntry.isDirectory() || !domain) continue;
          const cf = dEntry.clone();
          cf.append(coverTheme + '.jpg');
          if (!cf.exists()) continue;
          items.push({ domain: domain, uri: PathUtils.toFileURI(cf.path) });
        }
        // Проверяем каталог и наличие файлов при КАЖДОМ вызове: mtime только
        // корневой папки не замечает добавление jpg в существующий домен.
        // Кэшируем сборку CSS, а не файловый снимок: новые/удалённые файлы
        // видны сразу; замена картинки по прежнему URI не меняет CSS.
        const signature = JSON.stringify(items);
        const cached = coversCssCache.get(coverTheme);
        if (cached && cached.signature === signature) return cached.css;
        if (!items.length) {
          coversCssCache.set(coverTheme, { signature, css: '' });
          return '';
        }
        // Сортировка по длине домена (КОРОТКИЕ первыми) — как в BobliksCovers:
        // music.youtube.com получает правило ПОЗЖЕ youtube.com и побеждает в
        // каскаде при совпадении href плитки
        items.sort((a, b) => a.domain.length - b.domain.length);
        let css = '';
        for (const it of items) {
          css += '.top-site-outer .top-site-button[href*="' + it.domain + '"] .tile {' +
            ' background-image: url("' + it.uri + '") !important;' +
            ' background-size: cover !important;' +
            ' background-position: center !important;' +
            ' background-repeat: no-repeat !important; }';
        }
        const result = NT_DOCS + css + '}';
        coversCssCache.set(coverTheme, { signature, css: result });
        return result;
      } catch (e) { mark('ERR covers ' + e); return ''; }
    }

    // --- Чтение userContent.css: синхронно, с проверкой файла ---
    // applyThemeSheet синхронный — IOUtils.readUTF8 (async) не подходит;
    // стримовый приём тот же, что у чтения VERSION в BobliksCovers. Кэш
    // сверяем путь/mtime/размер: замена файла очищает и разобранные фоны.
    // invalidateBgCache явно сбрасывает всё после импорта/обновления,
    // в том числе при замене с сохранёнными mtime и размером.
    let userContentCache = null;
    let userContentStamp = '';
    const animBgCssCache = new Map();
    function readUserContentCss() {
      try {
        const f = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
        f.append('userContent.css');
        if (!f.exists()) {
          userContentCache = null;
          userContentStamp = '';
          animBgCssCache.clear();
          return '';
        }
        const stamp = f.path + ':' + f.lastModifiedTime + ':' + f.fileSize;
        if (userContentCache !== null && userContentStamp === stamp) return userContentCache;
        animBgCssCache.clear();
        const istream = Cc['@mozilla.org/network/file-input-stream;1']
          .createInstance(Ci.nsIFileInputStream);
        istream.init(f, -1, 0, 0);
        const sstream = Cc['@mozilla.org/scriptableinputstream;1']
          .createInstance(Ci.nsIScriptableInputStream);
        sstream.init(istream);
        let text = '', avail;
        while ((avail = sstream.available()) > 0) {
          text += sstream.read(avail);
          if (text.length > 8 * 1024 * 1024) break; // защита от безумного файла
        }
        sstream.close(); istream.close();
        userContentCache = text;
        userContentStamp = stamp;
        return text;
      } catch (e) { mark('ERR readUserContent ' + e); return ''; }
    }

    // Извлекает внутренность CSS-блока, идущего за маркером: считает
    // вложенность фигурных скобок, пропуская строки и комментарии.
    // Возвращает содержимое (без самой обёртки) либо null
    function extractCssInner(text, marker) {
      const start = text.indexOf(marker);
      if (start < 0) return null;
      const openIdx = text.indexOf('{', start + marker.length);
      if (openIdx < 0) return null;
      let depth = 0, i = openIdx, n = text.length;
      while (i < n) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {          // пропускаем строку
          i++;
          while (i < n && text[i] !== ch) { if (text[i] === '\\') i++; i++; }
          i++; continue;
        }
        if (ch === '/' && text[i + 1] === '*') { // пропускаем комментарий
          i += 2;
          while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
          i += 2; continue;
        }
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) break; }
        i++;
      }
      if (depth !== 0) return null;
      return text.slice(openIdx + 1, i);
    }

    // --- CSS-анимационный фон (file: null): дубли правил из userContent.css
    // pulse/flow/aurora/matrix/ember/plasma/synthwave/mist/sakura/inferno
    // живут в userContent.css под @media -moz-pref("bobliks.bg.<id>"), который
    // замерзает; в USER_SHEET они не попадали (причина 3). Берём правила
    // прямо из файла — без преф/атрибут-гейтинга: лист перевешивается при
    // каждом клике, анимация стартует сразу
    function buildAnimBgCss(bgId) {
      const text = readUserContentCss();
      if (!text) { mark('FAIL animBg noCss ' + bgId); return ''; }
      if (animBgCssCache.has(bgId)) return animBgCssCache.get(bgId);
      // Маркер включает закрывающую кавычку+скобку префа: поиск
      // "bobliks.bg.inferno" не должен матчить "bobliks.bg.infernobg"
      const inner = extractCssInner(text, '@media -moz-pref("bobliks.bg.' + bgId + '")');
      if (!inner) { mark('FAIL animBg noBlock ' + bgId); return ''; }
      // Кейфреймы — на верхнем уровне щита (вложенные в @-moz-document
      // капризны — комментарий из userContent.css); тянем только те, что
      // реально используются извлечёнными правилами
      const used = new Set();
      const animRe = /animation\s*:\s*([^;}\n]+)/g;
      let m, css = '';
      while ((m = animRe.exec(inner))) {
        const name = m[1].trim().split(/[\s,]+/)[0];
        if (!name || used.has(name)) continue;
        used.add(name);
        const kf = extractCssInner(text, '@keyframes ' + name + ' ');
        if (kf) css += '@keyframes ' + name + ' {' + kf + '}';
      }
      const result = css + NT_DOCS + inner + '}';
      animBgCssCache.set(bgId, result);
      return result;
    }

    // --- Фон newtab для ЛЮБОГО активного фона ---
    function buildActiveBgCss(bgId) {
      const b = getAllBgs().find(x => x.id === bgId);
      if (!b) return '';
      if (b.file) {
        // Растр (встроенный/кастомный/original): абсолютный file:// URI —
        // относительный url("img/...") в data:-листе не резолвится (причина 4)
        const f = resolveImgFile(b.file);
        if (!f.exists()) return '';
        return NT_DOCS + ' :root body.activity-stream { background: ' + BG_GRAD +
          ', #0a0a0a url("' + PathUtils.toFileURI(f.path) +
          '") center bottom / cover no-repeat fixed !important; } }';
      }
      // CSS-анимация (file: null) — дубли правил из userContent.css
      return buildAnimBgCss(bgId);
    }

    // --- Перезагрузка открытых about:newtab/home после применения щитов ---
    // Свежий документ перевычисляет -moz-pref() блоки userContent.css и
    // covers.css по ТЕКУЩИМ префам — иначе замерзшее состояние (например,
    // ::before/::after старого анимационного фона) не снять ничем. Серию
    // вызовов (applyVisage зовёт setTheme+setBg подряд) коалсим в одну
    // перезагрузку: щиты уже применены мгновенно, перезагрузка — финализация
    let reloadTimer = null;
    function reloadNewtabTabs() {
      if (reloadTimer) return;
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        let reloaded = 0;
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
                if (!/^about:(newtab|home)/.test(spec)) continue;
                try { b.reload(); }
                catch (e) { try { w.gBrowser.reloadTab(tab); } catch (e2) {} }
                reloaded++;
              } catch (e) {}
            }
          }
        } catch (e) { mark('ERR reloadNewtab ' + e); }
        if (reloaded) mark('OK reloadNewtab=' + reloaded);
      }, 300);
    }

    // Живое внедрение кастомного фона (если newtab в родительском процессе;
    // для удалённой вкладки красит USER_SHEET applyThemeSheet). url() —
    // АБСОЛЮТНЫЙ file:// URI: about:newtab резолвит относительные пути от
    // своего документа, url("img/...") туда не доходил (причина 4)
    function applyBgToDoc(doc, bgId) {
      try {
        if (!doc || !doc.documentElement) return;
        let st = doc.getElementById('blade-custom-bg-style');
        const b = getAllBgs().find(x => x.id === bgId);
        if (b && b.isCustom && b.file) {
          const f = resolveImgFile(b.file);
          if (!f.exists()) { if (st) st.remove(); return; }
          if (!st) {
            st = doc.createElement('style');
            st.id = 'blade-custom-bg-style';
            doc.documentElement.appendChild(st);
          }
          st.textContent = 'body.activity-stream { background: ' + BG_GRAD +
            ', #0a0a0a url("' + PathUtils.toFileURI(f.path) +
            '") center bottom / cover no-repeat fixed !important; }';
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
        // Обложки плиток активной темы для всех доменов из img/themes/:
        // covers.css подключён @import'ом и не перезагружается, а -moz-pref()
        // и data-blade-theme до remote-newtab не доезжают — правила едут в
        // этом же щите (причины 1+2)
        const coversCss = buildActiveCoversCss(themeId);
        if (coversCss) cssText += ' ' + coversCss;
        // Фон newtab в тот же щит — для ЛЮБОГО активного фона: растр —
        // абсолютный file:// URI (относительный url() в data:-листе не
        // разрешается), CSS-анимация — дубли правил из userContent.css
        // (причины 3+4)
        let bgNote = '';
        const bgCss = buildActiveBgCss(activeBg());
        if (bgCss) { cssText += ' ' + bgCss; bgNote = ' bg=' + activeBg(); }
        const uri = Services.io.newURI('data:text/css,' + encodeURIComponent(cssText), null, null);
        if (!SSS.sheetRegistered(uri, SSS.USER_SHEET)) SSS.loadAndRegisterSheet(uri, SSS.USER_SHEET);
        currentThemeSheetUri = uri;
        mark('OK themeSheet ' + themeId + bgNote + (coversCss ? ' covers=on' : ' covers=off'));
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
      // Перезагрузить открытые about:newtab/home: свежий документ
      // перевычислит -moz-pref() блоки userContent.css/covers.css по новым
      // префам — замерзшее состояние старой темы иначе не снять
      reloadNewtabTabs();
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
        const file = resolveImgFile(fileLeafName);
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
      bgId = normalizeBgId(bgId);
      const b = getAllBgs().find(x => x.id === bgId);
      if (!b) return;
      // CSS-фоны (file: null) идут мимо файлов — им нужен только преф
      if (b.file) {
        const src = resolveImgFile(b.file);
        if (!src.exists()) { mark('FAIL no file ' + b.file); return; }
      }
      // Префы — источник правды; правила кастомных генерит BobliksCovers
      Services.prefs.setStringPref('bobliks.bg.current', bgId);
      for (const x of BUILTIN_BGS) Services.prefs.clearUserPref('bobliks.bg.' + x.id);
      for (const x of getCustomBgs()) Services.prefs.clearUserPref('bobliks.bg.' + x.prefId);
      for (const x of getOriginalBgs()) Services.prefs.clearUserPref('bobliks.bg.' + x.prefId);
      for (const prefId of retiredOriginalPrefIds) Services.prefs.clearUserPref('bobliks.bg.' + prefId);
      if (bgId !== 'acheron') {
        Services.prefs.setBoolPref('bobliks.bg.' + (b.isCustom ? b.prefId : bgId), true);
      }
      // Кастомный — мгновенно через юзер-щит; штатный — снять юзер-щит
      applyCustomBgSheet(b.isCustom && b.file ? b.file : null);
      applyLiveAttrs();
      // перегенерировать тематический щит: в нём же правило фона newtab
      applyThemeSheet(activeTheme());
      // Перезагрузить открытые about:newtab/home (см. комментарий в setTheme)
      reloadNewtabTabs();
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
        getAllBgs, getCustomBgs, getOriginalBgs, bgPrefId,
        // текущее состояние
        activeTheme, activeBg, getImgDir, normalizeBgId,
        invalidateBgCache: () => {
          customBgsCache = null;
          originalBgsCache = null;
          coversCssCache.clear();
          userContentCache = null;
          userContentStamp = '';
          animBgCssCache.clear();
        },
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
