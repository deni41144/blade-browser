// ==UserScript==
// @name            Blade Sounds
// @description     Тихие футуристичные щелчки интерфейса в GX-стиле (синтез, без аудиофайлов)
// @author          Bobliks-Creations
// @include         main
// @version         1.0.1
// ==/UserScript==
(function () {
  if (window.BladeSounds) return;

  const PREF = 'blade.sounds.on';   // по умолчанию ВКЛ (пользователь выбрал)
  const QUIET_MS = 2500;            // старт сессии без щелчков: не пилим при восстановлении вкладок
  const started = Date.now();

  let ctx = null;

  function enabled() {
    try { return Services.prefs.getBoolPref(PREF, true); } catch (e) { return false; }
  }

  // Короткий синтезированный «тик»: пила с быстрым спадом и лёгким падением частоты.
  // Громкости крошечные (0.03-0.05) — UI-акцент, не звук.
  function blip(freq, dur, vol, type) {
    if (!enabled()) return;
    if (Date.now() - started < QUIET_MS) return;
    try {
      if (!ctx || ctx.state === 'closed') ctx = new window.AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 0.55), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }

  function onTabSelect() { blip(1750, 0.045, 0.035); }
  function onTabOpen()   { blip(1150, 0.06, 0.05, 'triangle'); }
  function onTabClose()  { blip(820, 0.07, 0.05, 'triangle'); }

  try {
    const tc = window.gBrowser && window.gBrowser.tabContainer;
    if (!tc) return;
    tc.addEventListener('TabSelect', onTabSelect);
    tc.addEventListener('TabOpen', onTabOpen);
    tc.addEventListener('TabClose', onTabClose);
  } catch (e) {
    return;
  }

  // Диагностический mark-файл по конвенции соседних скриптов
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    d.append('sounds_mark.txt');
    IOUtils.writeUTF8(d.path, 'v1.0.1 START').catch(() => {});
  } catch (e) {}

  window.BladeSounds = { blip };
})();
