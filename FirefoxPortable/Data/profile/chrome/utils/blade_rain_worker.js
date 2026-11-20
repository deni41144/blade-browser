// Blade Rain WASM sim worker (ChromeWorker = privileged, no document CSP).
// Owns the Rust->WASM linear memory; main thread renders posted copies.
let ex = null, drops = null, splashes = null, MD = 216, MS = 24;
onmessage = function (e) {
  const m = e.data;
  if (m.type === 'init') {
    MD = m.maxDrops; MS = m.maxSplashes;
    WebAssembly.instantiate(new Uint8Array(m.bytes), {}).then(function (r) {
      ex = r.instance.exports;
      const mem = ex.memory;
      drops = new Float32Array(mem.buffer, ex.drops_ptr(), MD * 7);
      splashes = new Float32Array(mem.buffer, ex.splashes_ptr(), MS * 4);
      ex.clear_splashes();
      postMessage({ type: 'ready' });
    }).catch(function (err) { postMessage({ type: 'error', message: String(err && err.message || err) }); });
  } else if (!ex) {
    return;
  } else if (m.type === 'seed') {
    ex.seed_one(m.i, m.ini, m.w, m.h, m.s, m.l, m.d, m.a);
  } else if (m.type === 'impact') {
    ex.impact(m.x);
  } else if (m.type === 'tick') {
    ex.update(m.dt, m.w, m.h, m.c, m.s, m.l, m.d, m.a);
    const d = drops.slice(0, m.c * 7);
    const s = splashes.slice(0, MS * 4);
    postMessage({ type: 'frame', drops: d, splashes: s }, [d.buffer, s.buffer]);
  }
};