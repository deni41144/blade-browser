// ==UserScript==
// @name            Blade Tab Icons
// @description     Значок пустой вкладки в цвет активной темы. Движок ставит на
//                  about:newtab/home/welcome бренд-иконку (tabbrowser.js
//                  FAVICON_DEFAULTS → chrome://branding/content/icon32.png) —
//                  тот самый «значок браузера» на пустых вкладках. Перехват
//                  gBrowser.setIcon подменяет его на themed-значок владельца
//                  (BLADE ICO\COLOR, 9 цветов, проверены пикселями) под текущую
//                  тему; смена темы (шина theme:changed / data-blade-theme)
//                  обновляет все пустые вкладки. Приватные вкладки не трогаем
//                  (там свой значок). Иконки лежат в chrome/img/ico/ и видны
//                  через chrome://bladeico/content/ (ico.manifest).
// @author          Bobliks-Creations
// @include         main
// @version         1.0.0
// @loadOrder       13
// ==/UserScript==
(function () {
  if (window.BladeTabIcons) return;
  window.BladeTabIcons = true;

  // ---- mark по конвенции соседних модулей ----
  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\blade_tabicons_mark.txt';
  } catch (e) {}
  const mark = (m) => {
    try { if (markPath) IOUtils.writeUTF8(markPath, 'v1.0.0 ' + m).catch(() => {}); } catch (e) {}
  };

  const ICO_BASE = 'chrome://bladeico/content/';
  // 9 цветов владельца ↔ 10 тем Blade. custom → red — та же конвенция, что у
  // atmosphere BladeNewtab (для red и custom рисуется .ba-red)
  const ICO = {
    red: '1RED.png',
    blood: '2BLOOD.png',
    purple: '3PURPLE.png',
    green: '4GREEN.png',
    grey: '5WHITE.png',     // Minimal Grey — белый значок хозяина (5WHITE)
    orange: '6ORANGE.png',
    cherry: '7CHERRY.png',
    midnight: '8BLUE.png',  // Midnight Blue — синий значок
    volt: '9YELLOW.png',    // Volt Yellow — жёлтый значок
  };

  const BLANK = /^about:(newtab|home|welcome|blank)$/;
  const PRIVATE = /^about:privatebrowsing$/;

  function themeIcon() {
    let t = '';
    try { t = window.document.documentElement.getAttribute('data-blade-theme') || 'red'; } catch (e) {}
    return ICO_BASE + (ICO[t] || ICO.red);
  }

  function tabUri(tab) {
    try { return tab.linkedBrowser.currentURI; } catch (e) { return null; }
  }

  function applyTab(tab) {
    try {
      const uri = tabUri(tab);
      if (!uri || !BLANK.test(uri.spec) || PRIVATE.test(uri.spec)) return;
      const want = themeIcon();
      if (tab.getAttribute('image') === want) return;
      window.gBrowser.setIcon(tab, want);
    } catch (e) { mark('ERR tab ' + e); }
  }

  function applyAll() {
    try {
      for (const tab of window.gBrowser.tabs) applyTab(tab);
    } catch (e) { mark('ERR all ' + e); }
  }

  // ---- per-process регистрация chrome://bladeico → chrome/img/ico ----
  // (конфиг регистрирует только utils/chrome.manifest; наш манифест — тот же
  // механизм autoRegister, повторная регистрация в новом окне безвредна)
  function registerIco() {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('img'); d.append('ico'); d.append('ico.manifest');
      if (!d.exists()) { mark('ERR manifest-missing'); return; }
      Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(d);
      mark('OK registered');
    } catch (e) { mark('ERR register ' + e); }
  }

  // ---- перехват gBrowser.setIcon: бренд-иконку (или пустую) на пустой
  // вкладке заменяем themed-значком. Реальные фавиконы проходят как есть ----
  function hookSetIcon() {
    const gb = window.gBrowser;
    if (!gb || !gb.setIcon || gb.setIcon._bladeIcoHook) return;
    const orig = gb.setIcon.bind(gb);
    const wrapped = function (tab, iconURL, originalURL, clearImageFirst) {
      try {
        if (!iconURL || iconURL === 'chrome://branding/content/icon32.png') {
          const uri = tabUri(tab);
          if (uri && BLANK.test(uri.spec) && !PRIVATE.test(uri.spec)) {
            iconURL = themeIcon();
          }
        }
      } catch (e) {}
      return orig(tab, iconURL, originalURL, clearImageFirst);
    };
    wrapped._bladeIcoHook = true;
    gb.setIcon = wrapped;
    mark('OK hooked');
  }

  // ---- старт: gBrowser может быть ещё не готов — повторяем ----
  let tries = 0;
  (function start() {
    try {
      if (!window.gBrowser || !window.gBrowser.tabContainer) {
        if (++tries < 40) { setTimeout(start, 250); return; }
        mark('ERR no-gBrowser');
        return;
      }
      registerIco();
      hookSetIcon();
      try {
        window.gBrowser.tabContainer.addEventListener('TabOpen', (ev) => applyTab(ev.target));
      } catch (e) { mark('ERR tabopen ' + e); }
      // смена темы: шина (setTheme эмитит AFTER applyLiveAttrs — атрибут уже свежий)
      try {
        if (window.Blade && window.Blade.bus) {
          window.Blade.bus.on('theme:changed', () => applyAll());
        }
      } catch (e) { mark('ERR bus ' + e); }
      // страховка: атрибут мог обновиться без шины (applyLiveAttrs из другого
      // окна, восстановление сессии) — следим за data-blade-theme напрямую
      try {
        const mo = new window.MutationObserver(() => applyAll());
        mo.observe(window.document.documentElement, { attributes: true, attributeFilter: ['data-blade-theme'] });
      } catch (e) { mark('ERR observer ' + e); }
      applyAll();
      mark('OK started tabs=' + window.gBrowser.tabs.length + ' ico=' + themeIcon().split('/').pop());
    } catch (e) { mark('ERR start ' + e); }
  })();
})();
