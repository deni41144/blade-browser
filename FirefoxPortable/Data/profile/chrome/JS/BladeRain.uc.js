// ==UserScript==
// @name            Blade Rain
// @description     Independent navbar downpour; bounded canvas, no wallpaper effects
// @include         main
// @version         3.0.0
// @loadOrder       7
// ==/UserScript==
(function () {
  'use strict';
  if (window.BladeRain) return;
  const root = document.documentElement;
  const RAIN = 'blade.weather.rain';
  const THUNDER = 'blade.weather.thunder';
  const MAX_DROPS = 216;
  const MAX_SPLASHES = 24;
  // x, y, speed, length, alpha, width, drift; allocated once per window.
  // When the Rust→WASM hot-path loads these become views over WASM linear memory.
  let drops = new Float32Array(MAX_DROPS * 7);
  // x, age, duration, radius; zero duration means free.
  let splashes = new Float32Array(MAX_SPLASHES * 4);
  let wasm = null, useWasm = false, rainWorker = null;
  // Per-theme rain personalities: palette (3 planes) + speed/length/drift/alpha multipliers.
  // Each theme gets its own character; white = dark ink on light navbar (was invisible light-grey).
  const RAIN_THEMES = {
    red:      { c: ['#ff5a4e', '#ff8074', '#ffb3a9'], s: 1.0,  l: 1.0,  d: 1.0, a: 1.0 },
    blood:    { c: ['#b3121f', '#d43a45', '#e86a72'], s: .8,  l: 1.15, d: .7,  a: 1.1 },
    purple:   { c: ['#b06cff', '#c99aff', '#e0c4ff'], s: .9,  l: 1.0,  d: 1.1, a: 1.0 },
    green:    { c: ['#55d98a', '#8ceab2', '#c0f5d6'], s: .95, l: 1.0,  d: 1.0, a: 1.0 },
    grey:     { c: ['#8b9199', '#a4abb4', '#bbc1c9'], s: .85, l: .9,   d: .8,  a: .9 },
    white:    { c: ['#141414', '#3a3a3a', '#606060'], s: .9,  l: 1.1,  d: .6,  a: .8 },
    orange:   { c: ['#ff9a3d', '#ffbb70', '#ffd9a8'], s: 1.05, l: .95, d: 1.0, a: 1.0 },
    cherry:   { c: ['#ff7fa8', '#ffa8c4', '#ffd0de'], s: .6,  l: .7,   d: 2.2, a: .9 },
    midnight: { c: ['#5f7fbf', '#8aa4d6', '#b9c9ea'], s: .55, l: .85,  d: .7,  a: .8 },
    volt:     { c: ['#d4ff2f', '#e4ff7a', '#f2ffb0'], s: 1.5, l: .6,   d: 1.4, a: 1.1 },
    custom:   { c: ['#8b9199', '#a4abb4', '#bbc1c9'], s: 1.0,  l: 1.0,  d: 1.0, a: 1.0 }
  };
  let colors = RAIN_THEMES.grey.c;
  let P = { s: 1, l: 1, d: 1, a: 1 };
  function applyRainTheme(t) {
    const q = RAIN_THEMES[t] || RAIN_THEMES.grey;
    colors = q.c.slice(); P = { s: q.s, l: q.l, d: q.d, a: q.a };
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let nav = null, canvas = null, ctx = null, raf = 0;
  let width = 0, height = 0, dpr = 1, count = 0, splashCursor = 0;
  let lastFrame = -1, lastPaint = -1, frames = 0, impacts = 0, running = false, disposed = false;
  let fps = 60, dirtySize = true, reason = 'starting';
  let focused = Services.focus.activeWindow ? Services.focus.activeWindow === window : document.hasFocus();
  let initialized = false;

  function weather() {
    return Services.prefs.getBoolPref(RAIN, false) || Services.prefs.getBoolPref(THUNDER, false);
  }
  function stopReason() {
    if (disposed) return 'unload';
    if (!weather()) return 'dry';
    if (!focused || document.hidden || window.windowState === window.STATE_MINIMIZED) return 'inactive';
    if (reduced.matches) return 'reduced-motion';
    if (root.hasAttribute('data-blade-battery')) return 'battery';
    if (!window.BladeEffects || !window.BladeEffects.canAnimate()) return 'effects-paused';
    return '';
  }
  function seedDrop(i, initial) {
    if (useWasm) { wasm.seed_one(i, initial ? 1 : 0, width, height, P.s, P.l, P.d, P.a); return; }
    const o = i * 7;
    const plane = i % 3;
    drops[o] = Math.random() * (width + 12);
    drops[o + 1] = initial ? Math.random() * (height + 30) - 24 : -8 - Math.random() * 25;
    drops[o + 2] = (110 + plane * 90 + Math.random() * (45 + plane * 35)) * P.s;
    drops[o + 3] = (3.5 + plane * 3.8 + Math.random() * (3 + plane * 1.5)) * P.l;
    drops[o + 4] = (.14 + plane * .075 + Math.random() * .16) * P.a;
    drops[o + 5] = .45 + plane * .20 + Math.random() * .22;
    drops[o + 6] = (-9 - plane * 9 - Math.random() * 15) * P.d;
  }
  function resize() {
    dirtySize = false;
    const rect = nav.getBoundingClientRect();
    const nextWidth = Math.max(0, rect.width);
    const nextHeight = Math.max(0, rect.height);
    if (!nextWidth || !nextHeight) return false;
    const oldWidth = width, oldHeight = height;
    width = nextWidth; height = nextHeight;
    // Physical backing store <=2560x192 even on ultrawide/high-DPI screens.
    dpr = Math.min(window.devicePixelRatio || 1, 1.5, 2560 / width, 192 / height);
    canvas.width = Math.max(1, Math.ceil(width * dpr));
    canvas.height = Math.max(1, Math.ceil(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const nextCount = Math.min(MAX_DROPS, Math.max(36, Math.round(width / (fps === 30 ? 9 : 6.5))));
    for (let i = 0; i < nextCount; i++) {
      if (i >= count || !oldWidth) seedDrop(i, true);
      else {
        drops[i * 7] *= width / oldWidth;
        drops[i * 7 + 1] *= height / oldHeight;
      }
    }
    // Existing impacts retain their independent ages across a resize.
    for (let i = 0; i < MAX_SPLASHES; i++) splashes[i * 4] *= oldWidth ? width / oldWidth : 1;
    count = nextCount;
    return true;
  }
  function updateColors() {
    const theme = root.getAttribute('data-blade-theme') || 'red';
    applyRainTheme(theme);
  }
  function impact(x) {
    if (useWasm) { wasm.impact(x); impacts++; return; }
    const o = splashCursor * 4;
    splashCursor = (splashCursor + 1) % MAX_SPLASHES;
    splashes[o] = x; splashes[o + 1] = 0;
    splashes[o + 2] = .12 + Math.random() * .13;
    splashes[o + 3] = 1.2 + Math.random() * 1.6;
    impacts++;
  }
  function paintDrops(dt) {
    for (let i = 0; i < count; i++) {
      const o = i * 7;
      if (!useWasm) {
        drops[o] += drops[o + 6] * dt;
        drops[o + 1] += drops[o + 2] * dt;
        if (drops[o + 1] > height + drops[o + 3]) {
          if (i % 3 === 2 && Math.random() < .22) impact(drops[o]);
          seedDrop(i, false);
        }
      }
      ctx.strokeStyle = colors[i % 3];
      ctx.globalAlpha = drops[o + 4];
      ctx.lineWidth = drops[o + 5];
      const lean = drops[o + 6] / drops[o + 2] * drops[o + 3];
      ctx.beginPath();
      ctx.moveTo(drops[o] - lean, drops[o + 1] - drops[o + 3]);
      ctx.lineTo(drops[o], drops[o + 1]);
      ctx.stroke();
    }
  }
  function paintSplashes(dt) {
    ctx.strokeStyle = colors[1]; ctx.lineWidth = .65;
    for (let i = 0; i < MAX_SPLASHES; i++) {
      const o = i * 4;
      if (!splashes[o + 2]) continue;
      if (!useWasm) {
        splashes[o + 1] += dt;
        if (splashes[o + 1] / splashes[o + 2] >= 1) { splashes[o + 2] = 0; continue; }
      }
      const t = splashes[o + 1] / splashes[o + 2];
      if (t >= 1) continue;
      const spread = splashes[o + 3] * (1 + t * 1.7);
      const rise = Math.sin(t * Math.PI) * 1.8;
      const x = splashes[o];
      ctx.globalAlpha = .20 * (1 - t);
      ctx.beginPath();
      ctx.moveTo(x - spread, height - 1 - rise);
      ctx.lineTo(x - spread * .55, height - .8 - rise * .5);
      ctx.moveTo(x + spread * .55, height - .8 - rise * .5);
      ctx.lineTo(x + spread, height - 1 - rise);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function tick(now) {
    raf = 0;
    if (!running) return;
    // Event observers normally stop us first. This also closes race boundaries.
    const blocked = stopReason();
    if (blocked) { stop(blocked); return; }
    if (dirtySize && !resize()) { stop('zero-size'); return; }
    const interval = 1000 / fps;
    const elapsed = lastFrame < 0 ? interval : now - lastFrame;
    if (elapsed >= interval - .001) {
      // Keep the deadline remainder: 144/165Hz RAF must not quantize 60fps
      // down to 48/55fps. Integrate motion using actual paint timestamps.
      lastFrame = now - Math.max(0, elapsed - Math.floor((elapsed + .001) / interval) * interval);
      const dt = Math.min((lastPaint < 0 ? interval : now - lastPaint) / 1000, .05);
      lastPaint = now;
      ctx.clearRect(0, 0, width, height);
      if (useWasm) wasm.update(dt, width, height, count, P.s, P.l, P.d, P.a);
      paintDrops(dt); paintSplashes(dt); frames++;
    }
    raf = window.requestAnimationFrame(tick);
  }
  function stop(why) {
    running = false; reason = why;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0; lastFrame = -1; lastPaint = -1;
    if (canvas) {
      canvas.hidden = true;
      // Release the raster while sleeping, but retain particle state.
      canvas.width = 1; canvas.height = 1; dirtySize = true;
    }
  }
  function sync() {
    if (!initialized || disposed) return;
    const blocked = stopReason();
    if (blocked) { stop(blocked); return; }
    const nextFps = window.BladeEffects.mode() === 'balanced' ? 30 : 60;
    if (nextFps !== fps) { fps = nextFps; dirtySize = true; }
    updateColors();
    if (running) return;
    if (!resize()) { stop('zero-size'); return; }
    canvas.hidden = false; running = true; reason = 'running'; lastFrame = -1; lastPaint = -1;
    raf = window.requestAnimationFrame(tick);
  }
  function onFocus(event) {
    if (event.target !== window) return;
    focused = true; sync();
  }
  function onBlur(event) {
    // Capturing listeners also see URLbar/remote-browser focus transfers.
    // Those are not top-level window deactivation.
    if (event.target !== window) return;
    focused = false; stop('inactive');
  }
  function onResize() { dirtySize = true; sync(); }
  const prefObserver = {observe:sync};
  const attributes = new MutationObserver(sync);
  const sizeObserver = new ResizeObserver(onResize);
  // Rust→WASM hot-path: load the sim and swap buffers to views over WASM memory.
  // Falls back silently to the JS arrays if the module is absent or fails.
  function loadWasm() {
    if (useWasm || disposed) return;
    const fail = (e) => { window.BladeRainWasm = false; window.BladeRainWasmError = String((e && e.message) || e); };
    try {
      const f = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      f.append('utils'); f.append('blade_rain_sim.wasm');
      if (!f.exists()) { fail('missing file: ' + f.path); return; }
      let bytes;
      try {
        // Synchronous XPCOM read — no IOUtils dependency, valid in the chrome window.
        const CC = Components.classes;
        const fis = CC['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
        fis.init(f, -1, -1, 0);
        const bis = CC['@mozilla.org/binaryinputstream;1'].createInstance(Ci.nsIBinaryInputStream);
        bis.setInputStream(fis);
        const raw = bis.readByteArray(bis.available());
        // readByteArray yields a plain JS Array in the chrome window realm;
        // WebAssembly needs a same-realm BufferSource. Normalize either shape.
        bytes = (raw && raw.length === undefined && typeof raw.byteLength === 'number')
          ? new Uint8Array(raw) : Uint8Array.from(raw);
        bis.close(); fis.close();
      } catch (e) { fail('read: ' + e); return; }
      // Chrome-window CSP blocks WebAssembly.instantiate in the main realm and in
      // about:blank iframes (inherited CSP). A privileged ChromeWorker has no document
      // CSP, so the Rust sim runs there; the main thread renders posted buffer copies.
      const worker = new ChromeWorker('chrome://userchromejs/content/blade_rain_worker.js');
      rainWorker = worker;
      window.addEventListener('unload', () => worker.terminate(), { once: true });
      worker.onerror = (e) => fail(e.message || 'worker error');
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') {
          if (disposed) { worker.terminate(); return; }
          wasm = {
            seed_one: (i, ini, w, h, s, l, d, a) => worker.postMessage({ type: 'seed', i, ini, w, h, s, l, d, a }),
            impact: (x) => worker.postMessage({ type: 'impact', x }),
            update: (dt, w, h, c, s, l, d, a) => worker.postMessage({ type: 'tick', dt, w, h, c, s, l, d, a })
          };
          useWasm = true;
          for (let i = 0; i < count; i++) seedDrop(i, true);
          window.BladeRainWasm = true; window.BladeRainWasmError = '';
        } else if (m.type === 'frame') {
          drops = m.drops; splashes = m.splashes;
        } else if (m.type === 'error') {
          useWasm = false; fail(m.message); worker.terminate();
        }
      };
      worker.postMessage({ type: 'init', bytes: bytes.buffer, maxDrops: MAX_DROPS, maxSplashes: MAX_SPLASHES }, [bytes.buffer]);
    } catch (e) { fail(e); }
  }
  function init() {
    if (disposed || initialized) return;
    nav = document.getElementById('nav-bar');
    if (!nav) { reason = 'missing-navbar'; return; }
    canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    canvas.id = 'blade-rain-canvas'; canvas.hidden = true;
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d', {alpha:true});
    if (!ctx) { canvas = null; reason = 'canvas-unavailable'; return; }
    nav.prepend(canvas);
    initialized = true;
    loadWasm();
    Services.prefs.addObserver(RAIN, prefObserver);
    Services.prefs.addObserver(THUNDER, prefObserver);
    attributes.observe(root, {attributes:true, attributeFilter:['data-blade-fx-mode', 'data-blade-fx-paused', 'data-blade-battery', 'data-blade-theme', 'style']});
    sizeObserver.observe(nav);
    reduced.addEventListener('change', sync);
    window.Blade?.bus.on('fx:changed', sync);
    window.addEventListener('focus', onFocus, true);
    window.addEventListener('blur', onBlur, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('sizemodechange', sync, true);
    document.addEventListener('visibilitychange', sync);
    sync();
  }
  function destroy() {
    if (disposed) return;
    stop('unload'); disposed = true;
    attributes.disconnect(); sizeObserver.disconnect();
    document.removeEventListener('DOMContentLoaded', init);
    if (initialized) {
      Services.prefs.removeObserver(RAIN, prefObserver);
      Services.prefs.removeObserver(THUNDER, prefObserver);
      reduced.removeEventListener('change', sync);
      window.Blade?.bus.off('fx:changed', sync);
      window.removeEventListener('focus', onFocus, true);
      window.removeEventListener('blur', onBlur, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('sizemodechange', sync, true);
      document.removeEventListener('visibilitychange', sync);
    }
    window.removeEventListener('unload', destroy);
    canvas?.remove(); canvas = null; ctx = null;
  }
  window.BladeRain = Object.freeze({
    version:'3.0.0', destroy,
    // Snapshot allocation only on explicit QA request, never from the frame loop.
    status() {
      let activeSplashes = 0;
      for (let i = 0; i < MAX_SPLASHES; i++) if (splashes[i * 4 + 2]) activeSplashes++;
      return {running, reason, fps, frames, impacts, wasm:useWasm, drops:count, maxDrops:MAX_DROPS,
        splashes:activeSplashes, maxSplashes:MAX_SPLASHES, planes:3, dpr,
        width, height, pixelWidth:canvas?.width || 0, pixelHeight:canvas?.height || 0,
        rafPending:!!raf, disposed};
    },
  });
  window.addEventListener('unload', destroy, {once:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
