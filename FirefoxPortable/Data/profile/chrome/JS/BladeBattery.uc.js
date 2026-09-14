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
// @version         1.0.1
// ==/UserScript==
(function () {
  if (window.__bladeBattery) return;
  window.__bladeBattery = true;

  const mark = (m, e) => {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('battery_mark.txt');
      IOUtils.writeUTF8(d.path, 'v1.0.1 ' + m + (e ? ' ' + e : '')).catch(() => {});
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
  // P1-аудит (1.0.1): BatteryManager глобален на процесс — слушатели
  // levelchange/chargingchange переживают закрытие окна и держат его
  // мёртвым (утечка). getBattery асинхронный: держим ссылки и снимаем
  // на unload; если промис не разрешился к закрытию — снятие доезжает
  // через then(detach) сразу после resolve (then навешивания
  // регистрируется раньше и выполняется первым).
  try {
    if (typeof navigator.getBattery !== 'function') {
      mark('NO_API');
      return;
    }
    let battery = null;
    let onChange = null;
    const detach = () => {
      try {
        if (battery && onChange) {
          battery.removeEventListener('levelchange', onChange);
          battery.removeEventListener('chargingchange', onChange);
        }
      } catch (e) {}
    };
    const batteryPromise = navigator.getBattery();
    batteryPromise.then(bm => {
      if (window.closed) return; // окно умерло до resolve — не навешиваем
      battery = bm;
      onChange = () => {
        try {
          const sav = !bm.charging && bm.level < 0.6;
          apply(sav);
          mark(sav ? 'SAV_ON level=' + Math.round(bm.level * 100) + '%' : 'SAV_OFF');
        } catch (e) { mark('ERR sync ' + e); }
      };
      onChange();
      bm.addEventListener('levelchange', onChange);
      bm.addEventListener('chargingchange', onChange);
    }).catch(e => mark('ERR promise ' + e));
    window.addEventListener('unload', () => {
      detach();
      batteryPromise.then(detach).catch(() => {});
    }, { once: true });
  } catch (e) { mark('ERR start ' + e); }
})();
