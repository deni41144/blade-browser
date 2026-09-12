// ==UserScript==
// @name            Blade Clock
// @description     Часы + погода в тулбаре. Город определяется по IP (ipwho.is),
//                  можно задать вручную префом blade.clock.cityQuery. Ключей нет.
// @author          Blade-Creations
// @include         main
// @version         2.3.0
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

    function makeNode(doc) {
      const btn = doc.createXULElement('toolbarbutton');
      btn.id = WIDGET_ID;
      const span = doc.createElementNS('http://www.w3.org/1999/xhtml', 'span');
      span.className = 'blade-clock-text';
      // A10 «Клинок Живёт»: глиф погоды первым, текст часов/погоды — после
      const glyph = doc.createElementNS('http://www.w3.org/1999/xhtml', 'span');
      glyph.className = 'blade-weather-glyph';
      btn.appendChild(glyph);
      btn.appendChild(span);
      const update = () => {
        const weatherPart = lastWeather ? (lastCity ? lastCity + ' ' : '') + lastWeather : '';
        const text = weatherPart ? timeString() + '  ·  ' + weatherPart : timeString();
        const tt = 'Blade: часы и погода' + (lastCity ? ' (' + lastCity + ')' : '') +
          '. Свой город: преф blade.clock.cityQuery';
        // пишем DOM только при изменении: 5 тиков из 6 пишут те же строки
        if (span.textContent !== text) span.textContent = text;
        if (btn.getAttribute('tooltiptext') !== tt) btn.setAttribute('tooltiptext', tt);
        // Ночная забота (22:00–6:00): атрибут красит хром живьём, преф —
        // контент через @media -moz-pref. Пишем только при смене состояния
        const h = new Date().getHours();
        const night = (h >= 22 || h < 6);
        try {
          const de = doc.documentElement;
          if (de.hasAttribute('data-blade-night') !== night) {
            if (night) de.setAttribute('data-blade-night', '1');
            else de.removeAttribute('data-blade-night');
          }
          if (Services.prefs.getBoolPref('blade.night', false) !== night)
            Services.prefs.setBoolPref('blade.night', night);
        } catch (e) {}
        // A10: глиф погоды — тот же принцип «DOM только при изменении»,
        // что и у span выше; ясной ночью солнце превращается в звёзды
        let g = WEATHER_GLYPHS[currentKind()] || '';
        if (g === '☀' && night) g = '✨';
        if (glyph.textContent !== g) glyph.textContent = g;
      };
      update();
      const tick = setInterval(update, 10e3);   // обновление раз в 10 сек (легко)
      // таймер гасим при закрытии ИМЕННО ЭТОГО окна: makeNode вызывается для
      // каждого окна, а window в замыкании — всегда первое (Gemini: утечка)
      doc.defaultView.addEventListener('unload', () => clearInterval(tick));
      btn.addEventListener('click', () => fetchWeather(true));
      return btn;
    }

    // Защита от дублирования при повторном окне (Gemini раунд 24):
    // без getWidget + label createWidget падает с TypeError
    if (CustomizableUI.getWidget(WIDGET_ID)) return;

    CustomizableUI.createWidget({
      id: WIDGET_ID,
      type: 'custom',
      label: 'Blade Clock',
      tooltiptext: 'Часы и погода Blade',
      defaultArea: CustomizableUI.AREA_NAVBAR,
      onBuild: makeNode
    });
  } catch (e) {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('clock_mark.txt');
      IOUtils.writeUTF8(d.path, 'v2.3.0 ERR ' + e).catch(() => {});
    } catch (e2) {}
  }
})();
