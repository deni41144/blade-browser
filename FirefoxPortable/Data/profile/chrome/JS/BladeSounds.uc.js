// ==UserScript==
// @name            Blade Sounds
// @description     Звуковой дизайн Blade (синтез WebAudio, без аудиофайлов):
//                  UI-щелчки GX, «шинг» обнажения при старте, фанфара обновления,
//                  колокольчик завершённых загрузок. Громкость: преф blade.sounds.volume (0-100).
// @author          Bobliks-Creations
// @include         main
// @version         1.2.0
// ==/UserScript==
(function () {
  if (window.BladeSounds) return;

  const PREF = 'blade.sounds.on';            // по умолчанию ВКЛ (пользователь выбрал)
  const VOL_PREF = 'blade.sounds.volume';    // 0-100, по умолчанию 100
  const QUIET_MS = 2500;                     // старт сессии без щелчков: не пилим при восстановлении вкладок
  const started = Date.now();

  let ctx = null;

  function enabled() {
    try { return Services.prefs.getBoolPref(PREF, true); } catch (e) { return false; }
  }
  function vol() {
    try { return Math.min(1, Math.max(0, Services.prefs.getIntPref(VOL_PREF, 100) / 100)); } catch (e) { return 1; }
  }
  function ensureCtx() {
    try {
      if (!ctx || ctx.state === 'closed') ctx = new window.AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
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

  // ---- Звуковой пакет v1.1: тон-хелпер + фирменные звуки Blade ----

  // Тон с огибающей и опциональным свипом частоты (основа для нот/звонов)
  function tone(at, freq, dur, gain, type, endFreq) {
    const c = ensureCtx();
    if (!c) return;
    try {
      const t = c.currentTime + at;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }

  // «Шинг» — обнажение клинка при старте браузера: полосовой шум с восходящим
  // свипом (металл по ножнам) + низкий тук тела + поющий обертон.
  // v1.1.1: тихий шёпот, не вспышка — пик -9дБ, атака мягче, фильтр шире
  // (Q 6 вместо 9: резонанс меньше колет уши), свип не выше 3800 Гц
  function shing() {
    if (!enabled()) return;
    const c = ensureCtx();
    if (!c) return;
    try {
      const v = vol();
      const t = c.currentTime;
      const len = Math.floor(c.sampleRate * 0.55);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 6;
      bp.frequency.setValueAtTime(900, t);
      bp.frequency.exponentialRampToValueAtTime(3800, t + 0.4);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05 * v, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      src.connect(bp); bp.connect(g); g.connect(c.destination);
      src.start(t); src.stop(t + 0.55);
      tone(0, 170, 0.10, 0.04 * v, 'sine');           // тело удара
      tone(0.02, 1200, 0.42, 0.025 * v, 'sine', 3000); // поющий свип
    } catch (e) {}
  }

  // Фанфара «клинок обновлён»: три наты вверх (A4-C#5-E5) + кварт-аккорд
  function fanfare() {
    if (!enabled()) return;
    const v = vol();
    tone(0.00, 440.00, 0.16, 0.09 * v, 'triangle');
    tone(0.11, 554.37, 0.16, 0.09 * v, 'triangle');
    tone(0.22, 659.25, 0.16, 0.09 * v, 'triangle');
    tone(0.34, 659.25, 0.38, 0.07 * v, 'sine');
    tone(0.34, 880.00, 0.38, 0.05 * v, 'sine');
  }

  // Колокольчик завершённой загрузки: E6 с обертонной октавой, мягкий спад
  function chime() {
    if (!enabled()) return;
    const v = vol();
    tone(0, 1318.5, 0.5, 0.07 * v, 'sine');
    tone(0, 2637.0, 0.35, 0.02 * v, 'sine');
  }

  // A4 «Клинок Живёт»: вспышка каймы окна под звук — свет встречается с chime
  function windowFlash() {
    try {
      const de = window.document.documentElement;
      de.classList.add('blade-flash');
      setTimeout(() => { try { de.classList.remove('blade-flash'); } catch (e) {} }, 900);
    } catch (e) {}
  }

  // «Шинг» играем только в первом окне сессии (иначе каждый новый окно
  // звучал бы как старт) — тот же гвард, что у сплеша в BobliksSettings
  function firstWindow() {
    try {
      const en = Services.wm.getEnumerator('navigator:browser');
      let n = 0;
      while (en.hasMoreElements()) { en.getNext(); n++; }
      return n <= 1;
    } catch (e) { return false; }
  }
  if (firstWindow()) setTimeout(() => shing(), 700);

  // Колокольчик на успешные загрузки: view на публичный список Downloads
  (async () => {
    try {
      const { Downloads } = ChromeUtils.importESModule('resource://gre/modules/Downloads.sys.mjs');
      const list = await Downloads.getList(Downloads.ALL);
      const seen = new WeakSet();
      await list.addView({
        onDownloadChanged(dl) {
          try {
            if (dl && dl.succeeded && !seen.has(dl)) { seen.add(dl); chime(); windowFlash(); }
          } catch (e) {}
        },
      });
    } catch (e) { /* модуль недоступен — просто без колокольчика */ }
  })();

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
    IOUtils.writeUTF8(d.path, 'v1.2.0 START').catch(() => {});
  } catch (e) {}

  window.BladeSounds = { blip, shing, fanfare, chime, windowFlash };
})();
