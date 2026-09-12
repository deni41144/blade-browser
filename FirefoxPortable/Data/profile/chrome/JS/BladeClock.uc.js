// ==UserScript==
// @name            Blade Clock
// @description     Часы + погода в тулбаре. Город определяется по IP (ipwho.is),
//                  можно задать вручную префом blade.clock.cityQuery. Ключей нет.
// @author          Blade-Creations
// @include         main
// @version         2.5.2
// ==/UserScript==
(function () {
  const WIDGET_ID = 'blade-clock-widget';
  const FALLBACK = { lat: 48.47, lon: 35.04, city: 'Дніпро' };   // если всё недоступно

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function timeString() {
    const d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function getStr(name) {
    try { return Services.prefs.getStringPref(name, ''); } catch (e) { return ''; }
  }
  function setStr(name, v) {
    try { Services.prefs.setStringPref(name, v); } catch (e) {}
  }

  // --- Координаты: ручной город > IP-геолокация > кэш > Дніпро ---
  async function resolveCoords() {
    // 1. Ручной город (перезаписывает всё)
    const manual = getStr('blade.clock.cityQuery').trim();
    if (manual) {
      // Тот же город в свежем кэше — без сети: геокодинг не ходит при каждом вызове
      const geoStamp = Number(getStr('blade.clock.geoStamp') || '0');
      if (Date.now() - geoStamp < 24 * 3600e3 &&
          getStr('blade.clock.city').trim().toLowerCase() === manual.toLowerCase()) {
        const lat = Number(getStr('blade.clock.lat'));
        const lon = Number(getStr('blade.clock.lon'));
        if (lat && lon) return { lat, lon, city: manual };
      }
      try {
        const url = 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name=' + encodeURIComponent(manual);
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const d = await r.json();
        if (d.results && d.results.length) {
          const geo = { lat: d.results[0].latitude, lon: d.results[0].longitude, city: d.results[0].name || manual };
          // кэшируем и ручной город — ранний выход выше сработает со второго раза
          setStr('blade.clock.lat', String(geo.lat));
          setStr('blade.clock.lon', String(geo.lon));
          setStr('blade.clock.city', geo.city);
          setStr('blade.clock.geoStamp', String(Date.now()));
          return geo;
        }
      } catch (e) {}
    }
    // 2. Свежий кэш геолокации (сутки)
    const geoStamp = Number(getStr('blade.clock.geoStamp') || '0');
    if (Date.now() - geoStamp < 24 * 3600e3) {
      const lat = Number(getStr('blade.clock.lat'));
      const lon = Number(getStr('blade.clock.lon'));
      if (lat && lon) return { lat, lon, city: getStr('blade.clock.city') || FALLBACK.city };
    }
    // 3. IP-геолокация
    try {
      const r = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      if (d && d.success && isFinite(d.latitude) && isFinite(d.longitude)) {
        setStr('blade.clock.lat', String(d.latitude));
        setStr('blade.clock.lon', String(d.longitude));
        setStr('blade.clock.city', d.city || '');
        setStr('blade.clock.geoStamp', String(Date.now()));
        return { lat: d.latitude, lon: d.longitude, city: d.city || '' };
      }
    } catch (e) {}
    return FALLBACK;
  }

  let lastWeather = '';
  let lastKind = '';
  let lastCity = getStr('blade.clock.city');

  // Вид атмосферы по WMO-коду open-meteo. Ровно один kind активен —
  // остальное из списка чистим (смена погоды не должна оставлять хвосты)
  const WEATHER_KINDS = ['clear', 'clouds', 'rain', 'snow', 'thunder', 'fog'];
  // A10 «Клинок Живёт»: глиф вида погоды в виджете (стилит CSS)
  const WEATHER_GLYPHS = { clear: '☀', clouds: '☁', rain: '☂', snow: '❄', thunder: '⚡', fog: '🌫' };
  function currentKind() {
    if (lastKind) return lastKind;
    for (const k of WEATHER_KINDS) {
      try { if (Services.prefs.getBoolPref('blade.weather.' + k, false)) return k; } catch (e) {}
    }
    return '';
  }
  function weatherKind(code) {
    if (code >= 95) return 'thunder';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 1 && code <= 3) return 'clouds';
    return 'clear';
  }

  function cachedWeather() {
    try {
      const saved = getStr('blade.clock.weather');
      const stamp = Number(getStr('blade.clock.weatherStamp') || '0');
      if (saved && Date.now() - stamp < 3600e3) return saved;   // кэш на час
    } catch (e) {}
    return '';
  }

  async function fetchWeather(force) {
    if (!force) {
      const cached = cachedWeather();
      if (cached) { lastWeather = cached; return; }   // кэш на час
    }
    try {
      const geo = await resolveCoords();
      lastCity = geo.city;
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + geo.lat +
        '&longitude=' + geo.lon + '&current=temperature_2m,weather_code' +
        '&daily=temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto';
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await resp.json();
      const t = Math.round(data.current.temperature_2m);
      lastWeather = (t > 0 ? '+' : '') + t + '°';
      // WMO-код -> вид атмосферы для «живого» newtab (осадки/звёзды/туман):
      // публикуем БУЛЕВЫ префы blade.weather.<kind> — хуки для @media -moz-pref
      // в userContent.css (тот же механизм, что у тем/фонов, холодный старт ок)
      const wc = (data.current && typeof data.current.weather_code === 'number')
        ? data.current.weather_code : 0;
      const kind = weatherKind(wc);
      lastKind = kind;
      // прогноз на 3 дня: [ { d, max, min } x 3 ] — absent/короткий daily = null
      let forecast = null;
      try {
        const daily = data.daily;
        if (daily && Array.isArray(daily.time) && daily.time.length >= 3 &&
            Array.isArray(daily.temperature_2m_max) && Array.isArray(daily.temperature_2m_min)) {
          forecast = [];
          for (let i = 0; i < 3; i++) {
            forecast.push({
              d: new Date(daily.time[i]).toLocaleDateString('ru-RU', { weekday: 'short' }),
              max: Math.round(daily.temperature_2m_max[i]),
              min: Math.round(daily.temperature_2m_min[i])
            });
          }
        }
      } catch (e) {}
      try {
        setStr('blade.clock.weather', lastWeather);
        setStr('blade.clock.weatherStamp', String(Date.now()));
        if (forecast) {
          setStr('blade.clock.forecast', JSON.stringify(forecast));
          setStr('blade.clock.forecastStamp', String(Date.now()));   // TTL как у погоды — 1 час
        }
        // публикуем вид погоды для CSS-атмосферы newtab
        for (const k of WEATHER_KINDS) Services.prefs.clearUserPref('blade.weather.' + k);
        Services.prefs.setBoolPref('blade.weather.' + kind, true);
      } catch (e) {}
      // живое обновление hero-страницы, если шина уже есть
      try {
        if (window.Blade && window.Blade.bus)
          window.Blade.bus.emit('clock:weather', { weather: lastWeather, city: lastCity, forecast: forecast, kind: kind });
      } catch (e) {}
    } catch (e) { /* сеть легла — показываем кэш/пусто */ }
  }

  try {
    lastWeather = cachedWeather();
    // стартовая загрузка с задержкой: не спорим со стартапом окна
    setTimeout(() => fetchWeather(), 15000);

    let CustomizableUI = null;
    try { CustomizableUI = window.CustomizableUI; } catch (e0) {}
    if (!CustomizableUI) {
      try { CustomizableUI = ChromeUtils.importESModule('resource:///modules/CustomizableUI.sys.mjs').CustomizableUI; } catch (e1) {}
    }
    if (!CustomizableUI) return;

    // интервал только после CUI-гварда и со снятием на unload:
    // раньше создавался в каждом окне до гварда и не гасился никогда
    const weatherTimer = setInterval(() => fetchWeather(), 30 * 60e3);   // каждые 30 минут
    window.addEventListener('unload', () => clearInterval(weatherTimer));

    // Криминалистика 1.9.2 (11 рестартов): CustomizableUI в FF155 не строит
    // узел для позднерегистрируемого custom-виджета (placement живёт, узла нет;
    // onBuild не вызывается; состояние раскладки теряет виджет). Движок сам
    // добавляет служебные кнопки (taskbar-tabs, smartwindow) ПРЯМО в #nav-bar
    // мимо CUI — делаем так же: нативный DOM, ноль CustomizableUI.
    function makeNode(doc) {
      const btn = doc.createXULElement('toolbarbutton');
      btn.id = WIDGET_ID;
      // БЕЗ toolbarbutton-1: этот класс в навбаре включает icon-only режим -
      // лейбл скрывается, иконки нет -> невидимый слот (раунд 12). Рабочий
      // рецепт исходных часов: бесклассовая кнопка + HTML-спаны текста
      const span = doc.createElementNS('http://www.w3.org/1999/xhtml', 'span');
      span.className = 'blade-clock-text';
      const glyph = doc.createElementNS('http://www.w3.org/1999/xhtml', 'span');
      glyph.className = 'blade-weather-glyph';
      btn.appendChild(glyph);
      btn.appendChild(span);
      const update = () => {
        const weatherPart = lastWeather ? (lastCity ? lastCity + ' ' : '') + lastWeather : '';
        const text = weatherPart ? timeString() + '  ·  ' + weatherPart : timeString();
        const tt = 'Blade: часы и погода' + (lastCity ? ' (' + lastCity + ')' : '') +
          '. Свой город: преф blade.clock.cityQuery';
        const h = new Date().getHours();
        const night = (h >= 22 || h < 6);
        // A10: глиф погоды в начале label; ясной ночью — звёзды
        let g = WEATHER_GLYPHS[currentKind()] || '';
        if (g === '☀' && night) g = '✨';
        // глиф живёт только в своём спане (дубль в тексте убран, раунд 13)
        if (span.textContent !== text) span.textContent = text;
        if (glyph.textContent !== g) glyph.textContent = g;
        if (btn.getAttribute('tooltiptext') !== tt) btn.setAttribute('tooltiptext', tt);
        // Ночная забота (22:00-6:00): атрибут красит хром живьём, преф -
        // контент через @media -moz-pref. Пишем только при смене состояния
        try {
          const de = doc.documentElement;
          if (de.hasAttribute('data-blade-night') !== night) {
            if (night) de.setAttribute('data-blade-night', '1');
            else de.removeAttribute('data-blade-night');
          }
          if (Services.prefs.getBoolPref('blade.night', false) !== night)
            Services.prefs.setBoolPref('blade.night', night);
        } catch (e) {}
      };
      update();
      const tick = setInterval(update, 10e3);
      doc.defaultView.addEventListener('unload', () => clearInterval(tick));
      btn.addEventListener('click', () => fetchWeather(true));
      return btn;
    }

    // Вставка: до кнопки переполнения ("...") в конце навбара; в каждом окне
    function mountClock() {
      try {
        const doc = window.document;
        if (doc.getElementById(WIDGET_ID)) return;
        const nav = doc.getElementById('nav-bar');
        if (!nav) return;
        const btn = makeNode(doc);
        const anchor = doc.getElementById('nav-bar-overflow-button');
        if (anchor && anchor.parentElement === nav) nav.insertBefore(btn, anchor);
        else nav.appendChild(btn);
      } catch (e) {
        try {
          const d2 = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
          d2.append('JS'); d2.append('clock_mark.txt');
          IOUtils.writeUTF8(d2.path, 'v2.5.2 MOUNT_ERR ' + e).catch(() => {});
        } catch (e3) {}
      }
    }
    mountClock();
    // Навбар мог ещё не существовать на DOMContentLoaded - страховка
    setTimeout(mountClock, 1500);
    setTimeout(mountClock, 5000);
  } catch (e) {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('clock_mark.txt');
      IOUtils.writeUTF8(d.path, 'v2.5.2 ERR ' + e).catch(() => {});
    } catch (e2) {}
  }
})();
