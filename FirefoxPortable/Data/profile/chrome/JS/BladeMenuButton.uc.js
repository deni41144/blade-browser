// ==UserScript==
// @name            Blade Menu Button
// @description     Кнопка «B» в nav-bar (прямая DOM-вставка) + хоткеи
//                  (Shift+F2/F3 — цикл тем, Alt+B и F1 — меню). Шаг 8
//                  декомпозиции BobliksSettings
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       12
// ==/UserScript==
// Вынесен из BobliksSettings.uc.js (шаг 8 декомпозиции, 2026-09-22): узел
// кнопки, монтирование (browser-delayed-startup-finished + таймер-страховка
// 2.5с + дедуп) и keyset. САМОМОНТИРУЕТСЯ при загрузке — монолиту больше не
// нужно ничего вызывать. Сама панель — BladeMenuPopup.uc.js (@loadOrder 11),
// открывается по клику/хоткею через window.BladeMenuPopup.open(btn).
// Инцидент «пропала кнопка Б» (v1.14.4-1.14.5): CustomizableUI в FF155 не
// строит узел позднерегистрируемого custom-виджета — только прямая DOM-вставка
// (как BladeClock). CUI модулю не нужен.
(function () {
    if (window.BladeMenuButton) return;
    window.BladeMenuButton = true;

    let markPath = '';
    try {
        const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
        d.append('JS');
        markPath = d.path + '\\BladeMenuButton_mark.txt';
    } catch (e) {}
    const mark = (m, e) => {
        try {
            if (!markPath) return;
            const text = 'v1.0.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
            IOUtils.writeUTF8(markPath, text).catch(() => {});
        } catch (e2) {}
    };

    const WIDGET_ID = 'bobliks-settings-button';
    const THEMES = window.Blade.themes;

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
    const hookPopupState = (doc) => {
      try {
        if (!doc) return;
        const popup = doc.getElementById('bobliks-settings-popup');
        if (!popup || popup._bladeButtonBound) return;
        popup._bladeButtonBound = true;
        const setOpenState = (isOpen) => {
          try {
            const b = doc.getElementById(WIDGET_ID);
            if (!b) return;
            if (isOpen) {
              b.setAttribute('open', 'true');
              b.setAttribute('aria-expanded', 'true');
            } else {
              b.removeAttribute('open');
              b.setAttribute('aria-expanded', 'false');
            }
          } catch (e) {}
        };
        popup.addEventListener('popupshown', () => setOpenState(true));
        popup.addEventListener('popuphiding', () => setOpenState(false));
        popup.addEventListener('popuphidden', () => setOpenState(false));
      } catch (e) {}
    };

    const openMenu = (targetBtn) => {
      try {
        const doc = (targetBtn && targetBtn.ownerDocument) || window.document;
        const btn = targetBtn || doc.getElementById(WIDGET_ID);
        if (btn) {
          btn.setAttribute('open', 'true');
          btn.setAttribute('aria-expanded', 'true');
        }
        if (window.BladeMenuPopup && typeof window.BladeMenuPopup.open === 'function') {
          window.BladeMenuPopup.open(btn);
          hookPopupState(doc);
        }
      } catch (e) { mark('ERR open ' + e); }
    };

    const buildMenuButton = (doc) => {
      const btn = doc.createXULElement('toolbarbutton');
      btn.id = WIDGET_ID;
      btn.className = 'toolbarbutton-1 chromeclass-toolbar-additional';
      btn.setAttribute('label', 'Blade');
      btn.setAttribute('tooltiptext', 'Настройки Blade (тема, фон, плитки)');
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      const icon = doc.createXULElement('image');
      icon.className = 'toolbarbutton-icon';
      btn.appendChild(icon);
      btn.addEventListener('command', () => {
        openMenu(btn);
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
        hookPopupState(doc);
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
            openMenu(btn);
          } catch (e) { mark('ERR menuKey ' + e); }
        };
        mkKey('blade-key-menu', 'B', 'alt', openBladeMenu);
        mkKey('blade-key-menu-f1', 'VK_F1', null, openBladeMenu);
        mark('OK keys');
      } else {
        mark('ERR no mainKeyset');
      }
    } catch (e) { mark('ERR keys', e); }
    // ═══════════════════════════════════════════════════════════════════
    // API — window.BladeMenuButton. mount вызывается ниже автоматически;
    // экспонирована для ручного ретрая встраиваниями
    // ═══════════════════════════════════════════════════════════════════
    window.BladeMenuButton = { mount: mountMenuButton };

    // САМОМОНТ: наблюдатель browser-delayed-startup-finished, снимающийся
    // на unload, и таймер-страховка 2.5с зарегистрированы выше — перенесены
    // из INIT монолита без изменений. Немедленный tryMount() НЕ вызываем
    // намеренно: ранний mount попадал под buildArea CustomizableUI — узел
    // стэшился, ретрай вставлял второго, стэш возвращался = ДВЕ кнопки
    // (инцидент 1.14.5). Только delayed-startup (nav-bar финален) либо таймер.
    mark('LOADED');
})();
