// ==UserScript==
// @name            Blade Context Menu
// @description     Киберпанк-контекстное меню Blade: автоматические SVG-иконки
//                  для действий (страница, картинка, ссылка, выделение).
//                  Подчёркивания акселераторов убираются префой ui.key.chromeAccess
//                  в user.js (один канал, без мутации атрибутов DOM).
// @author          Blade-Creations
// @include         main
// @version         1.0.1
// ==/UserScript==
(function () {
  if (window.BladeContextMenu) return;
  window.BladeContextMenu = true;

  // mark по конвенции 2: chrome\JS\BladeContextMenu_mark.txt, первая строка v<версия>
  const mark = (m, e) => {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('BladeContextMenu_mark.txt');
      IOUtils.writeUTF8(d.path, 'v1.0.1 ' + m + (e ? ' ' + e : '')).catch(() => {});
    } catch (e2) {}
  };

  try {
    // Реестр векторных иконок. Назначаем каноническим путём движка — переменной
    // --menuitem-icon на самом пункте (так же делает contextmenu.css омни:
    // #context-back { --menuitem-icon: url(...) }). Атрибут image НЕ используем:
    // движок прокидывает его в .menu-icon как srcset, что ломает content-путь.
    const ICON_MAP = {
      // Изображения (клик по картинке)
      "context-viewimage": "chrome://global/skin/icons/open-in-new.svg",
      "context-copyimage-contents": "chrome://global/skin/icons/edit-copy.svg",
      "context-copyimage": "chrome://global/skin/icons/link.svg",
      "context-saveimage": "chrome://browser/skin/save.svg",
      "context-sendimage": "chrome://browser/skin/sync.svg",
      "context-setDesktopBackground": "chrome://global/skin/icons/page-landscape.svg",
      "context-viewimageinfo": "chrome://global/skin/icons/info.svg",

      // Страница (клик по пустому месту страницы)
      "context-savepage": "chrome://browser/skin/save.svg",
      "context-selectall": "chrome://global/skin/icons/edit-outline.svg",
      "context-take-screenshot": "chrome://browser/skin/screenshot.svg",
      "context-translate-selection": "chrome://browser/skin/translations.svg",
      "context-viewsource": "chrome://global/skin/icons/developer.svg",
      "context-inspect": "resource://devtools-shared-images/command-pick.svg",
      "context-sendpagetodevice": "chrome://browser/skin/sync.svg",

      // Ссылки
      "context-openlinkintab": "chrome://global/skin/icons/plus.svg",
      "context-openlink": "chrome://global/skin/icons/open-in-new.svg",
      "context-openlinkprivate": "chrome://global/skin/icons/indicator-private-browsing.svg",
      "context-copylink": "chrome://global/skin/icons/link.svg",
      "context-stripOnShareLink": "chrome://global/skin/icons/security.svg",
      "context-bookmarklink": "chrome://browser/skin/bookmark-hollow.svg",
      "context-savelink": "chrome://browser/skin/save.svg",
      "context-copyemail": "chrome://global/skin/icons/edit-copy.svg",

      // Текст и выделение
      "context-copy": "chrome://global/skin/icons/edit-copy.svg",
      "context-cut": "chrome://browser/skin/edit-cut.svg",
      "context-paste": "chrome://browser/skin/edit-paste.svg",
      "context-undo": "chrome://global/skin/icons/undo.svg",
      "context-redo": "chrome://global/skin/icons/undo.svg",
      "context-searchselect": "chrome://global/skin/icons/search-glass.svg",
      "context-print-selection": "chrome://global/skin/icons/print.svg",
    };

    const enhanceContextMenu = (cm) => {
      if (!cm || cm._bladeEnhanced) return;
      cm._bladeEnhanced = true;

      cm.addEventListener("popupshowing", (e) => {
        if (e.target !== cm) return;

        let n = 0;
        try {
          const items = cm.querySelectorAll("menuitem, menu");
          for (const item of items) {
            const iconUrl = ICON_MAP[item.id];
            if (iconUrl) {
              // Класс .menuitem-iconic — условие отрисовки .menu-icon (иначе он
              // остаётся display:none по global/menu.css), переменная — источник.
              item.classList.add("menuitem-iconic");
              item.style.setProperty("--menuitem-icon", `url("${iconUrl}")`);
              n++;
            }
          }
        } catch (e2) { mark('ERR enhance', e2); }
        if (n) mark('OK icons=' + n);
      }, true);
    };

    const cm = window.document.getElementById("contentAreaContextMenu");
    if (cm) {
      enhanceContextMenu(cm);
      mark('OK enhanced');
    } else {
      window.addEventListener("DOMContentLoaded", () => {
        try {
          const delayedCm = window.document.getElementById("contentAreaContextMenu");
          if (delayedCm) { enhanceContextMenu(delayedCm); mark('OK delayed'); }
          else mark('NO_MENU');
        } catch (e) { mark('ERR delayed', e); }
      }, { once: true });
    }
  } catch (e) { mark('ERR fatal', e); }
})();
