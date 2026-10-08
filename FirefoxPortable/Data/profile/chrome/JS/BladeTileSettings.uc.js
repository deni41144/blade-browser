// ==UserScript==
// @name            Blade Tile Settings
// @description     Native pinned tiles, persistent order and local custom covers
// @include         main
// @loadOrder       10
// @version         1.0.0
// ==/UserScript==
(function () {
  'use strict';
  if (window.BladeTileSettings) return;
  const { NewTabUtils } = ChromeUtils.importESModule('resource://gre/modules/NewTabUtils.sys.mjs');
  const { AboutNewTab } = ChromeUtils.importESModule('resource:///modules/AboutNewTab.sys.mjs');
  const PREF = 'blade.tiles.customCovers';
  const PIN_PREF = 'browser.newtabpage.pinned';
  const MAX_TILES = 64;
  const listeners = new Set();
  let disposed = false;
  let pendingNotification = false;
  const imageRoot = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
  imageRoot.append('img');
  const coverRoot = imageRoot.clone();
  coverRoot.append('custom-tiles');
  const sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  // Sheet registration is process-wide, so its ownership is process-wide too.
  const { tileSheetState: sheetState } = ChromeUtils.importESModule('chrome://userscripts/content/BladeTileState.sys.mjs');

  function normalizeURL(value) {
    let input = String(value || '').trim();
    if (!input || input.length > 4096 || /[\u0000-\u0020\u007f]/.test(input)) {
      throw new Error('Укажи корректный адрес сайта.');
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) input = 'https://' + input;
    let parsed;
    try { parsed = new URL(input); } catch (_) { throw new Error('Укажи корректный адрес сайта.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
      throw new Error('Нужен адрес HTTP или HTTPS без логина и пароля.');
    }
    return parsed.href;
  }
  function canonical(value) {
    try { return normalizeURL(value); } catch (_) { return ''; }
  }
  function readCovers() {
    const result = Object.create(null);
    try {
      const raw = JSON.parse(Services.prefs.getStringPref(PREF, '{}'));
      if (!raw || Array.isArray(raw) || typeof raw !== 'object') return result;
      for (const [url, name] of Object.entries(raw).slice(0, MAX_TILES)) {
        if (canonical(url) && validName(name)) result[canonical(url)] = name;
      }
    } catch (_) {}
    return result;
  }
  function validName(name) {
    return typeof name === 'string' && /^tile_[a-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(name);
  }
  function coverFile(name) {
    if (!validName(name)) return null;
    const file = coverRoot.clone();
    file.append(name);
    return file.exists() && file.isFile() && !file.isSymlink() ? file : null;
  }
  function list() {
    const covers = readCovers();
    return NewTabUtils.pinnedLinks.links.flatMap((link, index) => {
      if (!link || !canonical(link.url)) return [];
      const item = { url: link.url, title: String(link.label || link.title || new URL(link.url).hostname), index };
      const name = covers[canonical(link.url)];
      if (coverFile(name)) item.cover = name;
      return [item];
    });
  }
  function notify() {
    if (pendingNotification || disposed) return;
    pendingNotification = true;
    window.queueMicrotask(() => {
      pendingNotification = false;
      if (disposed) return;
      for (const callback of [...listeners]) {
        try { callback(list()); } catch (_) {}
      }
    });
  }
  async function refresh() {
    // Same path used by Firefox's own pin/unpin editor. No navigation/reload.
    if (!AboutNewTab.activityStream) await AboutNewTab.activityStreamPromise;
    const feed = AboutNewTab.activityStream?.store?.feeds?.get('feeds.topsites');
    if (feed) {
      feed.pinnedCache.expire();
      feed.frecentCache?.expire();
      await feed.refresh({ broadcast: true });
    }
    notify();
  }
  const cssString = value => '"' + String(value).replace(/["\\\n\r\f]/g, char => '\\' + char.charCodeAt(0).toString(16) + ' ') + '"';
  function applyCoverSheet() {
    const covers = readCovers();
    const rules = [];
    for (const item of list()) {
      // Existing fallback contains many :not([href*=domain]) selectors.
      // One inert ID branch raises specificity without changing the DOM.
      const selector = ':is(#blade-custom-tile-covers,.top-sites-list) .top-site-outer .top-site-button[href=' + cssString(item.url) + '][href]';
      const native = NewTabUtils.pinnedLinks.links[item.index];
      // Firefox's drag path keeps label but strips unknown object keys.
      if (native?.label || native?.bladeCustomTitle || item.cover) {
        rules.push(selector + '{position:relative!important;}' + selector + ' .title{display:flex!important;position:absolute!important;inset:auto 6px 6px!important;margin:0!important;padding:5px 8px!important;width:auto!important;max-width:calc(100% - 12px)!important;border-radius:5px!important;background:rgba(8,8,12,.82)!important;color:#f5f3f6!important;font:600 11px/1.4 "Segoe UI",sans-serif!important;letter-spacing:.025em!important;text-align:left!important;z-index:4!important;}' + selector + ' .title .title-label{overflow:hidden!important;white-space:nowrap!important;text-overflow:ellipsis!important;}' + selector + ' .title::before{display:none!important;}');
      }
      const file = coverFile(covers[canonical(item.url)]);
      if (!file) continue;
      rules.push(selector + ' .tile{background-image:url(' + cssString(PathUtils.toFileURI(file.path)) + ')!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;}');
      // Native favicon/screenshot otherwise obscures the custom image.
      rules.push(selector + ' .tile > .icon-stack,' + selector + ' .tile > .screenshot{visibility:hidden!important;}');
    }
    const css = rules.length ? '@-moz-document url("about:newtab"),url("about:home"){'+rules.join('')+'}' : '';
    if (sheetState.css === css) return;
    const previous = sheetState.uri;
    const next = css ? Services.io.newURI('data:text/css;charset=utf-8,' + encodeURIComponent(css)) : null;
    if (next && !sss.sheetRegistered(next, sss.USER_SHEET)) sss.loadAndRegisterSheet(next, sss.USER_SHEET);
    sheetState.uri = next;
    sheetState.css = css;
    if (previous && (!next || previous.spec !== next.spec) && sss.sheetRegistered(previous, sss.USER_SHEET)) sss.unregisterSheet(previous, sss.USER_SHEET);
  }
  function writeCovers(covers) {
    Services.prefs.setStringPref(PREF, JSON.stringify(covers));
    applyCoverSheet();
  }
  function indexOf(url) {
    const key = canonical(url);
    return NewTabUtils.pinnedLinks.links.findIndex(link => link && canonical(link.url) === key);
  }
  async function save(value, originalUrl) {
    const url = normalizeURL(value?.url);
    const title = String(value?.title || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80) || new URL(url).hostname;
    const originalIndex = originalUrl ? indexOf(originalUrl) : -1;
    const duplicateIndex = indexOf(url);
    if (duplicateIndex >= 0 && duplicateIndex !== originalIndex) throw new Error('Такая плитка уже есть.');
    const covers = readCovers();
    if (Object.prototype.hasOwnProperty.call(value, 'cover') && value.cover && !coverFile(value.cover)) {
      throw new Error('Обложка недоступна. Выбери изображение ещё раз.');
    }
    const links = NewTabUtils.pinnedLinks.links;
    let index = originalIndex;
    if (index < 0) {
      index = links.findIndex(link => !link);
      if (index < 0) index = links.length;
    }
    if (index >= MAX_TILES) throw new Error('Достигнут предел в 64 плитки.');
    const old = originalIndex >= 0 ? { ...links[originalIndex] } : {};
    if (old.url && canonical(old.url) !== url) {
      NewTabUtils.blockedLinks.block({ url: old.url });
      if (covers[canonical(old.url)]) covers[url] = covers[canonical(old.url)];
      delete covers[canonical(old.url)];
    }
    if (Object.prototype.hasOwnProperty.call(value, 'cover')) {
      if (value.cover) covers[url] = value.cover;
      else delete covers[url];
    }
    NewTabUtils.blockedLinks.unblock({ url });
    const link = { ...old, url, title, label: title, customScreenshotURL: '', bladeCustomTitle: true, baseDomain: new URL(url).hostname };
    // Pin's own matching is byte-exact: remove any noncanonical legacy URL first.
    if (old.url && old.url !== url) NewTabUtils.pinnedLinks.unpin(old);
    NewTabUtils.pinnedLinks.pin(link, index);
    const rowsPref = 'browser.newtabpage.activity-stream.topSitesRows';
    const rows = Math.ceil((index + 1) / 8);
    if (Services.prefs.getIntPref(rowsPref, 1) < rows) Services.prefs.setIntPref(rowsPref, rows);
    Services.prefs.setBoolPref('blade.tiles.customized', true);
    writeCovers(covers);
    await refresh();
    return list().find(item => canonical(item.url) === url);
  }
  async function remove(url) {
    const index = indexOf(url);
    if (index < 0) return false;
    const link = { ...NewTabUtils.pinnedLinks.links[index] };
    NewTabUtils.blockedLinks.block(link);
    const links = NewTabUtils.pinnedLinks.links;
    const remaining = links.filter(Boolean);
    links.splice(0, links.length, ...remaining);
    NewTabUtils.pinnedLinks.save();
    Services.prefs.setBoolPref('blade.tiles.customized', true);
    const covers = readCovers();
    delete covers[canonical(link.url)];
    writeCovers(covers);
    await refresh();
    return true;
  }
  async function move(url, delta) {
    const items = list();
    const position = items.findIndex(item => canonical(item.url) === canonical(url));
    const next = position + (Number(delta) < 0 ? -1 : 1);
    if (position < 0 || next < 0 || next >= items.length || !Number(delta)) return false;
    const a = items[position].index, b = items[next].index;
    const links = NewTabUtils.pinnedLinks.links;
    [links[a], links[b]] = [links[b], links[a]];
    NewTabUtils.pinnedLinks.save();
    Services.prefs.setBoolPref('blade.tiles.customized', true);
    await refresh();
    return true;
  }
  async function moveTo(url, targetUrl) {
    const items = list();
    const from = items.findIndex(item => canonical(item.url) === canonical(url));
    const to = items.findIndex(item => canonical(item.url) === canonical(targetUrl));
    if (from < 0 || to < 0 || from === to) return false;
    const links = NewTabUtils.pinnedLinks.links;
    const ordered = items.map(item => links[item.index]);
    ordered.splice(to, 0, ordered.splice(from, 1)[0]);
    items.forEach((item, index) => { links[item.index] = ordered[index]; });
    NewTabUtils.pinnedLinks.save();
    Services.prefs.setBoolPref('blade.tiles.customized', true);
    await refresh();
    return true;
  }
  function coverURI(item) {
    const name = item && Object.prototype.hasOwnProperty.call(item, 'cover') ? item.cover : readCovers()[canonical(item?.url)];
    const file = coverFile(name);
    if (file) return PathUtils.toFileURI(file.path);
    let host;
    try { host = new URL(item.url).hostname.toLowerCase(); } catch (_) { return ''; }
    const themes = imageRoot.clone();
    themes.append('themes');
    if (!themes.exists()) return '';
    const matches = [];
    const entries = themes.directoryEntries;
    while (entries.hasMoreElements()) {
      const entry = entries.getNext().QueryInterface(Ci.nsIFile);
      const domain = entry.leafName.toLowerCase();
      if (entry.isDirectory() && (host === domain || host.endsWith('.' + domain))) matches.push(entry);
    }
    matches.sort((a,b) => b.leafName.length-a.leafName.length);
    let theme = window.BladeEngine?.activeTheme() || 'red';
    if (theme === 'custom' || !/^[a-z]+$/.test(theme)) theme = 'red';
    for (const directory of matches) {
      const builtin = directory.clone();
      builtin.append(theme + '.jpg');
      if (builtin.exists() && builtin.isFile()) return PathUtils.toFileURI(builtin.path);
    }
    return '';
  }
  function imageFormat(bytes) {
    const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
    if ([137,80,78,71,13,10,26,10].every((byte,index) => bytes[index] === byte)) return 'png';
    if (/^GIF8[79]a$/.test(ascii(0,6))) return 'gif';
    if (ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP') return 'webp';
    if (ascii(4,4) === 'ftyp' && /avif|avis/.test(ascii(8,Math.min(bytes.length-8,56)))) return 'avif';
    return '';
  }
  async function importCover(file) {
    if (!file.isFile() || file.fileSize <= 0 || file.fileSize > 20 * 1024 * 1024) throw new Error('Выбери картинку размером до 20 МБ.');
    const bytes = await IOUtils.read(file.path);
    const ext = imageFormat(bytes);
    if (!ext) throw new Error('Поддерживаются PNG, JPEG, WEBP, AVIF и GIF.');
    const image = new window.Image();
    let timer;
    try {
      image.src = PathUtils.toFileURI(file.path);
      await Promise.race([image.decode(), new Promise((_,reject) => { timer = window.setTimeout(() => reject(new Error('Не удалось прочитать изображение.')), 10000); })]);
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 8192 || image.naturalHeight > 8192 || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Изображение слишком большое: максимум 8192 пикселя и 40 Мп.');
    } catch (error) { throw new Error(error.message || 'Не удалось прочитать изображение.'); }
    finally { window.clearTimeout(timer); image.removeAttribute('src'); }
    await IOUtils.makeDirectory(coverRoot.path, { ignoreExisting: true });
    const name = 'tile_' + Services.uuid.generateUUID().toString().replace(/[{}]/g, '') + '.' + ext;
    await IOUtils.copy(file.path, PathUtils.join(coverRoot.path, name), { noOverwrite: true });
    return name;
  }
  function chooseCover() {
    return new Promise((resolve, reject) => {
      try {
        const picker = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
        picker.init(window.browsingContext, 'Обложка плитки', Ci.nsIFilePicker.modeOpen);
        picker.appendFilters(Ci.nsIFilePicker.filterImages);
        picker.open(result => {
          if (result !== Ci.nsIFilePicker.returnOK || !picker.file) { resolve(null); return; }
          importCover(picker.file).then(resolve, reject);
        });
      } catch (error) { reject(error); }
    });
  }
  const observer = { observe(_subject, _topic, pref) { if (pref === PREF || pref === PIN_PREF) { applyCoverSheet(); notify(); } } };
  Services.prefs.addObserver(PREF, observer);
  Services.prefs.addObserver(PIN_PREF, observer);
  const themeChanged = () => { applyCoverSheet(); notify(); };
  window.Blade?.bus?.on('theme:changed', themeChanged);
  applyCoverSheet();
  window.BladeTileSettings = { list, save, remove, move, moveTo, chooseCover, importCover, coverURI, getCoverDir() { return coverRoot.clone(); },
    subscribe(callback) { if (typeof callback !== 'function') throw new TypeError('Expected callback'); listeners.add(callback); return () => listeners.delete(callback); }
  };
  window.addEventListener('unload', () => {
    disposed = true;
    Services.prefs.removeObserver(PREF, observer);
    Services.prefs.removeObserver(PIN_PREF, observer);
    window.Blade?.bus?.off('theme:changed', themeChanged);
    listeners.clear();
    // The persistent global cover sheet remains valid for other browser windows.
  }, { once: true });
})();
