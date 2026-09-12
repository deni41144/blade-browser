// ==UserScript==
// @name            Bobliks About Style
// @description     Тёмный Blade-стиль для привилегированных about:страниц
//                  (preferences/addons/support/profiles/downloads/config).
//                  Эти страницы — chrome-документы: их не видит ни userContent.css,
//                  ни userChrome.css, поэтому стиль внедряется <style> в каждый
//                  документ через document-element-inserted (проверенный приём).
// @author          Bobliks-Creations
// @include         main
// @version         1.0.1
// ==/UserScript==
(function () {
  const STYLE_ID = 'bobliks-about-style';

  // Общая тёмная база для всех внутренних страниц
  const BASE = `
    :root {
      --in-content-page-background: #0a0a0c !important;
      --in-content-page-color: #e8e8e8 !important;
      --in-content-box-background: #14141a !important;
      --in-content-box-background-odd: #1a1a22 !important;
      --in-content-border-color: #2a2a34 !important;
      --in-content-primary-button-background: var(--bob-accent, #ff2a2a) !important;
      --in-content-primary-button-text-color: #fff !important;
      --in-content-accent-color: var(--bob-accent, #ff2a2a) !important;
      --in-content-link-color: var(--bob-accent, #ff2a2a) !important;
      --in-content-category-text: #b8b8c0 !important;
    }
    /* Новая дизайн-система FF155 (moz-button / moz-input, Lit-токены):
       старые --in-content-* переменные её не красят — без этого кнопки
       и фокус горят дефолтным бирюзовым (скриншот-аудит Gemini раунд 3) */
    :root {
      --button-primary-background: var(--bob-accent, #ff2a2a) !important;
      --button-primary-background-hover: color-mix(in srgb, var(--bob-accent, #ff2a2a) 80%, white) !important;
      --button-primary-background-active: color-mix(in srgb, var(--bob-accent, #ff2a2a) 90%, black) !important;
      --button-primary-color: #ffffff !important;
      --color-accent-primary: var(--bob-accent, #ff2a2a) !important;
      --color-accent-primary-hover: color-mix(in srgb, var(--bob-accent, #ff2a2a) 80%, white) !important;
      --color-accent-primary-active: color-mix(in srgb, var(--bob-accent, #ff2a2a) 90%, black) !important;
      --focus-outline-color: var(--bob-accent, #ff2a2a) !important;
      --accent-color: var(--bob-accent, #ff2a2a) !important;
    }
    body { background: #0a0a0c !important; color: #e8e8e8 !important; }
    input, select, button, menulist {
      background: #1a1a22 !important;
      color: #e8e8e8 !important;
      border: 1px solid #2a2a34 !important;
      border-radius: 6px !important;
    }
    th, td { background: #14141a !important; border-color: #2a2a34 !important; }
    /* Плашка «browser is being managed by your organization»: наши policies.json
       (приватность/первый запуск) движок считает корпоративным управлением */
    #policies-container,
    #policies-container-content,
    [data-l10n-id="policies-container"],
    .managed-notice {
      display: none !important;
    }
  `;

  // Дополнения под конкретные страницы
  const PAGES = {
    'about:preferences': `
      #categories { background: #0d0d11 !important; }
      #categories button[selected="true"] { color: var(--bob-accent, #ff2a2a) !important; }
      #categories button:hover { background: #1a1a22 !important; }
      groupbox, .groupbox, .settings-card, .card {
        background: #14141a !important;
        border: 1px solid #2a2a34 !important;
        border-radius: 8px !important;
      }
      /* Панели Firefox, которых у Blade нет: Sync (Mozilla-аккаунт), реклама
         Mozilla, промо «сделай дефолтным» с лисой, сломанный Labs-ключ */
      #category-sync, #category-more-from-mozilla,
      #category-labs, #category-experimental,
      [data-category="paneLabs"], [data-category="paneSync"],
      #isNotDefaultPane,
      #noFxaAccountGroup, #fxaGroup,
      #syncConfigured, #syncNotConfigured, #syncNoFxaSignIn {
        display: none !important;
      }
      /* Лисицы (раунд 5): промо-карточка в AI controls + круглая иконка
         лисы в сайдбаре (About-панель — её заменяет «О Blade» в B-меню) */
      #aiControlsDescription,
      .ai-controls-description,
      #category-about-firefox,
      [data-category="paneAbout"],
      [view="paneAbout"] {
        display: none !important;
      }
      /* Глобальный лисоубийца: все иллюстрации лисы Mozilla на about-страницах
         (fox-ai, kit-иллюстрации, логотип firefox.svg) */
      img[src*="fox-ai.svg"],
      img[src*="kit-"],
      img[src*="/firefox.svg"],
      img[src*="/firefox-horizon.svg"] {
        display: none !important;
      }
    `,
    'about:addons': `
      #sidebar { background: #0d0d11 !important; }
      .addon-card, .card {
        background: #14141a !important;
        border: 1px solid #2a2a34 !important;
        border-radius: 8px !important;
      }
      /* Витрина Discover (mozilla.org) — вырезана */
      #category-discover { display: none !important; }
    `,
    'about:support': `
      /* Имя приложения: Firefox -> Blade */
      #application-box { font-size: 0 !important; }
      #application-box::after {
        content: "Blade";
        font-size: 13px;
        color: var(--bob-accent, #ff2a2a) !important;
      }
      /* Служебное Mozilla: ключ геолокации, эксперименты Nimbus, исследования, краши */
      #key-mozilla-row, #key-mozilla-box,
      #remote-experiments, #about-studies-section,
      #crashes { display: none !important; }
    `,
    'about:profiles': `
      /* Создание лишних профилей = путь к «дефолтному Firefox» — закрыт */
      #create-button { display: none !important; }
    `,
    'about:downloads': `
      .downloadTarget { color: #e8e8e8 !important; }
      .downloadDetails { color: #8a8f98 !important; }
    `,
    'about:config': `
      tr { color: #e8e8e8 !important; }
      tr:hover { background: #1a1a22 !important; }
      #warningTitle { color: var(--bob-accent, #ff2a2a) !important; }
    `
  };

  // Пасхалки Mozilla — выкупорены наглухо
  const EASTER = [ 'about:robots', 'about:mozilla' ];
  const EASTER_CSS = `* { display: none !important; } html, body { background: #0a0a0c !important; }`;

  function inject(doc, css) {
    try {
      if (!doc || !doc.documentElement || doc.getElementById(STYLE_ID)) return;
      const st = doc.createElement('style');
      st.id = STYLE_ID;
      st.textContent = css;
      doc.documentElement.appendChild(st);
    } catch (e) {}
  }

  function styleDoc(doc) {
    try {
      if (!doc) return;
      const url = doc.documentURI || '';
      if (EASTER.includes(url)) {
        inject(doc, EASTER_CSS);
        return;
      }
      for (const prefix of Object.keys(PAGES)) {
        if (url.startsWith(prefix)) {
          inject(doc, BASE + PAGES[prefix]);
          return;
        }
      }
    } catch (e) {}
  }

  function onDocInserted(doc) { styleDoc(doc); }

  try {
    // Уже открытые вкладки (восстановленная сессия)
    for (const b of window.gBrowser.browsers) {
      try { if (b.contentDocument) styleDoc(b.contentDocument); } catch (e) {}
    }
    // Все новые документы
    Services.obs.addObserver(onDocInserted, 'document-element-inserted');
    // Снятие на unload: observer висел вечно и держал мёртвые window (утечка P1)
    window.addEventListener('unload', () => {
      try { Services.obs.removeObserver(onDocInserted, 'document-element-inserted'); } catch (e) {}
    });
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS'); d.append('about_style_mark.txt');
      IOUtils.writeUTF8(d.path, 'v1.0.1 OK').catch(() => {});
  } catch (e) {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('about_style_mark.txt');
      IOUtils.writeUTF8(d.path, 'v1.0.1 ERR ' + e).catch(() => {});
    } catch (e2) {}
  }
})();
