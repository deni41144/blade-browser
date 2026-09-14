// ==UserScript==
// @name            Blade Lang
// @description     Сидинг langpack-ru из chrome\extensions: на патч-установках и
//                  свежих профилях скрабленный langpack-ru@firefox.mozilla.org.xpi
//                  лежит в поставке, но в профиль не установлен — в about:
//                  preferences -> Browser Language нет русского, UI английский
//                  (инцидент 2026-09-15 «в Browser Language нету русского»).
//                  Скрипт при старте сеет langpack в профиль через AddonManager,
//                  чтобы русский появился в списке языков настроек.
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       15
// ==/UserScript==
// loadOrder 15 — после BladeCore (5): window.Blade для mark-лога уже готов.
// Обычные скрипты (10) грузятся раньше, но этот от них не зависит.
(function () {
  if (window.BladeLang) return;

  const VER = 'v1.0.0';
  const LANGPACK_ID = 'langpack-ru@firefox.mozilla.org';

  // int-префы Firefox 32-битные: epoch-мс (~1.8e12) туда не влезает — храним
  // epoch-СЕКУНДЫ (влезает до 2038). Кулдаун 6ч: установку не долбим на каждом
  // старте — в т.ч. на старых движках, где скрабленная подпись гарантированно
  // отвергается (иначе каждый старт = новая бессмысленная попытка + ERR-марка).
  const COOLDOWN_SEC = 6 * 3600;
  // Пауза после старта, чтобы не мешать разогреву браузера (паттерн
  // BladeProfileGuard «в первом окне через 15с»; сидинг лёгкий — хватит 8с)
  const START_DELAY_MS = 8000;

  // ---- mark-файл blade_lang_mark.txt (перезапись, UChrm/JS) ----
  // Через Blade.mark из BladeCore; если ядро не поднялось — пишем сами
  // (паттерн BladeShield): диагностика не должна зависеть от ядра.
  function mark(ev) {
    try {
      if (window.Blade && window.Blade.mark) {
        window.Blade.mark('blade_lang', VER + ' ' + ev);
        return;
      }
    } catch (e) {}
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('blade_lang_mark.txt');
      IOUtils.writeUTF8(d.path, VER + ' ' + ev).catch(() => {});
    } catch (e) {}
  }

  function getInt(name, dflt) {
    try { return Services.prefs.getIntPref(name, dflt); } catch (e) { return dflt; }
  }
  function setInt(name, v) {
    try { Services.prefs.setIntPref(name, v); } catch (e) {}
  }

  function errText(e) {
    try { return String(e && e.message ? e.message : e); }
    catch (_) { return 'unknown'; }
  }

  // AddonManager в chrome-окне — глобаль (кладётся browser.js), как Services/Ci.
  // В проекте его до сих пор никто не трогал, поэтому страховка: если глобали
  // нет — прямой импорт ES-модуля (паттерн BladeShield с Timer.sys.mjs).
  function resolveAddonManager() {
    try {
      if (typeof AddonManager !== 'undefined' && AddonManager && AddonManager.getInstallForFile) {
        return AddonManager;
      }
    } catch (e) {}
    try {
      return ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs').AddonManager;
    } catch (e) {}
    return null;
  }

  async function seed() {
    try {
      // 1. langpack в поставке? chrome\extensions относительно UChrm. Нет —
      // патч собран без langpack, сидить нечего, молча выходим.
      const xpi = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      xpi.append('extensions');
      xpi.append(LANGPACK_ID + '.xpi');
      if (!xpi.exists()) {
        mark('NO xpi (патч без langpack)');
        return;
      }

      const AM = resolveAddonManager();
      if (!AM) { mark('ERR no AddonManager'); return; }

      // 2. Идемпотентность: уже установлен и активен — ничего не делаем.
      const addons = await AM.getAddonsByTypes(['locale']);
      if (addons.some(a => a && a.id === LANGPACK_ID && a.active)) {
        mark('OK installed');
        return;
      }

      // 3. Кулдаун ретраев: с последней попытки < 6 часов — выходим молча.
      const nowSec = Math.floor(Date.now() / 1000);
      const lastTry = getInt('blade.lang.lastTry', 0);
      if (lastTry > 0 && nowSec - lastTry < COOLDOWN_SEC) {
        mark('SKIP cooldown');
        return;
      }

      // 4. Фиксируем попытку ДО install, а не только при успехе: закрывает
      // гонку двух окон старта (второе увидит кулдаун, а не параллельную
      // установку) и гасит ретраи отвергнутой подписи до 6 часов.
      setInt('blade.lang.lastTry', nowSec);

      // 5. Установка. xpi скраблен (подпись сломана): движки Full 2.0.2+
      // (Langpack-хирургия omni) подпись langpack-ов не требуют, старые
      // движки отвергнут установку — это ожидаемо, см. catch ниже.
      let install = null;
      try {
        install = await AM.getInstallForFile(xpi);
      } catch (e) {
        const msg = errText(e);
        if (/sign/i.test(msg)) mark('ERR unsigned rejected (старый движок, нужен Full)');
        else mark('ERR getInstallForFile: ' + msg);
        return;
      }
      if (!install || install.state === AM.STATE_INSTALL_FAILED) {
        mark('ERR bad install state');
        return;
      }
      if (install.addon && install.addon.id !== LANGPACK_ID) {
        mark('ERR id mismatch: ' + install.addon.id);
        return;
      }
      try {
        await install.install();
        // Язык применяется после перезапуска — это нормально; сами браузер
        // НЕ перезапускаем (сидинг в профиль, а не силовая смена языка).
        mark('OK seeded, restart pending');
      } catch (e) {
        const msg = errText(e);
        if (/sign/i.test(msg)) mark('ERR unsigned rejected (старый движок, нужен Full)');
        else mark('ERR install: ' + msg);
      }
    } catch (e) {
      // fail-soft: любая ошибка сидинга не должна ронять браузер
      try { mark('ERR ' + errText(e)); } catch (e2) {}
    }
  }

  window.BladeLang = { version: '1.0.0' };

  try {
    window.setTimeout(seed, START_DELAY_MS);
  } catch (e) {}
})();
