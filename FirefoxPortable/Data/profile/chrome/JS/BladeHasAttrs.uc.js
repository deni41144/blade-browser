// ==UserScript==
// @name            Blade Has-Attrs
// @description     Fix 8: замена дорогих CSS :has() на атрибуты-состояния.
//                  #nav-bar[blade-urlbar-focused], #tabbrowser-tabs[blade-tabs-dense],
//                  #navigator-toolbox[blade-soundplaying]. MutationObserver зеркалят
//                  ТОЧНЫЕ условия исходных :has() (querySelector), но срабатывают
//                  только при DOM-мутациях, а не при каждом style-recalc, и пишут
//                  атрибут лишь при реальной смене состояния. Декларации CSS не
//                  менялись — визуал идентичен, инвалидация стиля сужена.
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// ==/UserScript==
(function () {
  if (window.__bladeHasAttrs) return;
  window.__bladeHasAttrs = true;

  const navBar = document.getElementById('nav-bar');
  const tabs = document.getElementById('tabbrowser-tabs');
  const toolbox = document.getElementById('navigator-toolbox');
  if (!navBar || !tabs || !toolbox || typeof gBrowser === 'undefined') return;

  const observers = [];

  // Пишем атрибут ТОЛЬКО при реальной смене состояния — никакой лишней
  // style-инвалидации (главный выигрыш против :has()).
  const setAttr = (el, name, on) => {
    const has = el.hasAttribute(name);
    if (on && !has) el.setAttribute(name, '');
    else if (!on && has) el.removeAttribute(name);
  };

  // Точные зеркала исходных :has()-условий (те же селекторы, тот же результат):
  // 1. #nav-bar:has(#urlbar[focused]), #nav-bar:has(.urlbar[focused])
  const syncUrlbar = () =>
    setAttr(navBar, 'blade-urlbar-focused', !!document.querySelector('#urlbar[focused], .urlbar[focused]'));
  // 2. #tabbrowser-tabs[orient="horizontal"]:has(.tabbrowser-tab:nth-child(n + 18))
  const syncDense = () =>
    setAttr(tabs, 'blade-tabs-dense', !!tabs.querySelector('.tabbrowser-tab:nth-child(n + 18)'));
  // 3. #navigator-toolbox:has(tab[soundplaying]), :has(.tabbrowser-tab[soundplaying])
  const syncSound = () =>
    setAttr(toolbox, 'blade-soundplaying', !!toolbox.querySelector('tab[soundplaying], .tabbrowser-tab[soundplaying]'));

  const watch = (target, opts, fn) => {
    if (!target) return;
    const mo = new MutationObserver(fn);
    mo.observe(target, opts);
    observers.push(mo);
  };
  // attributeFilter сужает callback до нужных атрибутов; childList — до добавления/
  // удаления вкладок. Реакция микрозадачей до следующей отрисовки → как у :has().
  watch(navBar, { attributes: true, attributeFilter: ['focused'], subtree: true }, syncUrlbar);
  watch(tabs, { childList: true, subtree: true }, syncDense);
  watch(toolbox, { attributes: true, attributeFilter: ['soundplaying'], subtree: true }, syncSound);

  // Начальное состояние: сессия могла уже восстановить ≥18 вкладок / звучащую вкладку.
  syncUrlbar(); syncDense(); syncSound();

  window.addEventListener('unload', () => {
    for (const mo of observers) mo.disconnect();
    observers.length = 0;
  }, { once: true });

  try { window.Blade && window.Blade.mark && window.Blade.mark('BladeHasAttrs', 'v1.0.0 OK init'); } catch (e) {}
})();