// ==UserScript==
// @name            Blade Pulse
// @description     Пульс Клинка — самодиагностика при старте: контракт BladeCore,
//                  ключевые узлы (навбар, часы, меню B, Hero), шрифты, файлы
//                  (VERSION, covers.css) → JS\blade_health.txt, вердикт
//                  GREEN / YELLOW / RED. Фаза 0 роадмапа 2.0: страховка друзей
//                  после движковых обновлений и инструмент ночного рефакторинга.
//                  RED = сломано ядро/узлы; YELLOW = косметика (шрифты/файлы).
// @author          Blade-Creations
// @include         main
// @onlyonce
// @loadOrder       99
// @version         1.0.0
// ==/UserScript==
(function () {
  if (window.__bladePulse) return;
  window.__bladePulse = true;

  const res = [];
  const add = (ok, name, detail) => { res.push({ ok, name, detail: detail || '' }); };

  function domChecks() {
    // Контракт BladeCore — на нём держатся Settings/ChromeStyle/Covers
    const B = window.Blade;
    add(!!(B && Array.isArray(B.themes) && B.bus && typeof B.prefStr === 'function'),
        'core-contract',
        B ? 'window.Blade жив' : 'window.Blade отсутствует — BladeCore не исполнился');
    // Ключевые узлы: движковые + наши (часы — прямая DOM-вставка, меню B — CUI,
    // Hero — оверлей новой вкладки)
    const nodes = [
      ['node-navbar', '#nav-bar'],
      ['node-clock', '#blade-clock-widget'],
      ['node-menub', '#bobliks-settings-button'],
      ['node-hero', '#blade-hero-wrap'],
    ];
    for (const [name, sel] of nodes) {
      let el = null;
      try { el = window.document.querySelector(sel); } catch (e) {}
      add(!!el, name, el ? sel : sel + ' не найден');
    }
    // Шрифты: семья загружена и доступна для отрисовки хрома
    try {
      for (const fam of ['Unbounded', 'Rubik', 'JetBrains Mono']) {
        add(window.document.fonts.check('16px "' + fam + '"'),
            'font-' + fam.toLowerCase().replace(/\s+/g, '-'),
            fam + (window.document.fonts.check('16px "' + fam + '"') ? ' загружен' : ' НЕ загружен'));
      }
    } catch (e) {
      add(false, 'fonts-api', String(e));
    }
  }

  async function fileChecks() {
    // VERSION — единственный источник версии (его читают меню B, HUD, сетап)
    try {
      const vf = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      vf.append('VERSION');
      const v = (await IOUtils.readUTF8(vf.path)).replace(/^\uFEFF/, '').trim();
      add(!!v, 'file-version', v ? 'VERSION=' + v : 'VERSION пуст');
    } catch (e) {
      add(false, 'file-version', 'VERSION не читается');
    }
    // covers.css — генератор обложек должен был отработать (@onlyonce)
    try {
      const cf = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      cf.append('covers.css');
      add(await IOUtils.exists(cf.path), 'file-covers', 'covers.css');
    } catch (e) {
      add(false, 'file-covers', 'проверка упала: ' + e);
    }
  }

  async function writeHealth() {
    const hardFail = res.some(r => !r.ok && (r.name === 'core-contract' || r.name.startsWith('node-')));
    const anyFail = res.some(r => !r.ok);
    const health = hardFail ? 'RED' : (anyFail ? 'YELLOW' : 'GREEN');
    let s = 'v1.0.0 ' + new Date().toISOString() + ' HEALTH: ' + health + '\n';
    for (const r of res) s += (r.ok ? '[OK] ' : '[FAIL] ') + r.name + ': ' + r.detail + '\n';
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('blade_health.txt');
      await IOUtils.writeUTF8(d.path, s);
    } catch (e) {}
  }

  async function runAll() {
    try { domChecks(); } catch (e) {}
    try { await fileChecks(); } catch (e) {}
    await writeHealth();
  }

  // Шрифты грузятся асинхронно: ждём document.fonts.ready (таймаут 8с) и ещё
  // 2с — поздние монтирования (часы-ретраи) должны успеть
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    setTimeout(runAll, 2000);
  };
  try { window.document.fonts.ready.then(go, go); } catch (e) { go(); }
  setTimeout(go, 8000);
})();
