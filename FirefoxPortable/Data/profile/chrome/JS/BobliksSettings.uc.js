// ==UserScript==
// @name            Bobliks Settings
// @description     Кнопка настроек Bobliks-Creations: смена темы и фона в один клик
// @author          Bobliks-Creations
// @include         main
// @version         1.15.0
// ==/UserScript==
// ═══════════════════════════════════════════════════════════════════════
// КАРТА ФАЙЛА (Волна 2 «Blade Studio», разметка по карте Analyst):
//   CORE — mark/CustomizableUI (23)
//   ДАННЫЕ — THEMES (контракт BladeCore для docObs PiP-неона) (58)
//   THEMES+BGS — вынесены в BladeThemeEngine.uc.js v1.0.0 (@loadOrder 8, 67)
//   VISAGES — вынесены в BladeVisages.uc.js v1.0.0 (@loadOrder 12, 83)
//   SYSTEM — уведомления/бэкап вынесены в BladeSystemTools.uc.js v1.0.0 (92)
//   МЕНЮ B — вынесено: BladeMenuPopup (@11, 104) + BladeMenuButton (@12)
//   INIT — boot()->плитки->docObs->downloads->shazam (порядок важен) (124)
//   API — window.BladeSettings: делегирует в движок (307)
//   ФИНАЛ — mark/catch (342)
// Риски 1-10 и план полной неймспейс-декомпозиции — ROADMAP-2.0.md раздел 10.
// ═══════════════════════════════════════════════════════════════════════
(function () {
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: CORE — диагностика + CUI-bootstrap
    // mark/CustomizableUI (для restores downloads-кнопки ниже); версия сборки,
    // PERF-кэш и id виджета/панели уехали в модули меню (шаг 8). Core не имеет зависимостей
    // ═══════════════════════════════════════════════════════════════════
  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\bobliks_settings_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.15.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };
    mark('START');
    // Версия/кодовое имя сборки (chrome\VERSION + CODENAME) и PERF-кэш
    // (JS\perf_mark.txt) для вкладок панели — вынесены в BladeMenuPopup.uc.js
    // v1.0.0 (@loadOrder 11) вместе с рендером вкладок

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
    // DNS_URI (DoH-провайдеры для вкладки СИСТЕМА) — вынесен в
    // BladeMenuPopup.uc.js v1.0.0 (@loadOrder 11) вместе с диспетчером

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
    // ═══════════════════════════════════════════════════════════════════
    // СЕКЦИЯ: МЕНЮ B — ВЫНЕСЕНА (шаг 8 декомпозиции, 2026-09-22):
    //  • BladeMenuPopup.uc.js v1.0.0 (@loadOrder 11) — панель: CSS, вкладки,
    //    buildPopup, ensurePopup + клик-диспетчер, версия/кодовое имя, PERF,
    //    DNS_URI, POPUP_ID. API: window.BladeMenuPopup.open(btn)
    //  • BladeMenuButton.uc.js v1.0.0 (@loadOrder 12) — кнопка B в nav-bar
    //    (прямая DOM-вставка, CUI не нужен) + keyset (Shift+F2/F3 темы,
    //    Alt+B/F1 меню). САМОМОНТИРУЕТСЯ — из INIT удалена и регистрация
    //    наблюдателя, и таймер-страховка, и keyset.
    // Все переходы делегированы: тема/фон — window.BladeEngine, облики —
    // window.BladeVisages, конструктор — window.BladeThemeLab, бэкап —
    // window.BladeSystemTools, обновления — window.BladeUpdater. Значения id
    // ('bobliks-settings-button' / 'bobliks-settings-popup') не менялись —
    // userChrome.css, Pulse (node-menub) и BladeUpdater работают как прежде.
    // ═══════════════════════════════════════════════════════════════════

    // Синхронизация Blade Reader и выделения при старте (THEMES уже объявлен)
    // Авто-тема день/ночь вынесена в BladeAutoTheme.uc.js v1.0.0 (@loadOrder 12)
    // — внешний клиент API: читает data-blade-theme, переключает setTheme()
    // ═══════════════════════════════════════════════════════════════════

    // СЕКЦИЯ: INIT — стартовая последовательность (ПОРЯДОК ВАЖЕН, риск 7)
    // boot()->плитки->docObs(PiP-неон)->downloads-кнопка->shazam. Каждый блок — try с mark-диагностикой.
    // Шаг 8: виджет «B» и keyset вынесены в BladeMenuButton.uc.js v1.0.0
    // (@loadOrder 12, самомонтёж) — INIT про них больше не знает; панель —
    // BladeMenuPopup.uc.js v1.0.0 (@loadOrder 11).
    // Очистка — BladeHousekeeping.uc.js; эффекты окна (лазер/ghost/splash/idle) — BladeWindowFx.uc.js (оба @loadOrder 12, свои mark-файлы)
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
      tileLog('=== START ' + new Date().toISOString() + ' ===');
      try {
        // v2.0.9 NEWULTRAMAX: версионный сид. v2.0.8 ставила bool blade.tiles.seeded
        // и навсегда блокировала пересев — апдейт не менял плитки у живых юзеров
        // (10 старых сидов так и висели). Теперь: seedVersion < SEED_VERSION →
        // пересев. Старый bool-преф при апдейте отсутствует → дефолт 0 < 3 →
        // пересевётся один раз, поставит 3 и успокоится.
        const SEED_VERSION = 5;
        if (Services.prefs.getBoolPref('blade.tiles.customized', false)) return;
        if (Services.prefs.getIntPref('blade.tiles.seedVersion', 0) >= SEED_VERSION) return;
        // toolkit-модуль: resource://gre/, НЕ resource:/// (browser omni его не содержит)
        const { NewTabUtils } = ChromeUtils.importESModule('resource://gre/modules/NewTabUtils.sys.mjs');
        // ОЧИСТКА: снимаем ВСЕ старые закрепления перед пересевом. pin(link, i)
        // перебивает запись по индексу i только если unpin найдёт совпадение по
        // URL — битая запись (чужой url + чужой label) и дубликаты переживут
        // обычный пересев и будут торчать в сетке. Снимаем всё подчистую.
        try {
          const pl = NewTabUtils.pinnedLinks;
          const old = Array.from(pl.links);
          tileLog('CLEAR old=' + old.length);
          for (const l of old) { if (l) pl.unpin(l); }
          pl.resetCache();
          tileLog('CLEAR after=' + Array.from(pl.links).filter(Boolean).length);
        } catch (e) { tileLog('ERR clear ' + e + ' | ' + (e.stack || '').slice(0, 150)); }
        // NEWULTRAMAX PLITKI V.2.0 (WHITE): дефолтный набор 8 плиток для темы
        // Minimal Grey. Порядок = слово владельца: 1 ютуб, 2 ют-музыка, 3 инста,
        // 4 олх, 5 пин, 6 розетка, 7 фильмы (AnimeOn), 8 гмайл. Остальные 5
        // (спотик/саунд/эпл-музыка/киного/телега) уже лежат как обложки в
        // img/themes/<домен> и красятся covers.css — в сетку ставятся вручную.
        const SITES = [
          { url: 'https://youtube.com',         title: 'YouTube' },
          { url: 'https://music.youtube.com',   title: 'YouTube Music' },
          { url: 'https://instagram.com',       title: 'Instagram' },
          { url: 'https://www.olx.ua',          title: 'OLX' },
          { url: 'https://pinterest.com',       title: 'Pinterest' },
          { url: 'https://rozetka.com.ua',      title: 'Rozetka' },
          { url: 'https://animeon.cc/',         title: 'AnimeOn' },
          { url: 'https://mail.google.com',     title: 'Gmail' }
        ];
        for (let i = 0; i < SITES.length; i++) {
          try {
            NewTabUtils.pinnedLinks.pin({ url: SITES[i].url, title: SITES[i].title, baseDomain: SITES[i].url.replace('https://','').split('/')[0] }, i);
            tileLog('PIN ' + i + ': ' + SITES[i].url);
          } catch (e) { tileLog('ERR pin ' + SITES[i].url + ' ' + e); }
        }
        Services.prefs.setIntPref('blade.tiles.seedVersion', SEED_VERSION);
        Services.prefs.setBoolPref('blade.tiles.seeded', true);
        tileLog('SEEDED OK v' + SEED_VERSION);
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

    // Виджет «B» и его монтирование — BladeMenuButton.uc.js v1.0.0
    // (@loadOrder 12, самомонтёж: browser-delayed-startup-finished + таймер
    // 2.5с + дедуп). Хоткеи (Shift+F2/F3, Alt+B, F1) — там же

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
            if (!DP) return;
            // Анти-клин кнопки загрузок (репорт владельца 2026-09-15: после
            // завершения загрузки кнопка перестаёт открывать панель).
            // Причина: XUL-панель закрывается «тихо» — без события popuphidden
            // (фокус-буря вокруг авто-open'а загрузки, PanelMultiView.sys.mjs).
            // Тогда PanelMultiView остаётся с открытыми view (openViews) при
            // panel.state=='closed' — и каждый последующий openPopup видит
            // «панель уже показана» (L728), выпускает искусственный popuphidden
            // и возвращает false (промис резолвится, ошибки нет!). Состояние
            // НЕ самолечится — кнопка мертва до перезапуска окна.
            // Лекарство: слить застрявшие view штатным PanelMultiView.hidePopup
            // — он гонит closeAllViews() даже на закрытой панели.
            // DownloadsPanel.hidePanel не подходит: его гвард !isPanelShowing
            // режет вызов до PanelMultiView (isPanelShowing ведь false).
            const panel = window.document.getElementById('downloadsPanel');
            try {
              if (panel && panel.state === 'closed' && window.PanelMultiView) {
                const mv = panel.querySelector('panelmultiview');
                const inst = mv && window.PanelMultiView.forNode(mv);
                if (inst && inst.openViews && inst.openViews.length) {
                  window.PanelMultiView.hidePopup(panel);
                  mark('OK dl desync recovered');
                }
              }
            } catch (dsErr) {
              // диагностика не должна глушить основной показ панели
              mark('ERR dlDesync ' + dsErr);
            }
            // isPanelShowing — геттер downloads.js:235 (включая состояние
            // закрытия); showPanel(openedManually) — открывает и грузит данные
            if (!DP.isPanelShowing) {
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
    // Хоткеи (Shift+F2/F3 — цикл тем, Alt+B/F1 — меню B) — вынесены в
    // BladeMenuButton.uc.js v1.0.0 (@loadOrder 12). Монолит про клавиши
    // больше не знает


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
      bgs: () => window.BladeEngine.getAllBgs().map(b => ({ id: b.id, label: b.label, group: b.group || '' })),
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
    mark('OK init');
  } catch (e) {
    mark('ERR fatal', e);
    console.error('Bobliks fatal:', e);
  }
})();
