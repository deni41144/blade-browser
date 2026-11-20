// ==UserScript==
// @name            Blade Tab Shatter
// @description     Per-theme close VFX: WHITE ink shatter, blood seep; others keep native collapse
// @author          Bobliks-Creations
// @include         main
// @version         2.0.0
// @loadOrder       40
// ==/UserScript==
(function () {
  if (window.BladeTabShatter) return;
  const XHTML = 'http://www.w3.org/1999/xhtml';
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MAX_ACTIVE = 3, BURST_LIMIT = 6, BURST_WINDOW = 600, LIFETIME = 1040;
  const COLS = 4, ROWS = 3;
  const scenes = new Set(), admissions = [];
  let spawned = 0, skipped = 0, disposed = false;
  const now = () => window.performance.now();

  function eligible() {
    if (disposed || window.closed || document.hidden || reduced.matches) return false;
    if (root.getAttribute('data-blade-fx-mode') === 'eco') return false;
    if (root.getAttribute('data-blade-fx-paused') === 'true') return false;
    const fx = window.BladeEffects;
    if (typeof fx?.canAnimate === 'function') { try { if (!fx.canAnimate()) return false; } catch (e) { return false; } }
    return true;
  }
  function theme() { return root.getAttribute('data-blade-theme') || 'blood'; }
  function admit(t) {
    while (admissions.length && t - admissions[0] >= BURST_WINDOW) admissions.shift();
    return admissions.length < BURST_LIMIT;
  }
  function overlay(rect, cls) {
    const o = document.createElementNS(XHTML, 'div');
    o.className = cls;
    Object.assign(o.style, {
      position: 'fixed', left: rect.left + 'px', top: rect.top + 'px',
      width: rect.width + 'px', height: rect.height + 'px',
      pointerEvents: 'none', zIndex: '99999', overflow: 'visible'
    });
    return o;
  }
  function jitter() { return Math.random() * 6 - 3; }

  // WHITE: the tab crumbles into flying ink fragments.
  function buildShatter(scene, rect) {
    const o = overlay(rect, 'blade-tab-shatter');
    o.style.perspective = '500px';
    const anims = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x0 = c * 100 / COLS, x1 = (c + 1) * 100 / COLS;
        const y0 = r * 100 / ROWS, y1 = (r + 1) * 100 / ROWS;
        const f = document.createElementNS(XHTML, 'div');
        Object.assign(f.style, {
          position: 'absolute', inset: '0', background: '#222222',
          clipPath: `polygon(${x0 + jitter()}% ${y0 + jitter()}%, ${x1 + jitter()}% ${y0 + jitter()}%, ${x1 + jitter()}% ${y1 + jitter()}%, ${x0 + jitter()}% ${y1 + jitter()}%)`,
          transformOrigin: `${(x0 + x1) / 2}% ${(y0 + y1) / 2}%`, opacity: '0.95'
        });
        o.appendChild(f);
        const cx = (x0 + x1) / 2 - 50, cy = (y0 + y1) / 2 - 50;
        const dx = cx * 1.6 + (Math.random() * 24 - 12);
        const dy = cy * 1.2 + 26 + Math.random() * 22;
        const rot = Math.random() * 70 - 35;
        anims.push(f.animate([
          { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)', opacity: .95 },
          { transform: `translate3d(${dx * .5}px,${dy * .35}px,0) rotate(${rot * .5}deg) scale(.9)`, opacity: .8, offset: .45 },
          { transform: `translate3d(${dx}px,${dy}px,0) rotate(${rot}deg) scale(.4)`, opacity: 0 }
        ], { duration: 560 + Math.random() * 120, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }));
      }
    }
    document.documentElement.appendChild(o);
    scene.node = o; scene.anims = anims;
  }

  // BLOOD/RED: blood seeps down the lower rim in smooth streaks (no explosion).
  function buildBlood(scene, rect) {
    const o = overlay(rect, 'blade-tab-blood');
    const anims = [];
    const N = 7;
    for (let i = 0; i < N; i++) {
      const d = document.createElementNS(XHTML, 'div');
      const lx = 6 + i * (88 / (N - 1)) + (Math.random() * 4 - 2);
      const w = 2 + Math.random() * 2.5;
      const h = rect.height * (0.5 + Math.random() * 0.4);
      const light = i % 3 === 0;
      Object.assign(d.style, {
        position: 'absolute', left: lx + '%', top: (rect.height * 0.55) + 'px',
        width: w + 'px', height: h + 'px',
        background: light ? 'linear-gradient(180deg,#d43a45,#8c1328 60%,transparent)'
                          : 'linear-gradient(180deg,#8c1328,#650d20 65%,transparent)',
        borderRadius: '0 0 3px 3px', transformOrigin: 'top center', opacity: '0'
      });
      o.appendChild(d);
      anims.push(d.animate([
        { transform: 'translateY(0) scaleY(.15)', opacity: 0 },
        { transform: 'translateY(2px) scaleY(.6)', opacity: .85, offset: .25 },
        { transform: 'translateY(8px) scaleY(1.05)', opacity: .8, offset: .6 },
        { transform: 'translateY(14px) scaleY(1.15)', opacity: 0 }
      ], { duration: 640 + Math.random() * 120, delay: i * 40, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' }));
    }
    document.documentElement.appendChild(o);
    scene.node = o; scene.anims = anims;
  }

  function retire(scene) {
    if (!scenes.has(scene)) return;
    scenes.delete(scene);
    if (scene.timer) window.clearTimeout(scene.timer);
    if (scene.node) scene.node.remove();
  }
  function closed(ev) {
    const th = theme();
    // Only white (shatter) and blood (seep) get an overlay; red & others keep their own effect.
    if (th !== 'white' && th !== 'blood') return;
    if (!eligible() || ev.detail?.adoptedBy) { skipped++; return; }
    const t = now();
    if (!admit(t)) { skipped++; return; }
    const rect = ev.target.getBoundingClientRect();
    if (rect.width < 12 || rect.height < 8) { skipped++; return; }
    while (scenes.size >= MAX_ACTIVE) retire(scenes.values().next().value);
    admissions.push(t);
    const scene = { born: t, node: null, anims: [], timer: 0 };
    scenes.add(scene); spawned++;
    try { th === 'white' ? buildShatter(scene, rect) : buildBlood(scene, rect); }
    catch (e) { retire(scene); skipped++; return; }
    scene.timer = window.setTimeout(() => retire(scene), LIFETIME);
  }
  const tabs = window.gBrowser && gBrowser.tabContainer;
  if (tabs) tabs.addEventListener('TabClose', closed, { capture: true, passive: true });
  window.addEventListener('unload', () => {
    disposed = true;
    if (tabs) tabs.removeEventListener('TabClose', closed, true);
    for (const s of Array.from(scenes)) retire(s);
  }, { once: true });
  window.BladeTabShatter = Object.freeze({
    status: () => Object.freeze({ active: scenes.size, spawned, skipped, disposed })
  });
})();