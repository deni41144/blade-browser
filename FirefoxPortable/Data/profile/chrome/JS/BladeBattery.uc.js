// ==UserScript==
// @name            Blade Battery
// @description     Режим экономии (волна «Сок» 2.0): без зарядки гасим
//                  бесконечные анимации хрома и newtab — атрибут
//                  data-blade-battery на :root + преф blade.battery.sav
//                  (контент-сторона через @media -moz-pref). Без новых
//                  хоткеев и без нагрузки при зарядке (конвенция 12).
//                  Если Battery API недоступен — тихо не работает (см. mark).
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// ==/UserScript==
(function () {
  if (window.__bladeBattery) return;
  window.__bladeBattery = true;

  const mark = (m, e) => {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('battery_mark.txt');
      IOUtils.writeUTF8(d.path, 'v1.0.0 ' + m + (e ? ' ' + e : '')).catch(() => {});
    } catch (e2) {}
  };

  function apply(sav) {
    try {
      const de = window.document.documentElement;
      if (sav) de.setAttribute('data-blade-battery', '1');
      else de.removeAttribute('data-blade-battery');
      // преф для контент-стороны (@media -moz-pref в userContent.css) —
      // пишем только при смене, лишних рестайлов не плодим
      if (Services.prefs.getBoolPref('blade.battery.sav', false) !== sav)
        Services.prefs.setBoolPref('blade.battery.sav', sav);
    } catch (e) {}
  }

  // Порог: не заряжается И заряда меньше 60% — тогда экономим
  try {
    if (typeof navigator.getBattery !== 'function') {
      mark('NO_API');
      return;
    }
    navigator.getBattery().then(bm => {
      const sync = () => {
        try {
          const sav = !bm.charging && bm.level < 0.6;
          apply(sav);
          mark(sav ? 'SAV_ON level=' + Math.round(bm.level * 100) + '%' : 'SAV_OFF');
        } catch (e) { mark('ERR sync ' + e); }
      };
      sync();
      bm.addEventListener('levelchange', sync);
      bm.addEventListener('chargingchange', sync);
    }).catch(e => mark('ERR promise ' + e));
  } catch (e) { mark('ERR start ' + e); }
})();
