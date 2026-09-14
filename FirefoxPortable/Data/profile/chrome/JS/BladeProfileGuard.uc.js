// ==UserScript==
// @name            BladeProfileGuard
// @description     Страж голого запуска: firefox.exe БЕЗ -profile (автозагрузка,
//                  пин таскбара, двойной клик) резолвится через
//                  %APPDATA%\Mozilla\Firefox\profiles.ini по секции
//                  [Install<ХЭШ>] (ХЭШ = CityHash64 пути каталога движка,
//                  формат движка — %llX, UTF-16LE байты пути). Нет секции —
//                  движок создаёт СВЕЖИЙ «обычный Firefox» профиль. Страж один
//                  раз за сессию (через 15 c — не мешаем стартовой записи
//                  profiles.ini самим движком) идемпотентно обеспечивает:
//                  [Install<ХЭШ>] Default/Locked=1, [ProfileN] с нашим Path и
//                  секцию в installs.ini. Чужие секции/профили НЕПРИКОСНОВЕННЫ.
//                  Fail-soft: любая ошибка — mark, браузер не валится.
//                  Хэш-порт проверен по живым парам (cityhash_blade.py).
// @author          Blade-Creations
// @include         main
// @version         1.0.3
// @loadOrder       20
// ==/UserScript==
(function () {
  if (window.BladeProfileGuard) return;
  window.BladeProfileGuard = true;

  const SCRIPT_VERSION = '1.0.3';

  const mark = (m, e) => {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('BladeProfileGuard_mark.txt');
      IOUtils.writeUTF8(d.path, 'v' + SCRIPT_VERSION + ' ' + m + (e ? ' ' + e : '')).catch(() => {});
    } catch (e2) {}
  };

  // ===== CityHash64 v1.0 (Mozilla-vendored: other-licenses/nsis/Contrib/CityHash) =====
  // Порт cityhash_blade.py 1:1. BigInt обязателен: 64-битные умножения
  // в Number теряют точность. Формат хэша движка — %llX (верхний регистр,
  // БЕЗ ведущих нулей, см. commonupdatedir.cpp GetInstallHash).
  const K0 = 0xC3A5C85C97CB3127n;
  const K1 = 0xB492B66FBE98F273n;
  const K2 = 0x9AE16A3B2F90404Fn;
  const K3 = 0xC949D7C7509E6557n;
  const KMUL = 0x9DDFEA08EB382D69n;

  const u64 = (x) => BigInt.asUintN(64, x);

  const load64 = (s, i) =>
    u64(BigInt(s[i]) | (BigInt(s[i + 1]) << 8n) | (BigInt(s[i + 2]) << 16n) |
        (BigInt(s[i + 3]) << 24n) | (BigInt(s[i + 4]) << 32n) | (BigInt(s[i + 5]) << 40n) |
        (BigInt(s[i + 6]) << 48n) | (BigInt(s[i + 7]) << 56n));

  const load32 = (s, i) =>
    BigInt(s[i]) | (BigInt(s[i + 1]) << 8n) | (BigInt(s[i + 2]) << 16n) | (BigInt(s[i + 3]) << 24n);

  const rot = (val, shift) => {
    if (shift === 0) return val;
    const s = BigInt(shift);
    return u64((val >> s) | (val << (64n - s)));
  };

  // rot без нулевого сдвига (длина 9..16 всегда > 0)
  const rot1 = (val, shift) => {
    const s = BigInt(shift);
    return u64((val >> s) | (val << (64n - s)));
  };

  const mix = (val) => val ^ (val >> 47n);

  const hash128to64 = (u, v) => {
    let a = u64((u ^ v) * KMUL);
    a ^= a >> 47n;
    let b = u64((v ^ a) * KMUL);
    b ^= b >> 47n;
    return u64(b * KMUL);
  };

  const hash16 = (u, v) => hash128to64(u, v);

  const hash0to16 = (s) => {
    const ln = s.length;
    if (ln > 8) {
      const a = load64(s, 0);
      const b = load64(s, ln - 8);
      return u64(hash16(a, rot1(u64(b + BigInt(ln)), ln)) ^ b);
    }
    if (ln >= 4) {
      const a = load32(s, 0);
      return hash16(BigInt(ln) + (a << 3n), load32(s, ln - 4));
    }
    if (ln > 0) {
      const a = BigInt(s[0]);
      const b = BigInt(s[ln >> 1]);
      const c = BigInt(s[ln - 1]);
      const y = a + (b << 8n);
      const z = BigInt(ln) + (c << 2n);
      return u64(u64(mix(u64((y * K2) ^ (z * K3)))) * K2);
    }
    return K2;
  };

  const hash17to32 = (s) => {
    const ln = s.length;
    const a = u64(load64(s, 0) * K1);
    const b = load64(s, 8);
    const c = u64(load64(s, ln - 8) * K2);
    const d = u64(load64(s, ln - 16) * K0);
    return hash16(
      u64(rot(u64(a - b), 43) + rot(c, 30) + d),
      u64(a + rot(u64(b ^ K3), 20) - c + BigInt(ln)));
  };

  const weak32 = (w, x, y, z, a, b) => {
    a = u64(a + w);
    b = rot(u64(b + a + z), 21);
    const c = a;
    a = u64(a + x);
    a = u64(a + y);
    b = u64(b + rot(a, 44));
    return [u64(a + z), u64(b + c)];
  };

  const weak32s = (s, off, a, b) =>
    weak32(load64(s, off), load64(s, off + 8), load64(s, off + 16), load64(s, off + 24), a, b);

  const hash33to64 = (s) => {
    const ln = s.length;
    let z = load64(s, 24);
    let a = u64(load64(s, 0) + u64((BigInt(ln) + load64(s, ln - 16)) * K0));
    let b = rot(u64(a + z), 52);
    let c = rot(a, 37);
    a = u64(a + load64(s, 8));
    c = u64(c + rot(a, 7));
    a = u64(a + load64(s, 16));
    const vf = u64(a + z);
    const vs = u64(b + rot(a, 31) + c);
    a = u64(load64(s, 16) + load64(s, ln - 32));
    z = load64(s, ln - 8);
    b = rot(u64(a + z), 52);
    c = rot(a, 37);
    a = u64(a + load64(s, ln - 24));
    c = u64(c + rot(a, 7));
    a = u64(a + load64(s, ln - 16));
    const wf = u64(a + z);
    const ws = u64(b + rot(a, 31) + c);
    const r = mix(u64(u64((vf + ws) * K2) + u64((wf + vs) * K0)));
    return u64(u64(mix(u64((r * K0) + vs)) * K2));
  };

  const cityHash64 = (s) => {
    const len0 = s.length;
    if (len0 <= 32) return len0 <= 16 ? hash0to16(s) : hash17to32(s);
    if (len0 <= 64) return hash33to64(s);

    let x = load64(s, 0);
    let y = u64(load64(s, len0 - 16) ^ K1);
    let z = u64(load64(s, len0 - 56) ^ K0);
    let v = weak32s(s, len0 - 64, BigInt(len0), y);
    let w = weak32s(s, len0 - 32, u64(BigInt(len0) * K1), K0);
    z = u64(z + u64(mix(v[1]) * K1));
    x = u64(rot(u64(z + x), 39) * K1);
    y = u64(rot(y, 33) * K1);

    // хвост: ((длина-1) & ~63) байт чанками по 64
    let ln = (len0 - 1) & ~63;
    let i = 0;
    for (;;) {
      x = u64(rot(u64(x + y + v[0] + load64(s, i + 16)), 37) * K1);
      y = u64(rot(u64(y + v[1] + load64(s, i + 48)), 42) * K1);
      x ^= w[1];
      y ^= v[0];
      z = rot(u64(z ^ w[0]), 33);
      v = weak32s(s, i, u64(v[1] * K1), u64(x + w[0]));
      w = weak32s(s, i + 32, u64(z + w[1]), y);
      const t = z; z = x; x = t;
      i += 64;
      ln -= 64;
      if (ln === 0) break;
    }
    return hash16(
      u64(hash16(v[0], w[0]) + u64(mix(y) * K1) + z),
      u64(hash16(v[1], w[1]) + x));
  };

  // Кодирование пути в UTF-16LE (charCodeAt — кодовые unit'ы, суррогаты — пары)
  const utf16leBytes = (str) => {
    const out = new Uint8Array(str.length * 2);
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      out[i * 2] = c & 0xFF;
      out[i * 2 + 1] = c >> 8;
    }
    return out;
  };

  const installHashHex = (dirPath) =>
    cityHash64(utf16leBytes(dirPath)).toString(16).toUpperCase();

  // ===== Мини-редактор INI =====
  // Простой построчный парсер — движковые API профилей сознательно не используем.
  // Каждая операция пересканирует секции: файлы крошечные, зато индексы
  // никогда не протухают после вставок. Чужие строки не переформатировать.
  const makeIni = (text) => {
    const lines = text === '' ? [] : text.split(/\r\n|\r|\n/);
    let changed = false;

    const allSections = () => {
      const out = [];
      let cur = null;
      for (let i = 0; i < lines.length; i++) {
        const m = /^\s*\[([^\]]*)\]/.exec(lines[i]);
        if (m) {
          if (cur) cur.end = i;
          cur = { name: m[1].trim(), start: i, end: lines.length };
          out.push(cur);
        }
      }
      return out;
    };

    const findSection = (name) => {
      const want = name.toLowerCase();
      for (const s of allSections()) if (s.name.toLowerCase() === want) return s;
      return null;
    };

    const findKeyLine = (sec, key) => {
      const want = key.toLowerCase();
      for (let i = sec.start + 1; i < sec.end; i++) {
        const eq = lines[i].indexOf('=');
        if (eq >= 0 && lines[i].slice(0, eq).trim().toLowerCase() === want) return i;
      }
      return -1;
    };

    const setKey = (sec, key, value) => {
      const line = key + '=' + value;
      const i = findKeyLine(sec, key);
      if (i >= 0) {
        if (lines[i] !== line) { lines[i] = line; changed = true; }
        return;
      }
      // вставка после последней содержательной строки секции (пустые-разделители не рвём)
      let at = sec.end;
      while (at > sec.start + 1 && lines[at - 1].trim() === '') at--;
      lines.splice(at, 0, line);
      changed = true;
    };

    const getKeyValue = (sec, key) => {
      const i = findKeyLine(sec, key);
      if (i < 0) return null;
      return lines[i].slice(lines[i].indexOf('=') + 1).trim();
    };

    const appendSection = (name, kv) => {
      const last = lines[lines.length - 1];
      if (last !== undefined && last.trim() !== '') lines.push('');
      lines.push('[' + name + ']');
      for (const k of Object.keys(kv)) lines.push(k + '=' + kv[k]);
      changed = true;
    };

    return { allSections, findSection, setKey, getKeyValue, appendSection,
             // завершающий \r\n — как пишут движковые INI-файлы
             changed: () => changed, text: () => lines.join('\r\n') + (lines.length ? '\r\n' : '') };
  };

  // Идемпотентная прошивка profiles.ini: [Install<ХЭШ>] Default/Locked=1
  // и [ProfileN] с нашим Path (найти по Path, иначе следующий свободный N)
  const ensureProfilesIni = (text, hash, profDir) => {
    const ini = makeIni(text);
    const installName = 'Install' + hash;

    const sec = ini.findSection(installName);
    if (!sec) ini.appendSection(installName, { Default: profDir, Locked: '1' });
    else { ini.setKey(sec, 'Default', profDir); ini.setKey(sec, 'Locked', '1'); }

    const profRe = /^profile(\d+)$/i;
    const profDirLower = profDir.toLowerCase();
    let have = false;
    for (const s of ini.allSections()) {
      if (profRe.test(s.name) && (ini.getKeyValue(s, 'Path') || '').toLowerCase() === profDirLower) {
        have = true;
        break;
      }
    }
    if (!have) {
      // Движок перебирает Profile0, Profile1, ... ПОДРЯД и ОБРЫВАЕТСЯ на первом
      // пропуске (nsToolkitProfileService: GetString IsRelative → NS_FAILED ⇒
      // break; секции за дыркой движку НЕВИДИМЫ — живой тест 2026-09-14:
      // удалённые Profile0-2 → менеджер профилей). Поэтому номер новой секции =
      // НАИМЕНЬШИЙ свободный: заодно занимаем чужие дырки, ничего не
      // перенумеровывая и не удаляя (баг-фикс 1.0.2; maxN+1 сохранял пропуск).
      const taken = new Set();
      for (const s of ini.allSections()) {
        const m = profRe.exec(s.name);
        if (m) taken.add(parseInt(m[1], 10));
      }
      let n = 0;
      while (taken.has(n)) n++;
      ini.appendSection('Profile' + n,
        { Name: 'Blade', IsRelative: '0', Path: profDir });
    }
    return ini;
  };

  // installs.ini: секция [<ХЭШ>] Default/Locked=1 (файла может не быть)
  const ensureInstallsIni = (text, hash, profDir) => {
    const ini = makeIni(text || '');
    const sec = ini.findSection(hash);
    if (!sec) ini.appendSection(hash, { Default: profDir, Locked: '1' });
    else { ini.setKey(sec, 'Default', profDir); ini.setKey(sec, 'Locked', '1'); }
    return ini;
  };

  // Бэкап ровно один раз: пока blade-bak нет, текущее содержимое уходит туда целиком
  const backupOnce = async (path, bakPath) => {
    try {
      await IOUtils.stat(bakPath);
      return; // бэкап уже есть — не перезаписываем (храним исходник)
    } catch (e) { /* файла нет — создаём ниже */ }
    const bytes = await IOUtils.read(path);
    await IOUtils.write(bakPath, bytes);
  };

  // P2-аудит (1.0.3): пути попадают в ЗНАЧЕНИЯ ini — перевод строки в пути
  // инъектирует секцию ([Injected]); dirsvc-пути чистые, но границу ввода
  // валидируем явно (конвенция fail-soft: режем, не падаем)
  const sanitizePath = (p) => (p || '').replace(/[\r\n]/g, '');

  // Атомарная запись: tmp-файл рядом, затем move поверх. В новых движках
  // алиаса writeAtomic нет — writeUTF8 с tmpPath даёт ту же семантику
  // (dom/chrome-webidl/IOUtils.webidl). tmp уникален per-process (P2-аудит:
  // два окна/процесса не дерутся за один tmp-файл).
  const atomicWrite = async (path, text) => {
    const opts = { tmpPath: path + '.' + Services.appinfo.processID + '.blade-tmp' };
    if (typeof IOUtils.writeAtomic === 'function') {
      await IOUtils.writeAtomic(path, new TextEncoder().encode(text), opts);
    } else {
      await IOUtils.writeUTF8(path, text, opts);
    }
  };

  async function run() {
    // Каталог движка = РОДИТЕЛЬ firefox.exe — именно его хэширует сам движок
    // (nsXREDirProvider::GetInstallHash: XRE_EXECUTABLE_FILE → GetParent).
    // Первичный ключ XREExeF (nsIFile на сам exe, берём .parent); фолбэк
    // GreBinD (корень движка, где xul.dll — тоже каталог exe).
    // XCurProcD из цепочки УБРАН (баг-фикс 1.0.1): на stage-движке он
    // возвращает ...\browser (подкаталог с browser/omni.ja), хэш от него
    // движок не ищет — живой тест 2026-09-14 дал мусорную секцию
    // 5BF0C4DCA731B12E вместо 5429A0681078FC6F.
    let engineDir = null;
    try {
      const exe = Services.dirsvc.get('XREExeF', Ci.nsIFile);
      if (exe && exe.parent) engineDir = exe.parent.path;
    } catch (e) {}
    if (!engineDir) {
      try { engineDir = Services.dirsvc.get('GreBinD', Ci.nsIFile).path; } catch (e) {}
    }
    if (!engineDir) { mark('ERR no-engine-dir'); return; }
    engineDir = sanitizePath(engineDir);

    // Каталог профиля
    let profDir = null;
    try { profDir = Services.dirsvc.get('ProfD', Ci.nsIFile).path; } catch (e) {}
    if (!profDir) { mark('ERR no-profile-dir'); return; }
    profDir = sanitizePath(profDir);

    // %APPDATA%\Mozilla\Firefox (проверено на живой машине); при отсутствии
    // Services.env — фолбэк на XPCOM-контракт nsIEnvironment
    let appDataFF = null;
    try {
      const ad = Services.env.get('APPDATA');
      if (ad) appDataFF = ad + '\\Mozilla\\Firefox';
    } catch (e) {}
    if (!appDataFF) {
      try {
        const env = Cc['@mozilla.org/process/environment;1'].getService(Ci.nsIEnvironment);
        const ad = env.get('APPDATA');
        if (ad) appDataFF = ad + '\\Mozilla\\Firefox';
      } catch (e) {}
    }
    if (!appDataFF) { mark('ERR no-appdata'); return; }

    const profilesIniPath = appDataFF + '\\profiles.ini';
    const installsIniPath = appDataFF + '\\installs.ini';

    // profiles.ini обязателен: нет файла — чужая машина Firefox, не нам его создавать
    let profilesText = null;
    try { profilesText = await IOUtils.readUTF8(profilesIniPath); }
    catch (e) { mark('SKIP no-ini'); return; }

    try {
      const hash = installHashHex(engineDir);

      // 1.0.3: угон Default при явном -profile (дев/клон/стенд на боевом
      // движке перепривязывали инсталл на временный профиль; живой инцидент
      // 2026-09-14 — [InstallD0DD9ACE] уехал на %TEMP%-клон, следующий голый
      // запуск ушёл бы в свежий сток). Гвард-условие как у движкового autoseed:
      // если в [Install<ХЭШ>] уже записан ДРУГОЙ путь и он СУЩЕСТВУЕТ на диске —
      // это явный -profile (дев/чужой профиль) — НЕ перебиваем, выходим целиком
      // (и installs.ini не трогаем: его Default связан с тем же инсталлом).
      // Отсутствующий/сломанный Default по-прежнему лечится прошивкой ниже.
      const curIni = makeIni(profilesText);
      const curInstall = curIni.findSection('Install' + hash);
      if (curInstall) {
        const recorded = curIni.getKeyValue(curInstall, 'Default');
        if (recorded && recorded.toLowerCase() !== profDir.toLowerCase()) {
          let recordedExists = false;
          try { await IOUtils.stat(recorded); recordedExists = true; } catch (e) {}
          if (recordedExists) { mark('OK install skip foreign ' + recorded); return; }
        }
      }

      const profilesIni = ensureProfilesIni(profilesText, hash, profDir);
      if (profilesIni.changed()) {
        await backupOnce(profilesIniPath, profilesIniPath + '.blade-bak');
        await atomicWrite(profilesIniPath, profilesIni.text());
      }

      let installsText = '';
      try { installsText = await IOUtils.readUTF8(installsIniPath); }
      catch (e) { installsText = ''; } // файла нет — создадим с нашей секцией

      const installsIni = ensureInstallsIni(installsText, hash, profDir);
      if (installsIni.changed()) {
        if (installsText !== '') await backupOnce(installsIniPath, installsIniPath + '.blade-bak');
        await atomicWrite(installsIniPath, installsIni.text());
      }

      mark('OK ' + hash +
           (profilesIni.changed() ? ' profiles-updated' : ' profiles-ok') +
           (installsIni.changed() ? ' installs-updated' : ' installs-ok'));
    } catch (e) { mark('ERR ' + e); }
  }

  // Один прогон на сессию: работаем только в самом старом окне браузера,
  // остальные копии скрипта молча выходят (mark пишет первое окно)
  try {
    const en = Services.wm.getEnumerator('navigator:browser');
    if (en.hasMoreElements() && en.getNext() !== window) return;
  } catch (e) { /* сбой перечисления не глушит стража — операция идемпотентна */ }

  // Задержка 15 c: не мешаем стартовой записи profiles.ini самим движком
  window.setTimeout(() => { run(); }, 15000);
})();
