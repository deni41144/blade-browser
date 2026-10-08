// ==UserScript==
// @name            Blade Theme Engine
// @description     Движок тем и фонов: каталоги, цветная математика кастомной
//                  темы, тематический щит USER_SHEET, живые атрибуты,
//                  setTheme/setBg и стартовая раскраска. Шаг 7 декомпозиции
// @author          Blade-Creations
// @include         main
// @version         1.2.4
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
            const text = 'v1.2.4 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
            IOUtils.writeUTF8(markPath, text).catch(() => {});
        } catch (e2) {}
    };

    // Единственный источник каталогов — BladeCore (@loadOrder 5, грузится
    // раньше). BUILTIN_BGS объявлен ниже внутри перенесённого блока
    const {themeState: sheets} = ChromeUtils.importESModule('chrome://userscripts/content/BladeThemeState.sys.mjs');
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
        // 1.2.4: новый щит до снятия старого — без кадра без стилей.
        if (!sss.sheetRegistered(uri, sss.USER_SHEET)) sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
        const prevSel = fieldSelectionURI;
        fieldSelectionURI = uri;
        if (prevSel && !prevSel.equals(uri) && sss.sheetRegistered(prevSel, sss.USER_SHEET)) sss.unregisterSheet(prevSel, sss.USER_SHEET);
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
    // Свои картинки лежат отдельно от ресурсов браузера. Имена id/pref
    // сохраняются при переезде, поэтому выбор и сохранённые облики не слетают.
    function getCustomBgDir() {
      const root = getImgDir(); root.normalize();
      const dir = root.clone(); dir.append('custom');
      if (!dir.exists()) dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      dir.normalize();
      if (!dir.isDirectory() || dir.isSymlink() || dir.leafName !== 'custom' || !dir.parent.equals(root) || !root.contains(dir, true)) throw new Error('Invalid custom wallpaper directory');
      return dir;
    }
    function bgPrefId(fileName) { return window.Blade.bgPrefId(fileName); }
    const CUSTOM_IMAGE_EXT = /[.](jpg|jpeg|png|webp|avif|gif)$/i;
    let customBgsCache = null;
    function getCustomBgs() {
      if (customBgsCache) return customBgsCache;
      const customs = [];
      try {
        const root = getImgDir(); root.normalize();
        const dest = getCustomBgDir();
        const reserved = window.Blade.reservedImgFiles();
        const legacy = [];
        const iter = root.directoryEntries;
        while (iter.hasMoreElements()) {
          const entry = iter.getNext().QueryInterface(Ci.nsIFile);
          if (!entry.isFile() || entry.isSymlink() || !CUSTOM_IMAGE_EXT.test(entry.leafName) || reserved.has(entry.leafName.toLowerCase())) continue;
          legacy.push(entry);
        }
        // Only direct image files. Never overwrite a collision or traverse
        // a link out of img; keep legacy entries readable if a move fails.
        for (const entry of legacy) {
          const name = entry.leafName;
          const target = dest.clone(); target.append(name);
          try {
            entry.normalize(); target.normalize();
            if (!root.contains(entry, true) || !dest.contains(target, true)) continue;
            if (!target.exists()) entry.moveTo(dest, name);
          } catch (e) { mark('ERR customMove ' + e); }
        }
        const seen = new Set();
        function collect(dir, prefix) {
          const items = dir.directoryEntries;
          while (items.hasMoreElements()) {
            const entry = items.getNext().QueryInterface(Ci.nsIFile);
            if (!entry.isFile() || entry.isSymlink() || !CUSTOM_IMAGE_EXT.test(entry.leafName)) continue;
            const name = entry.leafName;
            if (!prefix && reserved.has(name.toLowerCase())) continue;
            entry.normalize();
            if (!dir.contains(entry, true)) continue;
            // Root wins a name collision so its pre-existing selected id
            // still identifies the same image. Both files stay accessible.
            const identity = seen.has(name.toLowerCase()) ? prefix + name : name;
            seen.add(name.toLowerCase());
            const clean = name.replace(/[.][^.]+$/, '').replace(/^bg_/, '').replace(/[-_]+/g, ' ').trim();
            customs.push({ id:'file:' + identity,
              label:'📁 ' + (clean.length > 22 ? clean.slice(0, 20) + '…' : clean || name),
              file:prefix + name, isCustom:true, prefId:bgPrefId(identity), group:'custom' });
          }
        }
        collect(root, '');
        collect(dest, 'custom/');
        customs.sort((a, b) => a.label.localeCompare(b.label));
      } catch (e) { mark('ERR getCustomBgs ' + e); }
      customBgsCache = customs;
      return customs;
    }
    // Resolve only safe paths inside img. Catalog.file includes custom/;
    // flat legacy callers prefer a still-existing root file on collisions.
    function resolveImgFile(rel) {
      const parts = String(rel || '').split(/[\\/]/);
      if (!parts.length || parts.some(p => !p || p === '.' || p === '..' || /[:\x00]/.test(p))) throw new Error('Invalid wallpaper path');
      const root = getImgDir(); root.normalize();
      const file = root.clone();
      for (const part of parts) file.append(part);
      file.normalize();
      if (!root.contains(file, true)) throw new Error('Wallpaper path outside img');
      if (parts.length === 1 && !file.exists() && !window.Blade.reservedImgFiles().has(parts[0].toLowerCase())) {
        const custom = getCustomBgDir(); custom.append(parts[0]); custom.normalize();
        if (!root.contains(custom, true)) throw new Error('Wallpaper path outside img');
        return custom;
      }
      return file;
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
      let savedRaw = '';
      try { savedRaw = Services.prefs.getStringPref('bobliks.bg.current', ''); } catch (e) {}
      if (savedRaw === lastMigratedSaved) return savedRaw;
      if (!/^orig:/i.test(savedRaw || '')) { lastMigratedSaved = savedRaw; return savedRaw; }
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
      lastMigratedSaved = next;
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
    // Wallpaper changes wait for decode; themes never replace the backdrop.
    let disposed = false;
    async function preloadRasterBg(bgId) {
      const b = getAllBgs().find(x => x.id === bgId);
      if (!b?.file) return Promise.resolve();
      const f = resolveImgFile(b.file);
      if (!f.exists()) return Promise.reject(new Error('Wallpaper file missing'));
      const url = PathUtils.toFileURI(f.path);
      const processes = new Map();
      const windows = Services.wm.getEnumerator('navigator:browser');
      while (windows.hasMoreElements()) {
        for (const browser of windows.getNext().gBrowser?.browsers || []) {
          if (!/^about:(newtab|home)(?:[?#]|$)/.test(browser.currentURI?.spec || '')) continue;
          const global = browser.browsingContext.currentWindowGlobal;
          if (!global || processes.has(global.osPid)) continue;
          processes.set(global.osPid, global.getActor('BladeEffectsVisibility'));
        }
      }
      // Chrome's Image cache is not the remote content Image cache. Decode
      // once per content process, not once per tab, before replacing its CSS.
      if (processes.size) {
        const prepared = await Promise.all(Array.from(processes.values(),
          actor => actor.sendQuery('Blade:PrepareWallpaper', {url})));
        if (prepared.some(result => !result?.ready)) throw new Error('Content wallpaper decode failed: ' + JSON.stringify(prepared));
        return;
      }
      return new Promise((resolve, reject) => {
        const image = new window.Image();
        const timer = window.setTimeout(() => finish(new Error('Wallpaper decode timed out')), 6000);
        let settled = false;
        function finish(error) {
          if (settled) return;
          settled = true; window.clearTimeout(timer);
          if (error) { image.src = ''; reject(error); } else resolve(image);
        }
        image.src = url;
        image.decode().then(() => finish(), finish);
      });
    }
    function applyThemeSheet(themeId) {
      try {
        const SSS = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
        // Повтор того же состояния — пропуск: нет пересборки CSS и рестайла.
        const sig = themeId + '|' +
          (themeId === 'custom' ? getCustomColor() : '');
        if (sig === sheets.themeSignature && sheets.themeURI &&
            SSS.sheetRegistered(sheets.themeURI, SSS.USER_SHEET)) return;
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
        const uri = Services.io.newURI('data:text/css,' + encodeURIComponent(cssText), null, null);
        if (!SSS.sheetRegistered(uri, SSS.USER_SHEET)) SSS.loadAndRegisterSheet(uri, SSS.USER_SHEET);
        // 1.2.4: новый щит встаёт ДО снятия старого — нет кадра без стилей.
        const prev = sheets.themeURI;
        sheets.themeURI = uri;
        sheets.themeSignature = sig;
        if (prev && !prev.equals(uri) && SSS.sheetRegistered(prev, SSS.USER_SHEET)) {
          SSS.unregisterSheet(prev, SSS.USER_SHEET);
        }
        mark('OK themeSheet ' + themeId + (coversCss ? ' covers=on' : ' covers=off'));
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
              const root = w.document.documentElement;
              if (root.getAttribute('data-blade-theme') !== theme) root.setAttribute('data-blade-theme', theme);
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
      const t = THEMES.find(x => x.id === themeId);
      if (!t || disposed) return false;
      const sig = themeId + '|' + (themeId === 'custom' ? getCustomColor() : '');
      if (activeTheme() === themeId && sheets.themeSignature === sig) return true;
      if (activeTheme() !== themeId) {
        for (const x of THEMES) {
          if (x.pref && Services.prefs.prefHasUserValue(x.pref)) Services.prefs.clearUserPref(x.pref);
        }
        if (t.pref) Services.prefs.setBoolPref(t.pref, true);
      }
      syncSelectionPrefs(themeId);
      applyThemeSheet(themeId);
      applyLiveAttrs();
      window.Blade?.bus.emit('theme:changed', themeId);
      return true;
    }

    // A high-specificity baseline overrides frozen -moz-pref pseudo-elements.
    // The selected animation follows it in the same sheet. No document reload.
    function applyBackdrop(bgId) {
      const b = getAllBgs().find(x => x.id === bgId);
      if (!b) return false;
      let fileURL = '', stamp = bgId;
      if (b.file) {
        const file = resolveImgFile(b.file);
        if (!file.exists()) return false;
        fileURL = PathUtils.toFileURI(file.path);
        stamp += ':' + file.lastModifiedTime + ':' + file.fileSize;
      }
      const SSS = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
      if (stamp === sheets.bgSignature && sheets.bgURI && SSS.sheetRegistered(sheets.bgURI, SSS.USER_SHEET)) return true;
      const reset = NT_DOCS + `
        :root:root body.activity-stream {scrollbar-width:none !important;}
        :root:root body.activity-stream::before, :root:root body.activity-stream::after {
          content:none; animation:none; background:none; opacity:1;
          position:fixed; inset:0; z-index:-1; pointer-events:none;
        } }`;
      let backdrop;
      if (fileURL) {
        backdrop = NT_DOCS + ':root:root body.activity-stream {' +
          'background-color:#0a0a0a !important;' +
          'background-image:' + BG_GRAD + ', url("' + fileURL + '") !important;' +
          'background-position:center bottom !important; background-size:cover !important;' +
          'background-repeat:no-repeat !important; background-attachment:fixed !important;} }';
      } else {
        backdrop = buildAnimBgCss(bgId).replace(/body\.activity-stream/g, ':root:root body.activity-stream');
        if (!backdrop) return false;
      }
      const uri = Services.io.newURI('data:text/css,' + encodeURIComponent(reset + backdrop));
      if (!SSS.sheetRegistered(uri, SSS.USER_SHEET)) SSS.loadAndRegisterSheet(uri, SSS.USER_SHEET);
      const previous = sheets.bgURI;
      sheets.bgURI = uri; sheets.bgSignature = stamp;
      if (previous && !previous.equals(uri) && SSS.sheetRegistered(previous, SSS.USER_SHEET)) SSS.unregisterSheet(previous, SSS.USER_SHEET);
      return true;
    }
    // Compatibility for callers importing/replacing the current wallpaper.
    function applyCustomBgSheet() { return applyBackdrop(activeBg()); }
    async function setBg(rawBg) {
      const bgId = normalizeBgId(rawBg);
      const b = getAllBgs().find(x => x.id === bgId);
      if (!b || disposed) return false;
      const request = ++sheets.bgRequest;
      if (bgId === activeBg() && sheets.bgSignature) return true;
      let image;
      try { image = await preloadRasterBg(bgId); }
      catch (e) {
        if (!disposed && request === sheets.bgRequest) mark('FAIL wallpaper decode', e);
        return false;
      }
      if (disposed || request !== sheets.bgRequest) return false;
      // Register the prepared backdrop before changing preference rules.
      if (!applyBackdrop(bgId)) return false;
      for (const x of [...BUILTIN_BGS, ...getCustomBgs(), ...getOriginalBgs()]) {
        const pref = 'bobliks.bg.' + (x.prefId || x.id);
        if (Services.prefs.prefHasUserValue(pref)) Services.prefs.clearUserPref(pref);
      }
      for (const id of retiredOriginalPrefIds) Services.prefs.clearUserPref('bobliks.bg.' + id);
      Services.prefs.setStringPref('bobliks.bg.current', bgId);
      if (bgId !== 'acheron') Services.prefs.setBoolPref('bobliks.bg.' + (b.prefId || bgId), true);
      lastMigratedSaved = bgId;
      applyLiveAttrs();
      // Keep the decoded image alive through registration, without an unbounded cache.
      image = null;
      mark('OK background=' + bgId);
      return true;
    }
    let lastMigratedSaved = null;
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
            applyBackdrop(activeBg());
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
        activeTheme, activeBg, getImgDir, getCustomBgDir, resolveImgFile, normalizeBgId,
        invalidateBgCache: () => {
          customBgsCache = null;
          originalBgsCache = null;
          coversCssCache.clear();
          userContentCache = null;
          userContentStamp = '';
          animBgCssCache.clear();
          sheets.themeSignature = ''; sheets.bgSignature = '';
        },
        // запись
        setTheme, setBg, applyThemeSheet, applyCustomBgSheet,
        applyLiveAttrs, syncSelectionPrefs,
        // цветная математика кастомной темы (для BladeThemeLab)
        getCustomColor, customVars, hexToRgb, applyCustomToDoc,
        // живое внедрение в документы
        applyBgToDoc, newtabDocs,
    };
    window.addEventListener('unload', () => { disposed = true; }, {once:true});
    mark('LOADED');
})();
