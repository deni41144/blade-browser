// ==UserScript==
// @name            Blade Covers
// @description     Тематические обложки плиток: img/themes/<домен>/<тема>.jpg — своя
//                  обложка для каждой темы. Плюс плоский фолбэк img/covers/<домен>.png.
// @author          Blade-Creations
// @include         main
// @onlyonce
// @version         2.2.0
// ==/UserScript==
(function () {
  const mark = (text) => {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('covers_mark.txt');
      IOUtils.writeUTF8(d.path, text).catch(() => {});
    } catch (e) {}
  };
  // @onlyonce: генерация только в первом окне сессии — раньше каждое окно
  // перегенерировало covers.css, с гонкой записи между окнами. regenerate
  // дергается на старте и по тумблеру 'bobliks.covers.dirty' (его ставит
  // BobliksSettings при выборе обоев/цвета кастомной темы — цвет запекается
  // в covers.css, новые обои = новый преф bobliks.bg.file_*)
  function regenerate() {
  try {
    const chromeDir = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    const imgDir = chromeDir.clone(); imgDir.append('img');
    const themesDir = imgDir.clone(); themesDir.append('themes');
    const flatDir = imgDir.clone(); flatDir.append('covers');

    const RULE_PROPS = ' background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important; }';
    const SEL = (d) => '.top-site-outer .top-site-button[href*="' + d + '"] .tile {';
    const themes = ['blood', 'cherry', 'midnight', 'purple', 'green', 'grey', 'orange', 'volt'];

    const lines = [];

    // --- 1. Тематические наборы: img/themes/<домен>/<тема>.jpg ---
    let domains = 0, blocks = 0;
    if (themesDir.exists() && themesDir.isDirectory()) {
      // Сначала собираем все домены в массив
      const domainList = [];
      const dIter = themesDir.directoryEntries;
      let dEntry;
      while (dIter.hasMoreElements()) {
        dEntry = dIter.getNext().QueryInterface(Ci.nsIFile);
        const domain = dEntry.leafName.toLowerCase();
        if (!dEntry.isDirectory() || !domain) continue;
        domainList.push({ domain: domain, entry: dEntry });
      }
      // КЛЮЧЕВОЙ ФИКС: сортировка по длине домена (КОРОТКИЕ первыми).
      // Тогда music.youtube.com (17 симв) получает правило ПОЗЖЕ
      // youtube.com (11 симв) — и побеждает в каскаде при совпадении.
      domainList.sort((a, b) => a.domain.length - b.domain.length);
      for (const item of domainList) {
        const domain = item.domain;
        const dirEntry = item.entry;
        domains++;
        // Базовая red.jpg необязательна: набор «Minimal Grey» (NEWULTRAMAX
        // PLITKI V.2.0) принесён только в серой теме — домены без red.jpg
        // раньше выпадали из обложек ЦЕЛИКОМ (continue). Теперь базу
        // пропускаем, если её нет, а тематические правила строим для тех
        // файлов, что реально есть.
        const redFile = dirEntry.clone(); redFile.append('red.jpg');
        if (redFile.exists()) {
          lines.push(SEL(domain) + ' background-image: url("img/themes/' + domain + '/red.jpg") !important;' + RULE_PROPS);
        }
        for (const t of themes) {
          const tf = dirEntry.clone(); tf.append(t + '.jpg');
          if (!tf.exists()) continue;
          // Два механизма: -moz-pref для холодного старта (он в Gecko иногда
          // замерзает до перезапуска) + атрибут для живого переключения
          // (ревью Gemini №1.4: раньше обложки отставали от живой смены темы)
          lines.push('@media -moz-pref("bobliks.theme.' + t + '") {\n' +
            '  ' + SEL(domain) + ' background-image: url("img/themes/' + domain + '/' + t + '.jpg") !important; }\n' +
            '}');
          lines.push(':root[data-blade-theme="' + t + '"] ' + SEL(domain) +
            ' background-image: url("img/themes/' + domain + '/' + t + '.jpg") !important;' + RULE_PROPS);
          blocks++;
        }
      }
      // ФОЛБЭК «СЛЕПЫХ ПЛИТОК» (Gemini раунд 9): сайт без готовой обложки
      // (github, twitch, новостные — добавленные через «+») получает неоновую
      // монограмму: радиальный градиент в цвет темы + крупная надпись по центру
      // (раунд 23: раньше — тёмный прямоугольник без акцента). Мега-селектор
      // :not() по всем известным доменам перекрывает глобальное скрытие .title
      if (domainList.length) {
        const notChain = domainList.map(x => ':not([href*="' + x.domain + '"])').join('');
        lines.push('.top-site-button' + notChain + ' .tile { background: radial-gradient(circle at 50% 28%, color-mix(in srgb, var(--bob-accent, #ff2a2a) 22%, transparent), #101016 72%) !important; border: 1px solid color-mix(in srgb, var(--bob-accent, #ff2a2a) 30%, rgba(255,255,255,0.1)) !important; }');
        // Заголовок — большая монограмма по центру ПОВЕРХ плитки (раунд 15)
        lines.push('.top-site-button' + notChain + ' { position: relative !important; }');
        lines.push('.top-site-button' + notChain + ' .title { display: flex !important; align-items: center !important; justify-content: center !important; position: absolute !important; inset: 0 !important; color: #f0f0f5 !important; font-size: 17px !important; font-weight: 800 !important; letter-spacing: 1.5px !important; text-transform: uppercase !important; text-align: center !important; text-shadow: 0 0 14px color-mix(in srgb, var(--bob-accent, #ff2a2a) 60%, transparent), 0 2px 8px rgba(0, 0, 0, 0.95) !important; pointer-events: none !important; padding: 10px !important; z-index: 3 !important; overflow: hidden !important; }');
      }
    }

    // --- 2. Плоский фолбэк: img/covers/<домен>.(png|jpg|webp) — мультиформат
    // (раунд 22: раньше жёстко только .png, webp/jpg отсекались) ---
    let flat = 0;
    if (flatDir.exists() && flatDir.isDirectory()) {
      const fIter = flatDir.directoryEntries;
      let fEntry;
      while (fIter.hasMoreElements()) {
        fEntry = fIter.getNext().QueryInterface(Ci.nsIFile);
        const name = fEntry.leafName;
        if (!/[.](png|jpg|jpeg|webp)$/i.test(name)) continue;
        const domain = name.replace(/[.](png|jpg|jpeg|webp)$/i, '').toLowerCase();
        if (!domain.includes('.')) continue; // без точки — не домен
        if (lines.some(l => l.includes('href*="' + domain + '"'))) continue; // уже есть тематический
        lines.push(SEL(domain) + ' background-image: url("img/covers/' + name + '") !important;' + RULE_PROPS);
        flat++;
      }
    }

    // Custom catalog owns migration and stable ids; Covers must use exactly
    // the same paths/pref hashes as the live backdrop engine.
    let customs = 0;
    try {
      for (const bg of window.BladeEngine.getCustomBgs()) {
        const safe = bg.prefId;
        const encodedPath = bg.file.split('/').map(x => encodeURIComponent(x)).join('/');
        const BGSTYLE = 'background: linear-gradient(180deg, rgba(10,10,12,0.35) 0%, rgba(10,10,12,0.10) 45%, rgba(10,10,12,0.25) 100%), #0a0a0a url("img/' + encodedPath + '") center bottom / cover no-repeat fixed !important;';
        const escapedId = bg.id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        lines.push('@media -moz-pref("bobliks.bg.' + safe + '") { :root body.activity-stream { ' + BGSTYLE + ' } }');
        lines.push(':root[data-blade-bg="' + escapedId + '"] body.activity-stream { ' + BGSTYLE + ' }');
        customs++;
      }
    } catch (e) { mark('ERR customBgs ' + e); }

    // --- 3a. ПАПКА ORIGINAL (v2.2.0): обои дизайнера из V3-папки
    // (BladeThemeEngine копирует их в img/original/). Тот же хэш-контракт
    // bgPrefId('original/<имя>'), id: 'orig:<имя>'. Корень img/ сканится
    // выше, а папки там пропускаются — двойного правила не будет ---
    let origs = 0;
    try {
      const origDir = imgDir.clone(); origDir.append('original');
      if (origDir.exists() && origDir.isDirectory()) {
        const oIter = origDir.directoryEntries;
        let oEntry;
        while (oIter.hasMoreElements()) {
          oEntry = oIter.getNext().QueryInterface(Ci.nsIFile);
          if (oEntry.isDirectory()) continue;
          const name = oEntry.leafName;
          if (!/[.](jpg|jpeg|png|webp|avif|gif)$/i.test(name)) continue;
          const rel = 'original/' + name;
          const safe = window.Blade.bgPrefId(rel);
          const BGSTYLE = 'background: linear-gradient(180deg, rgba(10,10,12,0.35) 0%, rgba(10,10,12,0.10) 45%, rgba(10,10,12,0.25) 100%), #0a0a0a url("img/' + encodeURI(rel) + '") center bottom / cover no-repeat fixed !important;';
          lines.push('@media -moz-pref("bobliks.bg.' + safe + '") { :root body.activity-stream { ' + BGSTYLE + ' } }');
          lines.push(':root[data-blade-bg="orig:' + name + '"] body.activity-stream { ' + BGSTYLE + ' }');
          origs++;
        }
      }
    } catch (e) { mark('ERR origBgs ' + e); }

    // --- 3b. ТЕМАТИЗАЦИЯ САЙТОВ (v1.6 REFORGE): всё через var(--bob-accent),
    // который темы обновляют живо на ЛЮБОМ сайте (userContent.css задают его
    // + rgb/контраст). Пер-теменные литералы не нужны. Исключение — кастомная
    // тема конструктора: её цвет динамический, печём текущее значение одним
    // блоком (обновляется при рестарте/перегенерации).
    const SITES_SEL = ['instagram.com', 'chatgpt.com', 'chat.openai.com', 'gemini.google.com', 'web.telegram.org'];
    let customHex = '#ff2a2a';
    try { customHex = (Services.prefs.getStringPref('blade.theme.customColor', '') || '').trim() || '#ff2a2a'; } catch (e) {}
    if (!/^#[0-9a-fA-F]{6}$/.test(customHex)) customHex = '#ff2a2a';
    const cr = parseInt(customHex.slice(1, 3), 16), cg = parseInt(customHex.slice(3, 5), 16), cb = parseInt(customHex.slice(5, 7), 16);
    const customRgb = cr + ', ' + cg + ', ' + cb;
    const customContrast = (0.2126 * cr + 0.7152 * cg + 0.0722 * cb) > 150 ? '#0a0a0c' : '#fff';
    const DOMS = (list) => '@-moz-document ' + list.map((d) => 'domain("' + d + '")').join(', ') + ' {';

    // TELEGRAM: акцент интерфейса + ИСХОДЯЩИЕ сообщения в акцентном тинте
    // (переменные --message-out-* из web.telegram.org/k — проверено по бандлу)
    const B_TELEGRAM =
      '  :root { --primary-color: var(--bob-accent, #ff2a2a) !important; --primary-color-rgb: var(--bob-accent-rgb, 255, 42, 42) !important; }' +
      '  * { --message-out-background-color: color-mix(in srgb, var(--bob-accent, #ff2a2a) 42%, #101014) !important;' +
      '    --message-out-primary-color: #ffffff !important;' +
      '    --message-out-link-color: rgba(255, 255, 255, 0.85) !important;' +
      '    --message-out-status-color: rgba(255, 255, 255, 0.55) !important;' +
      '    --message-out-time-color: rgba(255, 255, 255, 0.6) !important;' +
      '    --message-out-icon-text-color: #ffffff !important; }';
    // УНИВЕРСАЛЬНЫЙ КАСАНИЕ: выделение текста + скроллбар
    const B_TOUCH = '  ::selection { background: var(--bob-accent, #ff2a2a) !important; color: var(--bob-accent-contrast, #fff) !important; } html { scrollbar-color: var(--bob-accent, #ff2a2a) transparent !important; }';
    // YOUTUBE: спек-переменные + шапка-градиент + прогресс плеера + активный
    // пункт сайдбара + ссылки описаний (всё light-DOM или переменные)
    const B_YTSPEC =
      '  :root, ytd-app, ytmusic-app { --yt-spec-brand-button-background: var(--bob-accent, #ff2a2a) !important; --yt-spec-static-brand-red: var(--bob-accent, #ff2a2a) !important; --yt-spec-call-to-action: var(--bob-accent, #ff2a2a) !important; --yt-spec-icon-active-button: var(--bob-accent, #ff2a2a) !important; --yt-spec-wordmark-text: var(--bob-accent, #ff2a2a) !important; }' +
      '  ytd-masthead { background: linear-gradient(180deg, color-mix(in srgb, var(--bob-accent, #ff2a2a) 55%, #0f0f0f) 0%, #0f0f0f 90%) !important; border-bottom: 2px solid var(--bob-accent, #ff2a2a) !important; box-shadow: 0 4px 16px color-mix(in srgb, var(--bob-accent, #ff2a2a) 30%, transparent) !important; }' +
      '  .ytp-swatch-background-color, .ytp-played-progress { background: var(--bob-accent, #ff2a2a) !important; background-color: var(--bob-accent, #ff2a2a) !important; }' +
      '  ytd-guide-entry-renderer[active] { background: color-mix(in srgb, var(--bob-accent, #ff2a2a) 16%, transparent) !important; }' +
      '  yt-chip-cloud-chip-renderer[selected] { background: var(--bob-accent, #ff2a2a) !important; color: var(--bob-accent-contrast, #fff) !important; }' +
      '  a.yt-core-link, #description a { color: var(--bob-accent, #ff2a2a) !important; }';
    // YTM: свои переменные + нав-бар + активная навигация
    const B_YTM =
      '  :root, ytmusic-app { --ytmusic-static-brand-red: var(--bob-accent, #ff2a2a) !important; --ytmusic-brand-color: var(--bob-accent, #ff2a2a) !important; }' +
      '  ytmusic-nav-bar { background: linear-gradient(180deg, color-mix(in srgb, var(--bob-accent, #ff2a2a) 55%, #030303) 0%, #030303 90%) !important; border-bottom: 2px solid var(--bob-accent, #ff2a2a) !important; box-shadow: 0 4px 16px color-mix(in srgb, var(--bob-accent, #ff2a2a) 30%, transparent) !important; }' +
      '  ytmusic-guide-entry-renderer[active] { background: color-mix(in srgb, var(--bob-accent, #ff2a2a) 16%, transparent) !important; }';

    lines.push(DOMS(['web.telegram.org']) + ' ' + B_TELEGRAM + ' }');
    lines.push(DOMS(SITES_SEL) + ' ' + B_TOUCH + ' }');
    lines.push(DOMS(['youtube.com']) + ' ' + B_YTSPEC + ' }');
    lines.push(DOMS(['music.youtube.com']) + ' ' + B_YTM + ' }');

    // Кастомная тема: цвет подмешивает ДИНАМИЧЕСКИЙ щит из BobliksSettings
    // (applyCustomAccentSheet) — запечённые литералы больше не нужны (v1.6).

    // CYBER-HUD (Gemini раунд 12): моно-бейдж версии в углу новой вкладки.
    // Версию читаем синхронно из chrome/VERSION (тем же стримовым приёмом)
    let hudVer = '';
    try {
      const vFile = chromeDir.clone(); vFile.append('VERSION');
      if (vFile.exists()) {
        const istream = Cc['@mozilla.org/network/file-input-stream;1']
          .createInstance(Ci.nsIFileInputStream);
        istream.init(vFile, -1, 0, 0);
        const sstream = Cc['@mozilla.org/scriptableinputstream;1']
          .createInstance(Ci.nsIScriptableInputStream);
        sstream.init(istream);
        hudVer = sstream.read(sstream.available()).trim();
        sstream.close(); istream.close();
      }
    } catch (e) {}
    if (hudVer) {
      lines.push('@-moz-document url("about:newtab"), url("about:home") {');
      // .outer-wrapper, не body: у Blood Flow занят body::after — конфликт (Gemini раунд 13)
      lines.push('  .outer-wrapper::after {');
      lines.push('    content: "BLADE // v' + hudVer + '";');
      lines.push('    position: fixed; right: 14px; bottom: 10px;');
      lines.push('    font-family: monospace; font-size: 11px; letter-spacing: 1px;');
      lines.push('    color: var(--bob-accent, #ff2a2a);');
      lines.push('    opacity: 0.42;');
      lines.push('    pointer-events: none;');
      lines.push('    text-shadow: 0 0 8px color-mix(in srgb, var(--bob-accent, #ff2a2a) 50%, transparent);');
      lines.push('    z-index: 5;');
      lines.push('  }');
      lines.push('}');
    }

    const NL = String.fromCharCode(10);
    const css = '@charset "UTF-8";' + NL +
                '/* Сгенерировано BladeCovers.uc.js v2 — не редактируй.' + NL +
                '   Тематические обложки: img/themes/<домен>/<тема>.jpg (red|blood|cherry|midnight|purple|green|grey|orange|volt).' + NL +
                '   Фолбэк: img/covers/<домен>.png */' + NL + lines.join(NL) + NL;

    const outFile = chromeDir.clone(); outFile.append('covers.css');
    IOUtils.writeUTF8(outFile.path, css).then(
      () => mark('v2.2.0 OK domains=' + domains + ' themeBlocks=' + blocks + ' flat=' + flat + ' customBgs=' + customs + ' origBgs=' + origs),
      (e) => mark('v2.2.0 ERR write ' + e)
    );
  } catch (e) { mark('v2.2.0 ERR ' + e + ' | ' + (e.stack || '').slice(0, 200)); }
  }
  regenerate();
  // Тумблер перегенерации: nsIPrefBranch зовёт наблюдателя синхронно при
  // смене префа, файл к этому моменту уже скопирован/цвет уже записан
  try {
    Services.prefs.addObserver('bobliks.covers.dirty', () => regenerate());
  } catch (e) { mark('v2.2.0 ERR observer ' + e); }
})();
