// ==UserScript==
// @name            Blade Idle Tab Unloader
// @description     Освобождает память вкладок, не выбранных заданное время
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       80
// ==/UserScript==
(function () {
  if (window.__bladeIdleTabUnloader) return;
  window.__bladeIdleTabUnloader = true;

  const ENABLE_PREF = 'blade.performance.autoUnloadInactiveTabs';
  const MINUTES_PREF = 'blade.performance.autoUnloadInactiveTabs.minutes';
  const SCAN_INTERVAL_MS = 60_000;
  const PREPARE_TIMEOUT_MS = 5_000;
  const MAX_UNLOADS_PER_SCAN = 4;

  let scanRunning = false;
  let disposed = false;

  function getIdleThreshold() {
    try {
      if (!Services.prefs.getBoolPref(ENABLE_PREF, true)) return 0;
      const minutes = Services.prefs.getIntPref(MINUTES_PREF, 30);
      return minutes > 0 ? minutes * 60_000 : 0;
    } catch (_) {
      return 30 * 60_000;
    }
  }

  function canUnload(tab, now, threshold) {
    if (disposed || window.closed || !tab || tab.closing || !tab.linkedPanel) return false;
    // Gecko deliberately never discards private tabs; keep that guarantee for
    // Blade's idle timer too, since private pages may hold unsaved memory state.
    try {
      if (PrivateBrowsingUtils.isWindowPrivate(window)) return false;
    } catch (_) {
      return false;
    }
    if (tab === gBrowser.selectedTab || tab.pinned) return false;
    if (tab.hasAttribute('selected') || tab.hasAttribute('multiselected')) return false;
    try {
      if (gBrowser.selectedTabs.includes(tab)) return false;
    } catch (_) {}

    // Не прерываем загрузку, воспроизведение, PiP, захват камеры/экрана и
    // вкладки, которые расширение или пользователь пометили как неудаляемые.
    if (tab.hasAttribute('busy') || tab.hasAttribute('soundplaying') ||
        tab.hasAttribute('soundplaying-scheduledremoval') ||
        tab.hasAttribute('pictureinpicture') || tab.hasAttribute('sharing') ||
        tab.hasAttribute('undiscardable')) return false;

    const lastAccessed = Number(tab.lastAccessed);
    if (!Number.isFinite(lastAccessed) || lastAccessed <= 0 || now - lastAccessed < threshold) {
      return false;
    }

    // Внутренние страницы и расширения не трогаем; проверяем только сайты.
    try {
      const uri = tab.linkedBrowser.currentURI;
      return uri && (uri.schemeIs('http') || uri.schemeIs('https'));
    } catch (_) {
      return false;
    }
  }

  async function prepareWithTimeout(tab) {
    let timeoutId;
    try {
      return await Promise.race([
        Promise.resolve().then(() => gBrowser.prepareDiscardBrowser(tab)).then(
          () => true,
          () => false
        ),
        new Promise(resolve => {
          timeoutId = window.setTimeout(() => resolve(false), PREPARE_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  }

  async function scan() {
    if (scanRunning || disposed || window.closed ||
        typeof gBrowser.prepareDiscardBrowser !== 'function' ||
        typeof gBrowser.discardBrowser !== 'function') return;

    const threshold = getIdleThreshold();
    if (!threshold) return;

    scanRunning = true;
    try {
      const now = Date.now();
      const candidates = Array.from(gBrowser.tabs)
        .filter(tab => canUnload(tab, now, threshold))
        .sort((a, b) => Number(a.lastAccessed) - Number(b.lastAccessed));

      let unloaded = 0;
      for (const tab of candidates) {
        if (unloaded >= MAX_UNLOADS_PER_SCAN || disposed || window.closed) break;
        if (!canUnload(tab, Date.now(), threshold)) continue;

        // Сначала сохраняем состояние SessionStore. Штатный API сам откажет,
        // если страница запретила выгрузку через beforeunload.
        if (!await prepareWithTimeout(tab)) continue;
        if (!canUnload(tab, Date.now(), threshold)) continue;

        try {
          if (gBrowser.discardBrowser(tab, false)) unloaded++;
        } catch (_) {
          // Ошибка одной вкладки не должна останавливать остальные.
        }
      }
    } catch (_) {
      // Автовыгрузка не должна оставлять необработанные ошибки в окне.
    } finally {
      scanRunning = false;
    }
  }

  const timer = window.setInterval(scan, SCAN_INTERVAL_MS);
  window.addEventListener('unload', () => {
    disposed = true;
    window.clearInterval(timer);
  }, { once: true });
})();
