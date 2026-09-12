// ==UserScript==
// @name            Blade Sounds
// @description     Звуковой дизайн Blade (синтез WebAudio, без аудиофайлов):
//                  UI-щелчки GX, «шинг» обнажения при старте, фанфара обновления,
//                  колокольчик завершённых загрузок. Громкость: преф blade.sounds.volume (0-100).
//                  v1.3.0: саундскрины тем — у каждой темы свой тембр (pitch/gain/волна/Q),
//                  читается с data-blade-theme на каждом звуке, живо перекрашивается с темой.
// @author          Bobliks-Creations
// @include         main
// @version         1.3.0
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

  // ---- Саундскрины тем (v1.3.0): тембр под активную тему ----
  // pitch — множитель частоты, gain — громкости, type — форма волны щелчков,
  // q — резонанс фильтра «шинга». Атрибут читаем на КАЖДОМ звуке: переключение
  // темы перекрашивает звук мгновенно, без рестарта и кэшей.
  const SKINS = {
    red:      { pitch: 1.00, gain: 1.00 },                          // база: нейтральная сталь
    blood:    { pitch: 0.70, gain: 1.00, q: 5 },                    // низко, зло, шире воздух
    purple:   { pitch: 1.05, gain: 0.95, type: 'sawtooth' },        // синтивейв-жужжание
    green:    { pitch: 1.15, gain: 0.95, type: 'square' },          // цифровой чип
    grey:     { pitch: 0.98, gain: 0.55, type: 'sine' },            // матово и заметно тише
    orange:   { pitch: 0.85, gain: 1.00, type: 'triangle' },        // тёпло, округло
    cherry:   { pitch: 1.25, gain: 0.90, type: 'sine' },            // сладкий колокольчик
    midnight: { pitch: 0.78, gain: 0.85, type: 'sine' },            // глубоко, мягко
    volt:     { pitch: 1.35, gain: 1.00, type: 'sawtooth', q: 8 },  // электрический укол
    custom:   { pitch: 1.00, gain: 1.00 }                           // конструктор — базовая сталь
  };
  function skin() {
    try {
      const id = window.document.documentElement.getAttribute('data-blade-theme');
      return SKINS[id] || SKINS.red;
    } catch (e) { return SKINS.red; }
  }

  // Короткий синтезированный «тик»: пила с быстрым спадом и лёгким падением частоты.
  // Громкости крошечные (0.03-0.05) — UI-акцент, не звук.
  function blip(freq, dur, vol, type) {
    if (!enabled()) return;
    if (Date.now() - started < QUIET_MS) return;
    try {
      if (!ctx || ctx.state === 'closed') ctx = new window.AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      const s = skin();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = s.type || type || 'sine';
      o.frequency.setValueAtTime(freq * s.pitch, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(120, freq * s.pitch * 0.55), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * s.gain, t + 0.004);
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
      const s = skin();
      const t = c.currentTime;
      const len = Math.floor(c.sampleRate * 0.55);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = s.q || 6;
      // тембр темы: свип умножается на pitch, но зажат в щадящих пределах
      bp.frequency.setValueAtTime(Math.max(300, 900 * s.pitch), t);
      bp.frequency.exponentialRampToValueAtTime(Math.min(5200, 3800 * s.pitch), t + 0.4);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05 * v * s.gain, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      src.connect(bp); bp.connect(g); g.connect(c.destination);
      src.start(t); src.stop(t + 0.55);
      tone(0, 170 * s.pitch, 0.10, 0.04 * v * s.gain, 'sine');           // тело удара
      tone(0.02, Math.min(5000, 1200 * s.pitch), 0.42, 0.025 * v * s.gain, 'sine', Math.min(5200, 3000 * s.pitch)); // поющий свип
    } catch (e) {}
  }

  // Фанфара «клинок обновлён»: три ноты вверх (A4-C#5-E5) + кварт-аккорд.
  // Транспонируется тембром темы (blood — тёмная, volt — звенящая)
  function fanfare() {
    if (!enabled()) return;
    const v = vol();
    const s = skin();
    tone(0.00, 440.00 * s.pitch, 0.16, 0.09 * v * s.gain, 'triangle');
    tone(0.11, 554.37 * s.pitch, 0.16, 0.09 * v * s.gain, 'triangle');
    tone(0.22, 659.25 * s.pitch, 0.16, 0.09 * v * s.gain, 'triangle');
    tone(0.34, 659.25 * s.pitch, 0.38, 0.07 * v * s.gain, 'sine');
    tone(0.34, 880.00 * s.pitch, 0.38, 0.05 * v * s.gain, 'sine');
  }

  // Колокольчик завершённой загрузки: E6 с обертонной октавой, мягкий спад
  function chime() {
    if (!enabled()) return;
    const v = vol();
    const s = skin();
    tone(0, 1318.5 * s.pitch, 0.5, 0.07 * v * s.gain, 'sine');
    tone(0, 2637.0 * s.pitch, 0.35, 0.02 * v * s.gain, 'sine');
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
    IOUtils.writeUTF8(d.path, 'v1.3.0 START').catch(() => {});
  } catch (e) {}

  window.BladeSounds = { blip, shing, fanfare, chime, windowFlash };
})();
