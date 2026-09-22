// ==UserScript==
// @name            Blade Housekeeping
// @description     Хозяйственный cleanup и «Чистый лист»: стиль About-диалога, сброс verticalTabs, очистка мусорных вкладок, вырезание порталов Mozilla из меню, удаление дефолтных закладок
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       12
// ==/UserScript==
(function () {
  if (window.BladeHousekeeping) return;
  window.BladeHousekeeping = true;

  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\BladeHousekeeping_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.0.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  mark('START');

  try {
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

    // Вертикальные вкладки ОТКЛОНЕНЫ (решение владельца: непрактично).
    // Страховка: если преф каким-то образом включён (нативный тумблер в
    // контекстном меню тулбара) — табстрип уезжает в сайдбар, который наш
    // CSS глухо прячет, и вкладки исчезают совсем. Гасим преф на старте.
    try {
      if (Services.prefs.getBoolPref('sidebar.verticalTabs', false)) {
        Services.prefs.setBoolPref('sidebar.verticalTabs', false);
        mark('vtabs off (отклонён)');
      }
    } catch (e) {}

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
  } catch (e) {
    mark('ERR fatal', e);
  }
})();
