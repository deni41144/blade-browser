// ==UserScript==
// @name            BladeTranslate
// @description     Перевод страницы из контекстного меню (как в Chrome):
//                  ПКМ на странице → «Перевести страницу» → штатная панель
//                  полного перевода Firefox (window.FullPageTranslationsPanel,
//                  тот же вызов, что у cmd_translate). Показывается только
//                  на http/https/file — на внутренних страницах (about:*,
//                  chrome://) панель не работает, пункт скрыт. Fail-soft:
//                  любая ошибка — тихий выход (см. mark). Без хоткеев и
//                  настроек.
// @author          Bobliks-Creations
// @include         main
// @version         1.0.0
// @loadOrder       10
// ==/UserScript==
(function () {
  if (window.BladeTranslate) return;
  window.BladeTranslate = true;

  const mark = (m, e) => {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('BladeTranslate_mark.txt');
      IOUtils.writeUTF8(d.path, 'v1.0.0 ' + m + (e ? ' ' + e : '')).catch(() => {});
    } catch (e2) {}
  };

  // Гварды панели (already-translated / unsupported lang) могут кидать —
  // try/catch обязателен; объект мог ещё не загрузиться — тихий выход
  const openPanel = (ev) => {
    try {
      if (typeof window.FullPageTranslationsPanel?.open !== 'function') {
        mark('NO_PANEL');
        return;
      }
      const p = window.FullPageTranslationsPanel.open(ev);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { mark('ERR open ' + e); }
  };

  // Панель полного перевода не работает на внутренних страницах:
  // показываем пункт только для http/https/file активной вкладки
  const isTranslatable = () => {
    try {
      const s = window.gBrowser?.selectedBrowser?.currentURI?.scheme;
      return s === 'http' || s === 'https' || s === 'file';
    } catch (e) { return false; }
  };

  try {
    const menu = window.document.getElementById('contentAreaContextMenu');
    if (!menu) { mark('ERR no menu'); return; }

    const doc = menu.ownerDocument;
    const item = doc.createXULElement('menuitem');
    item.id = 'context-blade-translate-page';
    item.setAttribute('label', 'Перевести страницу');
    item.hidden = true; // до первого popupshowing не показываем
    item.addEventListener('command', openPanel);

    // Свой сепаратор нужен только если оба якоря не нашлись (пункт в конец)
    let sep = null;

    // Якорь: сразу после штатного «Перевести выделенное»; если его нет —
    // после context-sep-open; иначе appendChild в конец с сепаратором
    const anchor =
      menu.querySelector('#context-translate-selection') ||
      menu.querySelector('#context-sep-open');
    if (anchor) {
      anchor.parentNode.insertBefore(item, anchor.nextSibling);
    } else {
      sep = doc.createXULElement('menuseparator');
      sep.hidden = true;
      menu.appendChild(sep);
      menu.appendChild(item);
    }

    // Видимость пересчитываем на каждом открытии меню; проверка ev.target
    // отсекает всплывшие popupshowing от подменю
    menu.addEventListener('popupshowing', (ev) => {
      if (ev.target !== menu) return;
      try {
        const show = isTranslatable();
        item.hidden = !show;
        if (sep) sep.hidden = !show;
      } catch (e) {}
    });

    mark('OK menu');
  } catch (e) { mark('ERR start ' + e); }
})();
