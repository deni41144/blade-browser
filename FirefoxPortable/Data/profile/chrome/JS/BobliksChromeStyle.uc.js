// ==UserScript==
// @name            Bobliks Chrome Style
// @description     Стили HTML-элементов интерфейса (urlbar-панель, выделение).
//                  В FF155 userChrome.css не достаёт HTML-элементов движка
//                  (urlbarView и пр.), поэтому стили внедряются <style> в документ.
//                  Используют переменные тем — переключение живое.
// @author          Bobliks-Creations
// @include         main
// @version         1.2.1
// ==/UserScript==
(function () {
  /* Селекторы выделения (мёртвый #urlbar-scheme удалён в v1.2) */
  const SEL_LIST = [
    '::selection', 'input::selection', 'textarea::selection',
    '#urlbar-input::selection', '.urlbar-input::selection',
  ];
  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

  /* Генерация ::selection-блоков из единого реестра window.Blade.themes
     (BladeCore.uc.js, @loadOrder 5 — исполняется раньше обычных скриптов).
     longhand + литеральные цвета обязательны (bug 1343967: var() и
     shorthand ломают покраску ::selection). Базовый блок GX Red — статикой
     первым, без media/атрибута. Тема custom пропускается: её акцент
     динамический (конструктор цвета в BobliksSettings), статичный блок
     запер бы выделение на #ff2a2a — в прежнем захардкоженном CSS блока
     custom тоже не было. Поля цвета валидируются (граница данных реестра). */
  function buildSelectionCSS(themes) {
    const sel = SEL_LIST.join(', ');
    let css = '    ' + sel + ' {\n' +
      '      background-color: #ff2a2a !important;\n' +
      '      color: #ffffff !important;\n' +
      '    }';
    if (!themes) return css;
    for (const t of themes) {
      if (!t || typeof t.id !== 'string' || t.id === 'custom') continue;
      if (!HEX_COLOR.test(t.accent) || !HEX_COLOR.test(t.selFg)) continue;
      if (typeof t.pref === 'string' && t.pref) {
        css += '\n    @media -moz-pref("' + t.pref + '") {\n' +
          '      ' + sel + ' {\n' +
          '        background-color: ' + t.accent + ' !important; color: ' + t.selFg + ' !important;\n' +
          '      }\n' +
          '    }';
      }
      const attr = '[data-blade-theme="' + t.id + '"]';
      const attrSel = SEL_LIST.map((s) => attr + ' ' + s).join(',\n    ');
      css += '\n    ' + attrSel + ' {\n' +
        '      background-color: ' + t.accent + ' !important; color: ' + t.selFg + ' !important;\n' +
        '    }';
    }
    return css;
  }

  let themes = null;
  try {
    if (window.Blade && Array.isArray(window.Blade.themes)) themes = window.Blade.themes;
  } catch (e) {}
  const selCss = buildSelectionCSS(themes);

  /* Порт SIGNATURE из userChrome (id был мёртв с FF155): «обнажение клинка» —
     при фокусе адресной строки снизу капсулы выдвигается акцентная линия
     (scaleX от центра). v1.2.1 — сверка с omni.ja (urlbar-searchbar.css,
     UrlbarInput.mjs): (1) движок сам позиционирует .urlbar-background
     (position:absolute + inset:0), а наш position:relative !important
     схлопывал капсулу до нулевых размеров — линия внутри неё не могла
     появиться; (2) атрибут focused движок ставит
     (UrlbarInput.mjs: toggleAttribute("focused", ...)), селекторы фокуса
     живые. Линия перенесена на .urlbar::after: псевдоэлемент #urlbar
     движком не занят, сам .urlbar position:relative (якорь) и без
     overflow:hidden (overflow:initial) — линия выходит под капсулу,
     bottom:-2px. */
  const sigCss = `
    .urlbar::after {
      content: "" !important;
      position: absolute !important;
      left: 10% !important;
      right: 10% !important;
      bottom: -2px !important;
      height: 2px !important;
      border-radius: 2px !important;
      background: var(--accent, #ff2a2a) !important;
      transform: scaleX(0) !important;
      transform-origin: center !important;
      pointer-events: none !important;
      /* сворачивание при потере фокуса — тем же темпом, что и появление */
      transition: transform 280ms cubic-bezier(.2, .7, .3, 1) !important;
    }
    #urlbar[focused]::after,
    .urlbar[focused]::after {
      animation: blade-urlbar-reveal 280ms cubic-bezier(.2, .7, .3, 1) 1 forwards !important;
    }
    @keyframes blade-urlbar-reveal {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }`;

  const CSS = `
    /* Капсула адресной строки (в 155-й у неё класс, без id).
       Позиционирование движка (position:absolute + inset:0 в
       urlbar-searchbar.css) не трогаем: position:relative схлопывал
       капсулу; якорь линии «обнажения клинка» — сам .urlbar::after. */
    .urlbar-background {
      background-color: var(--panel, #14141a) !important;
      border: 1px solid var(--accent-soft, rgba(255, 42, 42, 0.35)) !important;
      border-radius: 8px !important;
    }
    #urlbar[focused] .urlbar-background,
    .urlbar[focused] .urlbar-background {
      border-color: var(--accent, #ff2a2a) !important;
      box-shadow: 0 0 12px color-mix(in srgb, var(--accent, #ff2a2a) 45%, transparent) !important;
    }
${sigCss}
    /* Панель подсказок (urlbarView) */
    .urlbarView {
      background: var(--panel, #14141a) !important;
      color: var(--text, #e8e8e8) !important;
      border: 1px solid color-mix(in srgb, var(--accent, #ff2a2a) 45%, transparent) !important;
      border-radius: 8px !important;
    }
    .urlbarView-row,
    .urlbarView-row-inner,
    .urlbarView-body-outer,
    .urlbarView-body-inner,
    .urlbarView-results {
      background: transparent !important;
    }
    .urlbarView-row { border-radius: 6px !important; }
    .urlbarView-row:hover,
    .urlbarView-row[selected] {
      background: color-mix(in srgb, var(--accent, #ff2a2a) 24%, transparent) !important;
    }
    .urlbarView-title,
    .urlbarView-row-title { color: var(--text, #e8e8e8) !important; }
    .urlbarView-url,
    .urlbarView-row-url { color: color-mix(in srgb, var(--accent, #ff2a2a) 60%, #9a9a9a) !important; }
    .urlbarView-action,
    .urlbarView-tag { color: var(--accent, #ff2a2a) !important; }
    /* Часы+погода Blade в тулбаре */
    #blade-clock-widget {
      appearance: none !important;
      background: transparent !important;
      border: none !important;
      padding: 0 6px !important;
    }
    #blade-clock-widget .blade-clock-text {
      color: var(--accent, #ff2a2a) !important;
      font-weight: 700 !important;
      font-size: 13px !important;
      letter-spacing: 0.5px !important;
      text-shadow: 0 0 10px color-mix(in srgb, var(--accent, #ff2a2a) 40%, transparent) !important;
      font-variant-numeric: tabular-nums !important;
    }
    #blade-clock-widget:hover .blade-clock-text {
      filter: brightness(1.25) !important;
    }

    /* Поиск — только Google: прячем ряд выбора поисковиков */
    .search-one-offs { display: none !important; }
    /* Выделение: генерация из window.Blade.themes (buildSelectionCSS) —
       longhand + литеральные цвета (bug 1343967: var() и shorthand
       ломают покраску ::selection) */
${selCss}
  `;

  try {
    const doc = window.document;
    if (doc.getElementById('bobliks-chrome-style')) return;
    const st = doc.createElement('style');
    st.id = 'bobliks-chrome-style';
    st.textContent = CSS;
    doc.documentElement.appendChild(st);
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS'); d.append('chrome_style_mark.txt');
    // нет window.Blade (BladeCore не исполнился) — не падаем: инъекция пошла
    // с одним базовым ::selection-блоком, след фиксируем в mark
    IOUtils.writeUTF8(d.path, 'v1.2.1 OK injected' + (themes ? '' : ' ERR no BladeCore')).catch(() => {});
  } catch (e) {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('chrome_style_mark.txt');
      IOUtils.writeUTF8(d.path, 'v1.2.1 ERR ' + e).catch(() => {});
    } catch (e2) {}
  }
})();
