// ==UserScript==
// @name            Blade Perf
// @description     Замер фаз старта окна: dcl/load/paint/ssr → JS\perf_mark.txt
//                  (перезапись) + JS\perf_history.txt (append, ротация 50 строк —
//                  бенчмарки «до/после» волн 2.0 «Переплавка»).
// @author          Blade-Creations
// @include         main
// @version         2.0.0
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
  // v2.0: история замеров — append с ротацией 50 строк. Read-then-write, а не
  // appendUTF8: файл лежит в chrome\JS и едет в патчи/джанк-чистки, ротация
  // обязана переписывать файл целиком, иначе он рос бы бесконечно
  const appendHistory = (line) => {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('perf_history.txt');
      IOUtils.readUTF8(d.path).then(prev => {
        const rows = prev.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        rows.push(line);
        return IOUtils.writeUTF8(d.path, rows.slice(-50).join('\r\n') + '\r\n');
      }).catch(() => {
        IOUtils.writeUTF8(d.path, line + '\r\n').catch(() => {});
      });
    } catch (e) {}
  };
  const write = () => {
    if (written) return;
    written = true;
    let s = 'v2.0.0 ' + new Date().toISOString();
    for (const p of ['dcl', 'load', 'paint', 'ssr']) {
      if (typeof t[p] === 'number') s += ' ' + p + '=' + Math.round(t[p]) + 'ms';
    }
    mark(s);
    appendHistory(s);
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
