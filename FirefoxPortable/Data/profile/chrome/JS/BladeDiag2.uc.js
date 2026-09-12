// ==UserScript==
// @name            Blade Diag2
// @description     Разовая диагностика виджета часов: поздний add с захватом ошибки
// @author          Blade-Creations
// @include         main
// @version         1.1.0
// ==/UserScript==
(function () {
  if (window.BladeDiag2) return;
  window.BladeDiag2 = true;
  const write = (L) => {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS');
      d.append('clockdiag_mark.txt');
      IOUtils.writeUTF8(d.path, L.join('\n')).catch(() => {});
    } catch (e) {}
  };
  setTimeout(() => {
    const L = ['=== поздний тест (10с) ==='];
    try {
      const C = window.CustomizableUI;
      L.push('BEFORE=' + JSON.stringify(C.getPlacementOfWidget('blade-clock-widget')));
      let res;
      try {
        C.addWidgetToArea('blade-clock-widget', C.AREA_NAVBAR);
        res = 'ADD_OK';
      } catch (e) { res = 'ADD_THREW: ' + e; }
      L.push('ADD_RESULT=' + res);
      L.push('AFTER=' + JSON.stringify(C.getPlacementOfWidget('blade-clock-widget')));
      // ensureWidgetPlacedInWindow — явное построение узла в окне (движковый API)
      let ens;
      try { ens = 'ENS=' + C.ensureWidgetPlacedInWindow('blade-clock-widget', window); } catch (e) { ens = 'ENS_THREW: ' + e; }
      L.push(ens);
      const n = window.document.getElementById('blade-clock-widget');
      L.push('NODE=' + (n ? ('w=' + n.clientWidth + ' lbl=[' + n.getAttribute('label') + '] cls=[' + n.className + ']') : 'NULL'));
      // перечисляем реальных детей навбара и все элементы с 'clock' в id
      try {
        const nb = window.document.getElementById('nav-bar');
        L.push('NAVBAR_KIDS=' + (nb ? Array.from(nb.children).map(c => (c.id || c.tagName)).join(',') : 'NO_NAVBAR'));
        const hits = Array.from(window.document.querySelectorAll('[id*="clock"]')).map(e => e.tagName + '#' + e.id);
        L.push('CLOCK_ELS=' + (hits.length ? hits.join(' | ') : 'none'));
        // дети customization-target — реальные слоты виджетов: id|label|class каждого
        try {
          const ct = window.document.getElementById('nav-bar-customization-target');
          if (ct) {
            L.push('CT_KIDS=' + Array.from(ct.children).map(c =>
              (c.id || 'noid') + '[' + (c.getAttribute('label') || '') + ']').join(' , '));
          } else { L.push('CT=none'); }
        } catch (e) { L.push('CT_ERR=' + e); }
      } catch (e) { L.push('ENUM_ERR=' + e); }
    } catch (e) { L.push('OUTER_ERR=' + e); }
    write(L);
  }, 10000);
})();
