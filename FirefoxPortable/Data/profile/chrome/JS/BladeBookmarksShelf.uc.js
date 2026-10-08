// ==UserScript==
// @name            Blade Bookmarks Shelf
// @description     Компактная полка избранного, родные закладки и действия
// @include         main
// @version         1.0.0
// @loadOrder       122
// ==/UserScript==
(function () {
  if (window.BladeBookmarksShelf) return;
  const root = document.documentElement;
  const toolbar = document.getElementById('PersonalToolbar');
  const nativeEmpty = document.getElementById('personal-toolbar-empty');
  const items = document.getElementById('PlacesToolbarItems');
  if (!toolbar || !nativeEmpty || !items) return;
  const { PlacesUtils } = ChromeUtils.importESModule('resource://gre/modules/PlacesUtils.sys.mjs');
  const css = `
    :root[data-blade-bookmarks-shelf] #personal-toolbar-empty,
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf[hidden],
    :root[data-blade-bookmarks-shelf][customizing] #blade-bookmarks-shelf,
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf [hidden] {display:none!important}
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf,
    :root[data-blade-bookmarks-shelf] #blade-shelf-empty-actions,
    :root[data-blade-bookmarks-shelf] .blade-shelf-label {display:flex;align-items:center;gap:7px}
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf {flex-shrink:0;margin-inline-end:10px}
    /* Native hidden/newtab mode uses collapsed + max-height. Never impose a
       minimum height or separator on its collapsed state. */
    :root[data-blade-bookmarks-shelf] #PersonalToolbar:is([collapsed],[hidden]) {
      min-height:0!important;max-height:0!important;height:0!important;
      padding:0!important;border:0!important;margin-block:0!important;
    }
    @media(forced-colors:none) {
    :root[data-blade-bookmarks-shelf] #PersonalToolbar:not([collapsed]):not([hidden]) {
      --shelf-accent:var(--bob-accent,var(--accent,#ff2a2a));
      background-color:#121115!important;
      background-image:linear-gradient(180deg,#ffffff03,#00000015),var(--blade-material,linear-gradient(180deg,#21191c,#121114))!important;
      border:0!important;border-top:1px solid #ffffff06!important;border-bottom:1px solid #ffffff12!important;
      box-shadow:inset 0 1px #ffffff03,inset 0 -1px #00000055!important;
      padding:0 12px!important;min-height:32px!important;
    }
    :root[data-blade-bookmarks-shelf] #personal-toolbar-empty {display:none!important}
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf {
      display:flex!important;align-items:center!important;gap:9px!important;flex-shrink:0!important;
      height:32px!important;margin-inline-end:10px!important;
      font:11px var(--blade-ui,'Rubik','Segoe UI',sans-serif)!important;color:#c3bdc8!important;
    }
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf[hidden],
    :root[data-blade-bookmarks-shelf][customizing] #blade-bookmarks-shelf,
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf [hidden] {display:none!important}
    :root[data-blade-bookmarks-shelf] .blade-shelf-label {display:flex;align-items:center;gap:7px;white-space:nowrap}
    :root[data-blade-bookmarks-shelf] .blade-shelf-mark {
      width:11px;height:12px;display:inline-block;background:color-mix(in srgb,var(--shelf-accent) 65%,#ddd);
      clip-path:polygon(9% 0,91% 0,91% 100%,50% 72%,9% 100%);opacity:.85;
    }
    :root[data-blade-bookmarks-shelf] #blade-shelf-empty-actions {display:flex;align-items:center;gap:5px}
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf button {
      appearance:none!important;border:1px solid #ffffff12!important;border-radius:6px!important;
      padding:3px 9px!important;min-height:23px!important;line-height:15px!important;
      background:linear-gradient(180deg,#ffffff07,#ffffff01)!important;color:#d9d4df!important;
      font:inherit!important;white-space:nowrap!important;cursor:pointer;
      box-shadow:inset 0 1px #ffffff05!important;
    }
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf button:hover:not(:disabled) {
      border-color:color-mix(in srgb,var(--shelf-accent) 35%,#ffffff20)!important;
      background:color-mix(in srgb,var(--shelf-accent) 9%,#211f25)!important;
    }
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf button:disabled {opacity:.45!important;cursor:default}
    :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf button:focus-visible {
      outline:1px solid var(--shelf-accent)!important;outline-offset:1px!important;
    }
    :root[data-blade-bookmarks-shelf] #PersonalToolbar #PlacesToolbarItems > .bookmark-item {
      margin:3px 3px!important;padding:3px 8px!important;min-height:25px!important;max-width:190px!important;
      border:1px solid #ffffff0d!important;border-radius:6px!important;
      background:linear-gradient(180deg,#ffffff05,#ffffff01)!important;
      box-shadow:inset 0 1px #ffffff05!important;color:#d9d3de!important;
    }
    :root[data-blade-bookmarks-shelf] #PersonalToolbar #PlacesToolbarItems > .bookmark-item:hover,
    :root[data-blade-bookmarks-shelf] #PersonalToolbar #PlacesToolbarItems > .bookmark-item[open] {
      border-color:color-mix(in srgb,var(--shelf-accent) 35%,#ffffff20)!important;
      background:color-mix(in srgb,var(--shelf-accent) 9%,#211f25)!important;
    }
    :root[data-blade-bookmarks-shelf] #PersonalToolbar .bookmark-item > .toolbarbutton-icon {width:14px!important;height:14px!important;margin-inline-end:6px!important}
    :root[data-blade-bookmarks-shelf] #PersonalToolbar .bookmark-item > .toolbarbutton-text {font:11px var(--blade-ui,'Rubik','Segoe UI',sans-serif)!important}
    :root[data-blade-bookmarks-shelf] #PersonalToolbar #PlacesToolbarItems > toolbarseparator {opacity:.35!important;margin-inline:5px!important}
    :root[data-blade-bookmarks-shelf] #PersonalToolbar #PlacesChevron {border-radius:6px!important;margin-inline-start:3px!important}
    @media(max-width:650px) {
      :root[data-blade-bookmarks-shelf] #PersonalToolbar:not([collapsed]):not([hidden]) {padding-inline:6px!important}
      :root[data-blade-bookmarks-shelf] .blade-shelf-label {font-size:10px!important}
      :root[data-blade-bookmarks-shelf] #blade-bookmarks-shelf {gap:6px!important;margin-inline-end:4px!important}
    }
    }
  `;
  const ns = 'http://www.w3.org/1999/xhtml';
  const make = (tag, id, text) => {
    const node = document.createElementNS(ns, tag);
    if (id) node.id = id;
    if (text) node.textContent = text;
    return node;
  };
  const style = make('style', 'blade-bookmarks-shelf-style');style.textContent = css;root.append(style);
  const sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  const uri = Services.io.newURI('data:text/css;charset=UTF-8,' + encodeURIComponent('@-moz-document url("chrome://browser/content/browser.xhtml"){' + css + '}'));
  if (!sss.sheetRegistered(uri, sss.USER_SHEET)) sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
  // An hbox is deliberately not a customizable toolbar widget. Native empty
  // detection ignores it, and the native Places view and drag targets stay intact.
  const shelf = document.createXULElement('hbox');shelf.id = 'blade-bookmarks-shelf';
  shelf.setAttribute('skipintoolbarset', 'true');shelf.setAttribute('removable', 'false');
  const label = make('span', null);label.className = 'blade-shelf-label';
  const mark = make('i');mark.className = 'blade-shelf-mark';mark.setAttribute('aria-hidden', 'true');
  label.append(mark, make('span', null, 'Избранное'));
  const actions = make('span', 'blade-shelf-empty-actions');
  const add = make('button', 'blade-shelf-add', 'Добавить страницу');add.type = 'button';
  const library = make('button', 'blade-shelf-library', 'Все закладки');library.type = 'button';
  actions.append(add, library);shelf.append(label, actions);toolbar.insertBefore(shelf, nativeEmpty);
  let disposed = false, queued = false, empty = false, updates = 0;
  const listeners = [];
  function listen(node, event, handler) {
    node.addEventListener(event, handler);listeners.push(() => node.removeEventListener(event, handler));
  }
  function validPage() {return /^https?:$/i.test(gBrowser.selectedBrowser.currentURI.scheme + ':');}
  function update() {
    if (disposed) return;
    updates++;
    const bookmarks = document.getElementById('personal-bookmarks');
    shelf.hidden = !bookmarks || bookmarks.parentNode !== toolbar;
    empty = !nativeEmpty.hidden;
    actions.hidden = !empty;
    add.disabled = !validPage();
    add.title = add.disabled ? 'Откройте сайт, чтобы добавить страницу в закладки' : 'Добавить текущую страницу в закладки';
  }
  function schedule() {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => {queued = false;update();});
  }
  listen(add, 'click', () => {
    if (!validPage()) return;
    Promise.resolve(window.PlacesCommandHook.bookmarkPage()).catch(Cu.reportError);
  });
  listen(library, 'click', () => window.PlacesCommandHook.showPlacesOrganizer('AllBookmarks'));
  listen(gBrowser.tabContainer, 'TabSelect', schedule);
  listen(window, 'toolbarvisibilitychange', schedule);
  listen(window, 'aftercustomization', schedule);
  const progress = {onLocationChange: schedule, QueryInterface:ChromeUtils.generateQI(['nsIWebProgressListener', 'nsISupportsWeakReference'])};
  gBrowser.addProgressListener(progress);
  const mutation = new MutationObserver(schedule);
  mutation.observe(nativeEmpty, {attributes:true, attributeFilter:['hidden']});
  mutation.observe(items, {childList:true});
  // Native BookmarkingUI computes emptiness asynchronously from the Places view.
  // Our observer consumes that result, never writes native hidden/children state.
  const events = ['bookmark-added', 'bookmark-removed', 'bookmark-moved'];
  PlacesUtils.observers.addListener(events, schedule);
  root.setAttribute('data-blade-bookmarks-shelf', 'true');update();
  function destroy() {
    if (disposed) return;disposed = true;
    mutation.disconnect();PlacesUtils.observers.removeListener(events, schedule);
    gBrowser.removeProgressListener(progress);
    for (const release of listeners) release();listeners.length = 0;
    window.removeEventListener('unload', destroy);
    shelf.remove();style.remove();root.removeAttribute('data-blade-bookmarks-shelf');
    // The process-wide USER sheet is inert without this window's marker;
    // unregistering it here would break another browser window using the shelf.
  }
  window.addEventListener('unload', destroy, {once:true});
  window.BladeBookmarksShelf = {destroy, status:() => ({disposed,empty,updates,queued,canAdd:!add.disabled,mounted:shelf.isConnected})};
  window.Blade?.mark('bookmarks_shelf', 'v1.0.0 OK');
})();
