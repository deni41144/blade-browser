// ==UserScript==
// @name            BladeShield
// @description     Сторож анти-детект списков uBlock Origin (волна «Страж» 1.2).
//                  Баг: ublock0.adminSettings (user.js) — НЕ рабочий канал в
//                  Firefox (uBO читает его через storage.managed, а тот в
//                  Gecko наполняется только из enterprise policies/реестра),
//                  поэтому после переустановки/сброса uBO списки откатываются
//                  к дефолту и анти-детект слой (awrl + annoyance-листы) теряется.
//                  ДОСТУП К БАЗЕ (v1.8): все пути через IndexedDB-движок
//                  (window.indexedDB / песочница wantGlobalProperties /
//                  IndexedDB.sys.mjs / ExtensionStorageIDB.open) дают UnknownErr
//                  от квота-менеджера — IDB-фабрика Firefox 155 отвергает
//                  openForPrincipal на moz-extension:// принципалы вне контекста
//                  самого расширения (7 итераций, вывод окончательный).
//                  Поэтому работаем НАПРЯМУЮ с sqlite-файлом storage.local uBO
//                  через mozStorage:
//                  <profile>/storage/default/moz-extension+++<uuid>^userContextId=4294967295/
//                  idb/3647222921wleabcEoxlt-eengsairo.sqlite
//                  (имя idb-файла стандартное для webExtensions-storage-local),
//                  таблица object_data, store 'storage-local-data' (id из
//                  object_store). Формат хранения разобран по живой базе и
//                  исходникам Firefox 155:
//                  - key — BLOB-обфускация uBO: байт 0x30 + (каждый байт UTF-8
//                    имени + 1): 'selectedFilterLists' -> b'0tfmfdufeGjmufsMjtut';
//                  - data — BLOB: snappy(structured clone). Кадр structured
//                    clone: 8-байтовые слова LE [tag:u32][data:u32];
//                    SCTAG_HEADER=0xFFF10000(scope=3), STRING=0xFFFF0004
//                    (data = длина | latin1<<31; байты + zero-pad до 8),
//                    ARRAY=0xFFFF0007 + элементы парами [INT32 индекс][STRING]
//                    + END_OF_KEYS=0xFFFF0013. uBO хранит selectedFilterLists
//                    как JS-массив, userSettings — latin1-строку с JSON.
//                    Кодек собран/проверен roundtrip byte-identical на живых
//                    блобах (см. CODEC-секцию); сжатие — snappy literal-only
//                    (валидный поток, читается штатным snappy Mozilla).
//                  Запись: UPDATE data по PK (object_store_id, key) внутри
//                  BEGIN IMMEDIATE; НЕ checkpoint/VACUUM — структуру не трогаем.
//                  Перед записью — бэкап оригинальных блобов (base64) в
//                  chrome\JS\BladeShield_backup.txt для ручного отката.
//                  uBO обновляет активные списки сам (autoUpdate=true +
//                  emergency update при возрасте >2). Списки пользователя
//                  не трогаем — только добавляем недостающие.
// @author          Bobliks-Creations
// @include         main
// @version         1.8.1
// @loadOrder       15
// @onlyonce
// ==/UserScript==
(function () {
  'use strict';

  const VER = 'v1.8.0';

  // ---- Эталонный набор (источник: user.js, adminSettings) ----
  // ВЕРСИЯ-ЗАВИСИМОСТЬ (uBO 1.74, assets.json): ключей awrl, adguard-annoyance
  // и ublock-annoyance в стоке НЕТ (удалены между 1.48 и 1.50) — их добавляем
  // как импортируемые URL; адреса проверены живыми (HTTP 200). Остальные ключи
  // существуют в стоке 1.74 (user-filters — внутренний ключ 1p-фильтров).
  const STOCK_LISTS = [
    'user-filters',
    'ublock-filters',
    'ublock-quick-fixes',
    'ublock-annoyances',           // «ublock-annoyance» в эталоне — опечатка старого ключа
    'ublock-badware',
    'ublock-privacy',
    'ublock-unbreak',
    'easylist',
    'easyprivacy',
    'adguard-generic',
    'adguard-social',
    'adguard-other-annoyances',    // «adguard-annoyance» (AdGuard 14) удалён из стока
  ];
  // Списки вне стока: импортируются по URL. Семантика uBO (js/storage.js,
  // getAvailableLists): URL из importedLists регистрируется как внешний
  // ассет с ключом = URL, и selectedFilterLists должен ссылаться на тот же
  // URL-ключ. awrl — Adblock Warning Removal List (анти-детект стен).
  const URL_LISTS = [
    'https://easylist-downloads.adblockplus.org/antiadblockfilters.txt', // awrl
    'https://filters.adtidy.org/extension/ublock/filters/14.txt',        // AdGuard Annoyances
  ];

  const UBO_ID = 'uBlock0@raymondhill.net';
  const STORE_NAME = 'storage-local-data';
  const DB_FILENAME = '3647222921wleabcEoxlt-eengsairo.sqlite';
  const USER_CONTEXT = '^userContextId=4294967295'; // webextStorageLocal (зарезервированный)

  // ---- Mark-файл (паттерн BladeBattery: первая строка v<ver> <event>) ----
  function mark(ev) {
    try {
      const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      d.append('JS'); d.append('BladeShield_mark.txt');
      IOUtils.writeUTF8(d.path, VER + ' ' + ev).catch(() => {});
    } catch (e) {}
  }

  // Найти активный WebExtensionPolicy uBO. WebExtensionPolicy — привилегированный
  // глобал (не экспортируется из ES-модулей), паттерн из aboutProcesses.js:
  // Cu.getGlobalForObject(Services). У активного расширения policy.uuid —
  // UUID moz-extension-принципала (совпадает с именем каталога storage/default).
  function uboPolicy() {
    try {
      const { WebExtensionPolicy } = Cu.getGlobalForObject(Services);
      const pol = WebExtensionPolicy.getByID(UBO_ID);
      if (pol && pol.active) return pol;
    } catch (e) {}
    return null;
  }

  // ================= CODEC =================
  // Snappy: varint(uncompressedLength) + блоки. Literal: тег&3==0, длина-1 в
  // верхних 6 битах (60..63 = длина-1 в следующих 1..4 байтах). Copy1:
  // тег&3==1, len=4+((tag>>2)&7), off=((tag>>5)<<8)|next. Copy2/4: тег&3==2/3,
  // len=(tag>>2)+1, off = LE u16/u32.
  function snappyDecompress(src) {
    let p = 0;
    function uvarint() {
      let v = 0, shift = 1;
      for (;;) {
        const b = src[p++];
        v += (b & 0x7f) * shift;
        if (!(b & 0x80)) return v;
        shift *= 128;
      }
    }
    const outLen = uvarint();
    const out = new Uint8Array(outLen);
    let o = 0;
    while (p < src.length) {
      const tag = src[p++];
      const type = tag & 3;
      if (type === 0) {
        let code = tag >> 2, len;
        if (code < 60) len = code + 1;
        else {
          const nb = code - 59; // 60->1 .. 63->4 байта длины
          len = 0;
          for (let i = 0; i < nb; i++) len += src[p++] * Math.pow(256, i);
          len += 1;
        }
        out.set(src.subarray(p, p + len), o);
        p += len; o += len;
      } else {
        let len, off;
        if (type === 1) {
          len = 4 + ((tag >> 2) & 0x7);
          off = ((tag >> 5) << 8) | src[p++];
        } else if (type === 2) {
          len = (tag >> 2) + 1;
          off = src[p] | (src[p + 1] << 8); p += 2;
        } else {
          len = (tag >> 2) + 1;
          off = (src[p] | (src[p + 1] << 8) | (src[p + 2] << 16) | (src[p + 3] << 24)) >>> 0; p += 4;
        }
        for (let i = 0; i < len; i++) { out[o] = out[o - off]; o++; }
      }
    }
    if (o !== outLen) throw new Error('snappy length mismatch');
    return out;
  }

  // Literal-only компрессор: валидный snappy без copy-блоков (наши объёмы —
  // сотни байт, разница с настоящим сжатием несущественна).
  function snappyCompressLiteral(data) {
    function varint(v) {
      const b = [];
      while (v >= 0x80) { b.push((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
      b.push(v);
      return b;
    }
    const parts = [new Uint8Array(varint(data.length))];
    let p = 0;
    while (p < data.length) {
      const chunk = Math.min(data.length - p, 0xffff);
      if (chunk <= 60) {
        parts.push(new Uint8Array([(chunk - 1) << 2]));
      } else {
        const l = chunk - 1;
        parts.push(new Uint8Array([(61 << 2), l & 0xff, (l >> 8) & 0xff]));
      }
      parts.push(data.subarray(p, p + chunk));
      p += chunk;
    }
    let total = 0;
    for (const part of parts) total += part.length;
    const out = new Uint8Array(total);
    let o = 0;
    for (const part of parts) { out.set(part, o); o += part.length; }
    return out;
  }

  // Structured clone кадр (SpiderMonkey, ForIndexedDB). Теги —
  // js/src/vm/StructuredClone.cpp (FIREFOX_155_0_RELEASE).
  const T_HEADER = 0xfff10000, T_STRING = 0xffff0004, T_INT32 = 0xffff0003,
        T_ARRAY = 0xffff0007, T_EOK = 0xffff0013;

  function scParse(frame) {
    if (frame.length < 16 || frame.length % 8) throw new Error('bad frame len');
    const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    let p = 0;
    const word = () => {
      const data = dv.getUint32(p, true), tag = dv.getUint32(p + 4, true);
      p += 8; return [tag, data];
    };
    const rdString = (data) => {
      const n = data & 0x3fffffff;
      if (data & 0x40000000) throw new Error('useBuffer frame unsupported');
      let s = '';
      if (data & 0x80000000) { // latin1
        for (let i = 0; i < n; i++) s += String.fromCharCode(frame[p + i]);
        p += n;
      } else {
        for (let i = 0; i < n; i++) s += String.fromCharCode(dv.getUint16(p + 2 * i, true));
        p += 2 * n;
      }
      p += (-p) & 7; // zero-pad до 8-байтовой границы (ComputePadding)
      return s;
    };
    const [hTag, scope] = word();
    if (hTag !== T_HEADER || scope !== 3) throw new Error('bad header');
    let [tag, data] = word();
    if (tag === T_STRING) {
      const s = rdString(data);
      if (p !== frame.length) throw new Error('trailing bytes');
      return { type: 'string', value: s };
    }
    if (tag !== T_ARRAY) throw new Error('expected ARRAY, got 0x' + tag.toString(16));
    const items = [];
    for (;;) {
      let [t1, d1] = word();
      if (t1 === T_EOK) break;
      if (t1 !== T_INT32) throw new Error('expected INT32');
      let [t2, d2] = word();
      if (t2 !== T_STRING) throw new Error('expected STRING');
      items.push(rdString(d2));
    }
    if (p !== frame.length) throw new Error('trailing bytes');
    return { type: 'array', items };
  }

  function scConcat(parts) {
    let total = 0;
    for (const part of parts) total += part.length;
    const out = new Uint8Array(total);
    let o = 0;
    for (const part of parts) { out.set(part, o); o += part.length; }
    return out;
  }
  function scWord(parts, tag, data) {
    parts.push(new Uint8Array([
      data & 0xff, (data >>> 8) & 0xff, (data >>> 16) & 0xff, (data >>> 24) & 0xff,
      tag & 0xff, (tag >>> 8) & 0xff, (tag >>> 16) & 0xff, (tag >>> 24) & 0xff,
    ]));
  }
  function scString(parts, s) {
    let latin1 = true;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0xff) { latin1 = false; break; }
    if (latin1) {
      const b = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
      scWord(parts, T_STRING, s.length | 0x80000000);
      parts.push(b, new Uint8Array((-s.length) & 7));
    } else {
      const b = new Uint8Array(2 * s.length);
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        b[2 * i] = c & 0xff; b[2 * i + 1] = c >> 8;
      }
      scWord(parts, T_STRING, s.length);
      parts.push(b, new Uint8Array((-(2 * s.length)) & 7));
    }
  }
  function scBuildString(s) {
    const parts = [];
    scWord(parts, T_HEADER, 3);
    scString(parts, s);
    return scConcat(parts);
  }
  function scBuildArray(items) {
    const parts = [];
    scWord(parts, T_HEADER, 3);
    scWord(parts, T_ARRAY, items.length);
    items.forEach((s, i) => { scWord(parts, T_INT32, i); scString(parts, s); });
    scWord(parts, T_EOK, 0);
    return scConcat(parts);
  }

  // ---- byte/hex/base64 helpers (без spread — чанками, стек не переполнить) ----
  function bytesToHex(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return out;
  }
  function hexToBytes(hex) {
    const out = new Uint8Array(hex.length >> 1);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(2 * i, 2), 16);
    return out;
  }
  function bytesToB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  // Ключ-блоб uBO: 0x30 + (байты UTF-8 имени + 1) — обфускация vAPI.storage.
  function uboKeyHex(name) {
    const enc = new TextEncoder().encode(name);
    const b = new Uint8Array(enc.length + 1);
    b[0] = 0x30;
    for (let i = 0; i < enc.length; i++) b[i + 1] = enc[i] + 1;
    return bytesToHex(b);
  }
  // =============== /CODEC =================

  // ---- Прямой доступ к sqlite через mozStorage ----
  // Всё синхронно (выборка/UPDATE по PK, строки в сотни байт), главное —
  // гарантированное закрытие statement/connection в finally.
  const isLockErr = (e) => {
    try {
      return !!e && (e.result === Cr.NS_ERROR_STORAGE_BUSY ||
                     e.result === Cr.NS_ERROR_FILE_IS_LOCKED);
    } catch (_) { return false; }
  };

  // Чтение строки object_data: возвращает hex data или null (строки нет).
  function dbReadRowHex(conn, osid, keyHex) {
    let stmt = null;
    try {
      stmt = conn.createStatement(
        'SELECT typeof(data), hex(data) FROM object_data ' +
        'WHERE object_store_id = ' + osid + " AND key = x'" + keyHex + "'");
      if (!stmt.executeStep()) return null;
      if (stmt.getUTF8String(0) !== 'blob') throw new Error('data не blob (external storage?)');
      return stmt.getUTF8String(1);
    } finally {
      if (stmt) { try { stmt.reset(); } catch (e) {} try { stmt.finalize(); } catch (e) {} }
    }
  }

  // Основной проход. tag: 'start' (+15с), 'verify' (+75с), 'late'/'direct'.
  // Возвращает true, если нужен retry (lock/busy) — оркестратор повторит.
  async function runOnce(tag, attempt) {
    const policy = uboPolicy();
    if (!policy) {
      mark('NO_UBO'); // uBlock не активен: после установки скрипт увидит его на след. старте
      return false;
    }
    // UUID uBO: у WebExtensionPolicy в 155 нет геттера .uuid напрямую —
    // берём host из moz-extension URI (baseURI.host = uuid расширения)
    let uuid = null;
    try {
      if (policy.baseURI && policy.baseURI.host) uuid = policy.baseURI.host;
      else if (policy.getURL) { const u = Services.io.newURI(policy.getURL('')); uuid = u.host; }
    } catch (e) {}
    if (!uuid) { mark('ERR uuid — у policy uBO нет uuid'); return false; }

    const dbFile = Services.dirsvc.get('ProfD', Ci.nsIFile).clone();
    dbFile.append('storage'); dbFile.append('default');
    dbFile.append('moz-extension+++' + uuid + USER_CONTEXT);
    dbFile.append('idb'); dbFile.append(DB_FILENAME);
    if (!dbFile.exists()) {
      mark(tag + ' NO_DB — sqlite storage.local uBO не найден');
      return false;
    }

    let conn = null;
    try {
      try {
        conn = Cc['@mozilla.org/storage/service;1']
          .getService(Ci.mozIStorageService)
          .openUnsharedDatabase(dbFile);
        conn.executeSimpleSQL('PRAGMA busy_timeout = 5000');
      } catch (e) {
        // база залочена движком — тихий retry
        if (isLockErr(e) && attempt < 3) return true;
        mark(tag + ' ERR open ' + (e && e.message ? e.message : e));
        return false;
      }

      // id objectStore 'storage-local-data'
      let osid = -1;
      let stmt = null;
      try {
        stmt = conn.createStatement("SELECT id FROM object_store WHERE name = '" + STORE_NAME + "'");
        if (stmt.executeStep()) osid = stmt.getInt32(0);
      } finally {
        if (stmt) { try { stmt.reset(); } catch (e) {} try { stmt.finalize(); } catch (e) {} }
      }
      if (osid < 0) {
        mark(tag + ' WAIT — objectStore storage-local-data пуст/повреждён');
        return false;
      }

      const keySel = uboKeyHex('selectedFilterLists');
      const keyUs = uboKeyHex('userSettings');
      const selHex = dbReadRowHex(conn, osid, keySel);
      const usHex = dbReadRowHex(conn, osid, keyUs);
      if (selHex === null || usHex === null) {
        // uBO ещё не сохранил настройки (только ставится). НЕ пишем — иначе
        // гонка: uBO загрузит дефолты поверх. Следующий проход добьёт.
        mark(tag + ' WAIT — uBO ещё не сохранил настройки');
        return false;
      }

      // Распаковка: snappy -> structured clone кадр
      let selParsed, usParsed;
      try {
        selParsed = scParse(snappyDecompress(hexToBytes(selHex)));
        usParsed = scParse(snappyDecompress(hexToBytes(usHex)));
      } catch (e) {
        mark(tag + ' ERR codec ' + (e && e.message ? e.message : e));
        return false;
      }

      // Значения: selectedFilterLists — массив (или JSON-строка старого
      // формата), userSettings — JSON-строка.
      let selArr = null, usObj = null;
      try {
        if (selParsed.type === 'array') selArr = selParsed.items.slice();
        else if (selParsed.type === 'string') selArr = JSON.parse(selParsed.value);
        if (usParsed.type === 'string') usObj = JSON.parse(usParsed.value);
      } catch (e) { selArr = null; }
      if (!Array.isArray(selArr) || selArr.some(k => typeof k !== 'string') ||
          !usObj || typeof usObj !== 'object') {
        mark(tag + ' ERR parse — неожиданный формат значений');
        return false;
      }

      // -- Проверка эталона: только недостающие, ничего не удаляем --
      const have = new Set(selArr);
      const addStock = STOCK_LISTS.filter(k => !have.has(k));
      const importedNow = Array.isArray(usObj.importedLists) ? usObj.importedLists : [];
      const haveURLs = new Set(importedNow);
      const addURL = URL_LISTS.filter(u => !haveURLs.has(u) && !have.has(u));
      if (addStock.length === 0 && addURL.length === 0) {
        mark(tag + ' OK (эталон на месте, ' + selArr.length + ' списков)');
        return false;
      }

      // Слияние: старые записи остаются на своих местах (порядок неважен,
      // uBO сравнивает через Set — js/storage.js applyFilterListSelection).
      const merged = selArr.concat(addStock, addURL);
      const writes = [[keySel, snappyCompressLiteral(scBuildArray(merged)), 'selectedFilterLists', selHex]];
      if (addURL.length) {
        usObj.importedLists = importedNow.concat(addURL);
        writes.push([keyUs, snappyCompressLiteral(scBuildString(JSON.stringify(usObj))),
                     'userSettings', usHex]);
      }

      // КАТАСТРОФОФАЙЛ: base64 оригинальных блобов ДО записи (append).
      try {
        const bkp = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
        bkp.append('JS'); bkp.append('BladeShield_backup.txt');
        let prev = '';
        try { prev = await IOUtils.readUTF8(bkp.path); } catch (e) {}
        const stamp = new Date().toISOString();
        let add = '';
        for (const [, , name, origHex] of writes) {
          add += VER + ' ' + stamp + ' ' + name + ' ' + bytesToB64(hexToBytes(origHex)) + '\n';
        }
        await IOUtils.writeUTF8(bkp.path, prev + add);
      } catch (e) {
        mark(tag + ' ERR backup ' + (e && e.message ? e.message : e));
        return false;
      }

      // Запись: одна транзакция, UPDATE по PK, без checkpoint/VACUUM.
      try {
        conn.executeSimpleSQL('BEGIN IMMEDIATE');
        try {
          for (const [keyHex, dataBytes] of writes) {
            let upd = null;
            try {
              upd = conn.createStatement(
                "UPDATE object_data SET data = x'" + bytesToHex(dataBytes) +
                "' WHERE object_store_id = " + osid + " AND key = x'" + keyHex + "'");
              upd.execute();
            } finally {
              if (upd) { try { upd.reset(); } catch (e) {} try { upd.finalize(); } catch (e) {} }
            }
          }
          conn.executeSimpleSQL('COMMIT');
        } catch (eInner) {
          try { conn.executeSimpleSQL('ROLLBACK'); } catch (eRb) {}
          throw eInner;
        }
      } catch (e) {
        if (isLockErr(e) && attempt < 3) return true; // retry
        mark(tag + ' ERR write ' + (e && e.message ? e.message : e));
        return false;
      }

      // Контрольное чтение: база должна отдать распарсенное слитое значение.
      try {
        const backHex = dbReadRowHex(conn, osid, keySel);
        const back = scParse(snappyDecompress(hexToBytes(backHex)));
        const backSet = new Set(back.type === 'array' ? back.items : []);
        const missing = merged.filter(k => !backSet.has(k));
        if (missing.length) throw new Error('readback missing ' + missing.join(','));
      } catch (e) {
        mark(tag + ' ERR verify-write ' + (e && e.message ? e.message : e));
        return false;
      }

      mark(tag + ' RESTORED +' + (addStock.length + addURL.length) +
        ' [' + addStock.concat(addURL.map(u => u.split('/').pop())).join(', ') + ']');
      // Форс обновления не нужен: start.js uBO сам обновляет активные списки
      // (autoUpdate=true; emergency update при возрасте >2 единиц).
      return false;
    } finally {
      // Гарантированное закрытие: пока жив коннект движка uBO, наш close НЕ
      // последний -> авто-checkpoint WAL не сработает (структуру не трогаем).
      if (conn) { try { conn.close(); } catch (e) {} }
    }
  }

  // Оркестратор с retry: lock/busy -> повтор через 5с, максимум 3 попытки.
  const runGuarded = (tag, attempt) =>
    runOnce(tag, attempt).then((retry) => {
      if (retry) {
        if (attempt < 3) {
          mark(tag + ' LOCK-retry ' + attempt + '/3');
          once(() => runGuarded(tag, attempt + 1), 5000);
        } else {
          mark(tag + ' ERR lock — база занята после 3 попыток');
        }
      }
    }).catch((e) => mark(tag + ' ERR run ' + (e && e.message ? e.message : e)));

  // @onlyonce (fx-autoconfig): скрипт исполняется только в первом окне сессии —
  // сторож срабатывает разово при старте, этого достаточно.
  // ГОНКА (урок живого теста 2026-09-13): если писать ДО того, как background
  // uBO загрузит и сохранит свои дефолты, uBO затирает нашу запись. Поэтому:
  // первый проход после browser-delayed-startup-finished + 15с (uBO к этому
  // моменту сохранил стартовые настройки), затем контрольный повтор через 60с —
  // если uBO перезаписал и нас снова, добиваем. Идемпотентно, ничего не удаляет.
  const once = (fn, ms) => { const t = ChromeUtils.importESModule(
    'resource://gre/modules/Timer.sys.mjs'); return t.setTimeout(fn, ms); };
  try {
    const obs = (subj, topic) => {
      if (topic !== 'browser-delayed-startup-finished') return;
      Services.obs.removeObserver(obs, 'browser-delayed-startup-finished');
      once(() => runGuarded('start', 1), 15000);
      once(() => runGuarded('verify', 1), 75000);
    };
    Services.obs.addObserver(obs, 'browser-delayed-startup-finished');
    // страховка: если событие уже прошло (окно стартовало раньше @onlyonce-исполнения)
    once(() => { try { Services.obs.removeObserver(obs, 'browser-delayed-startup-finished'); } catch (e) {} runGuarded('late', 1); }, 20000);
  } catch (e) {
    runGuarded('direct', 1);
  }
})();
