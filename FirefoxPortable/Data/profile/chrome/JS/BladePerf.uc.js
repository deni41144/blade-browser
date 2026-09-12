// ==UserScript==
// @name            Blade Perf
// @description     Замер фаз старта окна: dcl/load/paint/ssr в JS\perf_mark.txt
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// ==/UserScript==
(function () {
  if (window.__bladePerf) return;
  window.__bladePerf = true;
  // Только первое окно сессии: у окон, открытых позже, ssr уже не придёт и
  // их 10-сек фолбэк затёр бы стартовый замер (паттерн сплеша из Settings)
  let winCount = 0;
  const en = Services.wm.getEnumerator('navigator:browser');
  while (en.hasMoreElements()) { en.getNext(); winCount++; }
  if (winCount > 1) return;
  const t = { dcl: performance.now() };
  let written = false;
  const mark = (text) => {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('perf_mark.txt');
      IOUtils.writeUTF8(d.path, text).catch(() => {});
    } catch (e) {}
  };
  const write = () => {
    if (written) return;
    written = true;
    let s = 'v1.0.0 ' + new Date().toISOString();
    for (const p of ['dcl', 'load', 'paint', 'ssr']) {
      if (typeof t[p] === 'number') s += ' ' + p + '=' + Math.round(t[p]) + 'ms';
    }
    mark(s);
  };
  window.addEventListener('load', () => { t.load = performance.now(); }, { once: true });
  // Первый MozAfterPaint — первое реальное появление пикселей окна
  window.addEventListener('MozAfterPaint', () => { t.paint = performance.now(); }, { once: true });
  const onSsr = () => { t.ssr = performance.now(); write(); };
  try {
    Services.obs.addObserver(onSsr, 'sessionstore-windows-restored');
    window.addEventListener('unload', () => {
      try { Services.obs.removeObserver(onSsr, 'sessionstore-windows-restored'); } catch (e) {}
    }, { once: true });
  } catch (e) {}
  // Страховка: ssr не пришёл за 10 сек — пишем то, что успели зафиксировать
  setTimeout(write, 10000);
})();
