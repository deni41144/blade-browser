// skip 1st line
try {

  let cmanifest = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties).get('UChrm', Ci.nsIFile);
  cmanifest.append('utils');
  cmanifest.append('chrome.manifest');

  if(cmanifest.exists()){
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(cmanifest);
    ChromeUtils.importESModule('chrome://userchromejs/content/boot.sys.mjs');
  }

} catch(ex) {};

pref("blade.debug.loader", "RAN");

// ============================================================================
// BLADE AUTOSEED (2026-09-14, «у друга нет клинка»): свежая распаковка Full-zip
// БЕЗ Setup-сидинга → голый запуск firefox.exe (автозагрузка/пин/двойной клик)
// не находит секцию [Install<ХЭШ>] в %APPDATA%\Mozilla\Firefox\profiles.ini →
// движок создаёт ПУСТОЙ профиль → uc.js/гвард недоступны (замкнутый круг).
// config.js исполняется при каждом старте ЛЮБОГО профиля — сеем секцию сами
// и перезапускаемся в правильный профиль. Аргументы узнаём через observer
// 'command-line-startup' (XRE_PROFILE_PATH при -profile НЕ ставится —
// верифицировано по nsAppRunner/nsToolkitProfileService: env только в
// рестарт-ветках, флаг -profile парсится напрямую из argv). Полностью
// fail-soft: любая ошибка не должна ломать autoconfig/uc.js-загрузку.
// ============================================================================
try {
  (function bladeAutoSeed() {
    // В autoconfig-контексте Services/Cc/Ci/Cu — уже глобальны (ими же
    // пользуется загрузчик fx-autoconfig выше); importESModule от GRE-URL
    // здесь НЕ резолвится (живой тест: «Missing chrome or resource URL»).
    const log = (m) => {
      try { Cu.reportError('[BladeAutoSeed] ' + m); } catch (e) {}
    };

    // ---- CityHash64 v1.0 (BigInt-порт cityhash_blade.py, как в гварде) ----
    const K0 = 0xC3A5C85C97CB3127n, K1 = 0xB492B66FBE98F273n;
    const K2 = 0x9AE16A3B2F90404Fn, K3 = 0xC949D7C7509E6557n;
    const KMUL = 0x9DDFEA08EB382D69n;
    const u64 = (x) => BigInt.asUintN(64, x);
    const ld64 = (s, i) => u64(BigInt(s[i]) | (BigInt(s[i+1]) << 8n) | (BigInt(s[i+2]) << 16n)
      | (BigInt(s[i+3]) << 24n) | (BigInt(s[i+4]) << 32n) | (BigInt(s[i+5]) << 40n)
      | (BigInt(s[i+6]) << 48n) | (BigInt(s[i+7]) << 56n));
    const ld32 = (s, i) => BigInt(s[i]) | (BigInt(s[i+1]) << 8n)
      | (BigInt(s[i+2]) << 16n) | (BigInt(s[i+3]) << 24n);
    const rot = (v, sh) => { if (!sh) return v; const s = BigInt(sh);
      return u64((v >> s) | (v << (64n - s))); };
    const mix = (v) => v ^ (v >> 47n);
    const h128 = (a, b) => { let x = u64((a ^ b) * KMUL); x ^= x >> 47n;
      let y = u64((b ^ x) * KMUL); y ^= y >> 47n; return u64(y * KMUL); };
    function city64(s) {
      const len = s.length;
      if (len <= 16) {
        if (len > 8) { const a = ld64(s, 0), b = ld64(s, len - 8);
          return u64(h128(a, rot(u64(b + BigInt(len)), len)) ^ b); }
        if (len >= 4) { const a = ld32(s, 0);
          return h128(BigInt(len) + (a << 3n), ld32(s, len - 4)); }
        if (len > 0) { const a = BigInt(s[0]), b = BigInt(s[len >> 1]), c = BigInt(s[len - 1]);
          return u64(u64(mix(u64((a + (b << 8n)) * K2 ^ (BigInt(len) + (c << 2n)) * K3))) * K2); }
        return K2;
      }
      if (len <= 32) {
        const a = u64(ld64(s, 0) * K1), b = ld64(s, 8);
        const c = u64(ld64(s, len - 8) * K2), d = u64(ld64(s, len - 16) * K0);
        return h128(u64(rot(u64(a - b), 43) + rot(c, 30) + d),
                    u64(a + rot(u64(b ^ K3), 20) - c + BigInt(len)));
      }
      const wk = (s, off, a, b) => {
        a = u64(a + ld64(s, off)); b = rot(u64(b + a + ld64(s, off + 24)), 21);
        const c = a; a = u64(a + ld64(s, off + 8)); a = u64(a + ld64(s, off + 16));
        b = u64(b + rot(a, 44)); return [u64(a + ld64(s, off + 24)), u64(b + c)];
      };
      if (len <= 64) {
        let z = ld64(s, 24);
        let a = u64(ld64(s, 0) + u64((BigInt(len) + ld64(s, len - 16)) * K0));
        let b = rot(u64(a + z), 52), c = rot(a, 37);
        a = u64(a + ld64(s, 8)); c = u64(c + rot(a, 7)); a = u64(a + ld64(s, 16));
        const vf = u64(a + z), vs = u64(b + rot(a, 31) + c);
        a = u64(ld64(s, 16) + ld64(s, len - 32)); z = ld64(s, len - 8);
        b = rot(u64(a + z), 52); c = rot(a, 37);
        a = u64(a + ld64(s, len - 24)); c = u64(c + rot(a, 7)); a = u64(a + ld64(s, len - 16));
        const wf = u64(a + z), ws = u64(b + rot(a, 31) + c);
        const r = mix(u64(u64((vf + ws) * K2) + u64((wf + vs) * K0)));
        return u64(u64(mix(u64((r * K0) + vs)) * K2));
      }
      // длинный путь (каталоги движков > 64 байт UTF-16LE — наш случай)
      let x = ld64(s, 0), y = u64(ld64(s, len - 16) ^ K1), z = u64(ld64(s, len - 56) ^ K0);
      let v = wk(s, len - 64, BigInt(len), y);
      let w = wk(s, len - 32, u64(BigInt(len) * K1), K0);
      z = u64(z + u64(mix(v[1]) * K1));
      x = u64(rot(u64(z + x), 39) * K1);
      y = u64(rot(y, 33) * K1);
      let tail = (len - 1) & ~63, i = 0;
      for (;;) {
        x = u64(rot(u64(x + y + v[0] + ld64(s, i + 16)), 37) * K1);
        y = u64(rot(u64(y + v[1] + ld64(s, i + 48)), 42) * K1);
        x ^= w[1]; y ^= v[0];
        z = rot(u64(z ^ w[0]), 33);
        v = wk(s, i, u64(v[1] * K1), u64(x + w[0]));
        w = wk(s, i + 32, u64(z + w[1]), y);
        const t = z; z = x; x = t;
        i += 64; tail -= 64;
        if (tail === 0) break;
      }
      return h128(u64(h128(v[0], w[0]) + u64(mix(y) * K1) + z),
                  u64(h128(v[1], w[1]) + x));
    }
    function installHash(exeDirPath) {
      const bytes = new Uint8Array(exeDirPath.length * 2);
      for (let i = 0; i < exeDirPath.length; i++) {
        const c = exeDirPath.charCodeAt(i);
        bytes[i * 2] = c & 0xFF; bytes[i * 2 + 1] = c >> 8;
      }
      return city64(bytes).toString(16).toUpperCase();
    }

    // ---- nsIFile текстовый I/O (IOUtils тут недоступен: не модуль/не окно) ----
    function readText(file) {
      const fis = Cc['@mozilla.org/network/file-input-stream;1']
        .createInstance(Ci.nsIFileInputStream);
      fis.init(file, -1, 0, 0);
      const cis = Cc['@mozilla.org/intl/converter-input-stream;1']
        .createInstance(Ci.nsIConverterInputStream);
      cis.init(fis, 'UTF-8', 8192, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
      let out = '', chunk = {};
      try {
        while (cis.readString(8192, chunk) > 0) out += chunk.value;
      } finally { cis.close(); fis.close(); }
      if (out.charCodeAt(0) === 0xFEFF) out = out.slice(1); // срезать BOM
      return out;
    }
    function writeTextAtomic(file, text) {
      // атомарность: tmp + moveTo поверх (NTFS rename)
      const tmp = file.parent.clone();
      tmp.append(file.leafName + '.blade-autoseed-tmp');
      const fos = Cc['@mozilla.org/network/file-output-stream;1']
        .createInstance(Ci.nsIFileOutputStream);
      fos.init(tmp, 0x02 | 0x08 | 0x20, 0o600, 0); // write|create|truncate
      const cos = Cc['@mozilla.org/intl/converter-output-stream;1']
        .createInstance(Ci.nsIConverterOutputStream);
      cos.init(fos, 'UTF-8', 0, Ci.nsIConverterOutputStream.DEFAULT_REPLACEMENT_CHARACTER);
      try { cos.writeString(text); } finally { cos.close(); fos.close(); }
      tmp.moveTo(file.parent, file.leafName);
    }

    // ---- мини-INI (как в гварде: пересканирование, чужое не трогаем) ----
    function iniEdit(text) {
      const lines = text === '' ? [] : text.split(/\r\n|\r|\n/);
      let changed = false;
      const sections = () => {
        const out = []; let cur = null;
        for (let i = 0; i < lines.length; i++) {
          const m = /^\s*\[([^\]]*)\]/.exec(lines[i]);
          if (m) { if (cur) cur.end = i;
            cur = { name: m[1].trim(), start: i, end: lines.length }; out.push(cur); }
        }
        return out;
      };
      const find = (name) => {
        const want = name.toLowerCase();
        for (const s of sections()) if (s.name.toLowerCase() === want) return s;
        return null;
      };
      const keyLine = (sec, key) => {
        const want = key.toLowerCase();
        for (let i = sec.start + 1; i < sec.end; i++) {
          const eq = lines[i].indexOf('=');
          if (eq >= 0 && lines[i].slice(0, eq).trim().toLowerCase() === want) return i;
        }
        return -1;
      };
      const setKey = (sec, key, value) => {
        const line = key + '=' + value;
        const i = keyLine(sec, key);
        if (i >= 0) { if (lines[i] !== line) { lines[i] = line; changed = true; } return; }
        let at = sec.end;
        while (at > sec.start + 1 && lines[at - 1].trim() === '') at--;
        lines.splice(at, 0, line); changed = true;
      };
      const getVal = (sec, key) => {
        const i = keyLine(sec, key);
        return i < 0 ? null : lines[i].slice(lines[i].indexOf('=') + 1).trim();
      };
      const append = (name, kv) => {
        const last = lines[lines.length - 1];
        if (last !== undefined && last.trim() !== '') lines.push('');
        lines.push('[' + name + ']');
        for (const k of Object.keys(kv)) lines.push(k + '=' + kv[k]);
        changed = true;
      };
      return { sections, find, setKey, getVal, append,
               changed: () => changed, text: () => lines.join('\r\n') + (lines.length ? '\r\n' : '') };
    }

    // ---- основная логика (вызывается из command-line-startup) ----
    function onCommandLine(cmdLine) {
      const exeFile = Services.dirsvc.get('XREExeF', Ci.nsIFile);
      const exeDir = exeFile.parent;
      let root = null;
      let bladeProfile = null;
      for (let d = exeDir, hops = 0; d && hops < 3; d = d.parent, hops++) {
        const cand = d.clone();
        cand.append('Data'); cand.append('profile');
        if (cand.exists() && cand.isDirectory()) { root = d; bladeProfile = cand; break; }
      }
      if (!bladeProfile) return; // рядом нет Data\profile — не дистрибутив Blade

      const bladePath = bladeProfile.path;
      const hash = installHash(exeDir.path);

      const appData = Services.env.get('APPDATA');
      if (!appData) return;
      const ffDir = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
      ffDir.initWithPath(appData);
      ffDir.append('Mozilla'); ffDir.append('Firefox');
      const profilesIni = ffDir.clone(); profilesIni.append('profiles.ini');
      const installsIni = ffDir.clone(); installsIni.append('installs.ini');
      if (!profilesIni.exists()) return; // нет Firefox-конфигурации — не нам её создавать

      const ini = iniEdit(readText(profilesIni));
      const installName = 'Install' + hash;
      const sec = ini.find(installName);
      const okAlready = sec && ini.getVal(sec, 'Default') === bladePath;

      const curProfile = Services.dirsvc.get('ProfD', Ci.nsIFile);
      const inBlade = curProfile.path.toLowerCase() === bladePath.toLowerCase();

      // ГВАРД ЯВНОГО ПРОФИЛЯ: command-line-startup даёт ПУСТУЮ командную строку
      // (живой тест: length=0, findFlag=-1) — флаги движок разбирает раньше.
      // Надёжный сигнал: текущий профиль ОТЛИЧАЕТСЯ от Default уже записанной
      // секции [Install<ХЭШ>] => юзер запустился с -profile/-p (дев-запуски,
      // чужой профиль) — НЕ перебиваем, ничего не сеем. Секции не было
      // (fresh-дистрибутив) или Default невен — это голый запуск, лечим.
      if (sec) {
        const recorded = ini.getVal(sec, 'Default');
        if (recorded && recorded.toLowerCase() !== curProfile.path.toLowerCase()) {
          return; // явный -profile: чужой/дев-профиль — свято
        }
      }

      if (okAlready && inBlade) return; // голый запуск уже попал куда надо

      // сеем: [Install<ХЭШ>] + [ProfileN] (наименьший свободный) + installs.ini
      if (!okAlready) {
        if (!sec) ini.append(installName, { Default: bladePath, Locked: '1' });
        else { ini.setKey(sec, 'Default', bladePath); ini.setKey(sec, 'Locked', '1'); }

        const profRe = /^profile(\d+)$/i;
        const bladeLower = bladePath.toLowerCase();
        let have = false;
        const taken = [];
        for (const s of ini.sections()) {
          const m = profRe.exec(s.name);
          if (m) {
            taken.push(parseInt(m[1], 10));
            if ((ini.getVal(s, 'Path') || '').toLowerCase() === bladeLower) have = true;
          }
        }
        if (!have) {
          let n = 0;
          while (taken.indexOf(n) >= 0) n++;
          ini.append('Profile' + n,
            { Name: 'Blade', IsRelative: '0', Path: bladePath });
        }

        if (ini.changed()) {
          // бэкап ровно один раз
          const bak = ffDir.clone(); bak.append('profiles.ini.blade-bak');
          if (!bak.exists()) profilesIni.copyTo(ffDir, 'profiles.ini.blade-bak');
          writeTextAtomic(profilesIni, ini.text());
        }

        try {
          let instText = '';
          if (installsIni.exists()) instText = readText(installsIni);
          const iini = iniEdit(instText);
          const isec = iini.find(hash);
          if (!isec) iini.append(hash, { Default: bladePath, Locked: '1' });
          else { iini.setKey(isec, 'Default', bladePath); iini.setKey(isec, 'Locked', '1'); }
          if (iini.changed()) {
            const ibak = ffDir.clone(); ibak.append('installs.ini.blade-bak');
            if (instText !== '' && !ibak.exists())
              installsIni.copyTo(ffDir, 'installs.ini.blade-bak');
            writeTextAtomic(installsIni, iini.text());
          }
        } catch (e) { log('installs.ini: ' + e); }

        log('seeded ' + hash + ' -> ' + bladePath);
      }

      // рестарт в правильный профиль: только если сейчас мы НЕ в нём
      // (голый запуск успел выбрать пустой ДО сидинга). Окна ещё не открыты.
      // Цикл невозможен: новый процесс стартует с -profile => findFlag выше
      // сразу выйдет.
      if (!inBlade) {
        const proc = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
        proc.init(exeFile);
        proc.run(false, ['-profile', bladePath], 2);
        log('restarting into ' + bladePath);
        Cc['@mozilla.org/toolkit/app-startup;1']
          .getService(Ci.nsIAppStartup)
          .quit(Ci.nsIAppStartup.eAttemptQuit);
      }
    }

    // command-line-startup: топик только в main-процессе, subject = nsICommandLine.
    // Если топик уже прошёл (фоновые задачи/не браузер) — не сработает, это fail-soft.
    const observer = (subject) => {
      try { Services.obs.removeObserver(observer, 'command-line-startup'); } catch (e) {}
      try { onCommandLine(subject.QueryInterface(Ci.nsICommandLine)); }
      catch (e) { log('ERR ' + e); }
    };
    Services.obs.addObserver(observer, 'command-line-startup');
  })();
} catch (ex) {}
