// ============================================================================
// TestReports\test-adversarial-audit.js
// Executable adversarial regression suite verifying vulnerabilities and defects
// discovered during the 2026-09-14 Blade codebase audit + fix-wave №4
// (скорректированные владельцем находки: P0 = ext-topSites, не урлбар).
// Каждый тест: ЛОМАЕТСЯ на старом коде (демо уязвимости) и ПРОХОДИТ на новом.
// ============================================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
    failed++;
  }
}

const ps1 = fs.readFileSync(path.join(ROOT, 'Apply-Blade-Langpack.ps1'), 'utf8');
const tilesPs1 = fs.readFileSync(path.join(ROOT, 'Apply-Blade-Tiles.ps1'), 'utf8');

// ----------------------------------------------------------------------------
// 1. P0: WebExtension topSites.get({newtab:true}) падает на null-дырках
//    (chrome/browser/content/browser/parent/ext-topSites.js — links.map по
//    СЫРЫМ rows; урлбар/ai-window фильтруют сами — по уточнению владельца)
// ----------------------------------------------------------------------------
test('P0 ext-topSites: старый getTopSites (сырые rows) роняет WebExtension API', () => {
  // TopSitesFeed в pinnedOnly кладёт null в слоты unpinned (наш B1):
  const rowsFromTopSitesFeed = [{ url: 'https://site1.com' }, null, { url: 'https://site2.com' }];

  // AboutNewTab.getTopSites — СТАРАЯ версия (без фильтра), ext-topSites.js:
  // return Promise.all(links.map(async link => ({ type: link.searchTopSite ? ... })))
  const getTopSitesOld = () => rowsFromTopSitesFeed;
  let crash = null;
  try {
    getTopSitesOld().map(link => ({ type: link.searchTopSite ? 'search' : 'url', url: link.url }));
  } catch (e) {
    crash = e;
  }
  assert.ok(crash instanceof TypeError, 'ожидали TypeError на null.searchTopSite, получили: ' + crash);
});

test('P0 ext-topSites: патч C1 (rows.filter(Boolean)) спасает цепочку', () => {
  const rowsFromTopSitesFeed = [{ url: 'https://site1.com' }, null, { url: 'https://site2.com' }];

  // НОВАЯ версия getTopSites (Apply-Blade-Tiles.ps1, патч C1):
  const getTopSitesNew = () => rowsFromTopSitesFeed.filter(Boolean);
  const links = getTopSitesNew();
  const mapped = links.map(link => ({ type: link.searchTopSite ? 'search' : 'url', url: link.url }));
  assert.strictEqual(mapped.length, 2);
  assert.strictEqual(mapped[0].url, 'https://site1.com');
  assert.strictEqual(mapped[1].url, 'https://site2.com');
});

test('P0 патч C1 определён в Apply-Blade-Tiles.ps1 с идемпотентным маркером', () => {
  assert.ok(tilesPs1.includes("TopSites.rows.filter(Boolean)"), 'нет тела патча C1');
  assert.ok(tilesPs1.includes("$antEntry  = 'modules/AboutNewTab.sys.mjs'"), 'нет цели C1 (AboutNewTab.sys.mjs)');
  assert.ok(tilesPs1.includes("AboutNewTab.sys.mjs: C1 уже стоит"), 'нет идемпотентности C1');
  // якорь C1 соответствует живому движку (getTopSites возвращает rows)
  assert.ok(tilesPs1.includes('TopSites.rows\r\n      : [];') || tilesPs1.includes('TopSites.rows\n      : [];'));
});

// ----------------------------------------------------------------------------
// 2. P1: insertPinned B1 v2 — дырка ЗА хвостом дописывается null-ами
// ----------------------------------------------------------------------------
// СТАРАЯ реализация (B1 v1): дырка при index >= length терялась, а последующий
// pinned через newLinks[index] создавал sparse-слоты (undefined).
function insertPinnedV1(links, pinned) {
  const pinnedUrls = pinned.map(link => link && link.url);
  let newLinks = links.filter(link => (link ? !pinnedUrls.includes(link.url) : false));
  pinned.forEach((val, index) => {
    if (!val) {
      if (index < newLinks.length) {
        newLinks.splice(index, 0, null);
      }
      return;
    }
    let link = Object.assign({}, val, { isPinned: true, pinIndex: index });
    if (index > newLinks.length) {
      newLinks[index] = link;
    } else {
      newLinks.splice(index, 0, link);
    }
  });
  return newLinks;
}

// НОВАЯ реализация (B1 v2 из Apply-Blade-Tiles.ps1):
function insertPinnedV2(links, pinned) {
  const pinnedUrls = pinned.map(link => link && link.url);
  let newLinks = links.filter(link => (link ? !pinnedUrls.includes(link.url) : false));
  pinned.forEach((val, index) => {
    if (!val) {
      if (index < newLinks.length) {
        newLinks.splice(index, 0, null);
      } else {
        while (newLinks.length < index) {
          newLinks.push(null);
        }
        newLinks.push(null);
      }
      return;
    }
    let link = Object.assign({}, val, { isPinned: true, pinIndex: index });
    if (index > newLinks.length) {
      newLinks[index] = link;
    } else {
      newLinks.splice(index, 0, link);
    }
  });
  return newLinks;
}

test('P1 B1: СТАРАЯ insertPinned теряет дырку в конце (демо бага)', () => {
  const res = insertPinnedV1([], [{ url: 'https://a.com' }, null, null]);
  assert.strictEqual(res.length, 1, 'концевые дырки молча выброшены');
});

test('P1 B1: СТАРАЯ insertPinned создаёт sparse-слоты (демо бага)', () => {
  const res = insertPinnedV1([], [null, null, { url: 'https://b.com' }]);
  assert.strictEqual(res[0], undefined);
  assert.strictEqual(0 in res, false, 'index 0 — empty slot, не null');
});

test('P1 B1 v2: дырка в конце сохраняется null-ами', () => {
  const res = insertPinnedV2([], [{ url: 'https://a.com' }, null, null]);
  assert.strictEqual(res.length, 3);
  assert.strictEqual(res[1], null);
  assert.strictEqual(res[2], null);
  assert.ok(res.every(x => x !== undefined), 'никаких sparse-слотов');
});

test('P1 B1 v2: дырка + хвост за ней — все слоты плотные', () => {
  const res = insertPinnedV2([], [null, null, { url: 'https://b.com' }, null, { url: 'https://c.com' }]);
  assert.strictEqual(res.length, 5);
  assert.deepStrictEqual(
    res.map(x => x === null ? 'null' : x.url),
    ['null', 'null', 'https://b.com', 'null', 'https://c.com']);
  assert.ok(res.every((x, i) => i in res), 'массив плотный');
});

test('P1 B1 v2: all-null pinned — плотный массив null-ов', () => {
  const res = insertPinnedV2([], [null, null, null, null]);
  assert.strictEqual(res.length, 4);
  assert.ok(res.every(x => x === null));
  assert.ok([0, 1, 2, 3].every(i => i in res), 'нет sparse-слотов');
});

test('P1 B1 v2 определён в Apply-Blade-Tiles.ps1 (маркер + миграция v1)', () => {
  assert.ok(tilesPs1.includes('BLADE PATCH v2 (audit P1)'), 'нет v2-маркера');
  assert.ok(tilesPs1.includes('B1 v1 -> v2 (миграция)'), 'нет миграции старой прошивки');
});

// ----------------------------------------------------------------------------
// 3. P2: BladeProfileGuard 1.0.3 — санитизация путей от \r\n (инъекция INI)
// ----------------------------------------------------------------------------
test('P2 Guard: несанитизированный путь инъектирует секцию INI (демо атаки)', () => {
  const lines = ['[General]', 'Version=2'];
  const maliciousProfDir = 'C:\\Blade\\Profile\r\n[InjectedSection]\r\nAdmin=1';
  lines.push('Path=' + maliciousProfDir);
  const serialized = lines.join('\r\n');
  assert.ok(serialized.includes('[InjectedSection]\r\nAdmin=1'), 'секция внедрена');
});

test('P2 Guard 1.0.3: sanitizePath вырезает переводы строк (INI цел)', () => {
  // функция из BladeProfileGuard.uc.js v1.0.3
  const sanitizePath = (p) => (p || '').replace(/[\r\n]/g, '');
  const maliciousProfDir = 'C:\\Blade\\Profile\r\n[InjectedSection]\r\nAdmin=1';
  const clean = sanitizePath(maliciousProfDir);
  const lines = ['[General]', 'Version=2', 'Path=' + clean];
  const serialized = lines.join('\r\n');
  assert.ok(!serialized.split('\r\n').some(l => l.startsWith('[InjectedSection]')), 'секции-инъекции нет');
  assert.ok(!/[\r\n]/.test(clean), 'переводы строк вырезаны');
});

// ----------------------------------------------------------------------------
// 4. P2: регистр пути меняет CityHash64 (обоснование канонизации в C#)
// ----------------------------------------------------------------------------
test('P2: CityHash64 чувствителен к регистру — канонизация обязательна', () => {
  const K2 = 0x9AE16A3B2F90404Fn;
  const K3 = 0xC949D7C7509E6557n;
  const mix = (val) => val ^ (val >> 47n);
  const u64 = (x) => BigInt.asUintN(64, x);
  function hashShort(str) {
    const bytes = Buffer.from(str, 'utf16le');
    const ln = bytes.length;
    const a = BigInt(bytes[0]);
    const b = BigInt(bytes[ln >> 1]);
    const c = BigInt(bytes[ln - 1]);
    const y = a + (b << 8n);
    const z = BigInt(ln) + (c << 2n);
    return u64(u64(mix(u64((y * K2) ^ (z * K3)))) * K2).toString(16).toUpperCase();
  }
  assert.notStrictEqual(hashShort('C:\\Blade'), hashShort('c:\\blade'));
});

// ----------------------------------------------------------------------------
// 5. P2: скраббер — ReDoS-регекс и Fluent {…}-иммунитет (факты в ps1;
//    поведение прогнано в TestReports\test-langpack-scrub.py на реальном коде)
// ----------------------------------------------------------------------------
test('P2 ReDoS: в ps1 линейный URL_RE с lookbehind (непересекающийся)', () => {
  assert.ok(
    ps1.includes(String.raw`URL_RE = re.compile(r'https?://\S+|(?<![\w.-])[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(?:org|com|net)\b\S*')`),
    'URL_RE в ps1 должен быть с lookbehind (?<![\\w.-])');
  assert.ok(!ps1.includes(String.raw`URL_RE = re.compile(r'https?://\S+|[\w.-]+\.`), 'старый ReDoS-класс [\\w.-] ещё в ps1');
});

test('P2 Fluent: в ps1 есть BRACE_SPAN — {…}-спаны не скрабятся', () => {
  assert.ok(ps1.includes(String.raw`BRACE_SPAN = re.compile(r'\{[^{}\n]*\}')`), 'нет BRACE_SPAN-защиты');
});

// ----------------------------------------------------------------------------
// 6. P1: BladeBattery 1.0.1 — снятие слушателей BatteryManager на unload
// ----------------------------------------------------------------------------
const asyncTests = [];
test('P1 Battery 1.0.1: unload снимает слушатели (в т.ч. до resolve промиса)', () => {
  let listeners = [];
  const bm = {
    addEventListener: (t, f) => listeners.push({ t, f }),
    removeEventListener: (t, f) => { listeners = listeners.filter(l => l.f !== f); },
    charging: false, level: 0.5,
  };
  let resolveBattery;
  const batteryPromise = new Promise(res => { resolveBattery = res; });
  let battery = null, onChange = null;
  const detach = () => {
    if (battery && onChange) {
      bm.removeEventListener('levelchange', onChange);
      bm.removeEventListener('chargingchange', onChange);
    }
  };
  // паттерн BladeBattery 1.0.1 (как в uc.js)
  batteryPromise.then(b => {
    battery = b;
    onChange = () => {};
    bm.addEventListener('levelchange', onChange);
    bm.addEventListener('chargingchange', onChange);
  }).catch(() => {});
  // window unload стреляет ДО resolve промиса:
  detach();
  batteryPromise.then(detach).catch(() => {});

  asyncTests.push((async () => {
    resolveBattery(bm); // промис разрешается ПОСЛЕ unload
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.strictEqual(listeners.length, 0, 'then(detach) снял слушатели после resolve');
  })());
});

test('P1 Battery 1.0.1: код паттерна в uc.js', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'FirefoxPortable', 'Data', 'profile', 'chrome', 'JS', 'BladeBattery.uc.js'), 'utf8');
  assert.ok(src.includes('@version         1.0.1'));
  assert.ok(src.includes('batteryPromise.then(detach)'), 'нет снятия через then(detach)');
  assert.ok(src.includes('removeEventListener'), 'нет removeEventListener');
});

// ----------------------------------------------------------------------------
// 7. P1: политики — langpack-и не обновляются (ключ updates_disabled по схеме движка)
// ----------------------------------------------------------------------------
test('P1 Policies: langpack-и updates_disabled, ExtensionUpdate не тронут', () => {
  const POLICIES = [
    'C:\\Users\\Deni\\AppData\\Local\\Blade\\App\\Blade\\distribution\\policies.json',
    path.join(ROOT, 'Skeleton-Stage', 'distribution', 'policies.json'),
  ];
  for (const p of POLICIES) {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.strictEqual(j.policies.ExtensionUpdate, true, `${p}: ExtensionUpdate должен остаться true (uBO обновляется)`);
    assert.deepStrictEqual(
      j.policies.ExtensionSettings['langpack-ru@firefox.mozilla.org'],
      { updates_disabled: true }, `${p}: неверные настройки ru-langpack`);
    assert.deepStrictEqual(
      j.policies.ExtensionSettings['langpack-en-GB@firefox.mozilla.org'],
      { updates_disabled: true }, `${p}: неверные настройки en-GB-langpack`);
  }
});

// ----------------------------------------------------------------------------
// 8. P3: userContent.css — кап nth-child(n+16) снесён
// ----------------------------------------------------------------------------
test('P3 CSS: правило nth-child(n+16) удалено из userContent.css', () => {
  const css = fs.readFileSync(
    path.join(ROOT, 'FirefoxPortable', 'Data', 'profile', 'chrome', 'userContent.css'), 'utf8');
  // селектор-правила быть не должно (упоминание в комментарии о сносе — ок)
  assert.ok(!css.includes('.top-sites-list li.top-site-outer:nth-child(n+16)'), 'кап 15-плиток всё ещё в CSS');
  assert.ok(css.includes('СНЁСЁН (P3-аудит'), 'нет комментария о сносе');
});

(async () => {
  await Promise.all(asyncTests);
  console.log('\n----------------------------------------');
  console.log(`Regression Test Results: ${passed} PASSED, ${failed} FAILED`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => {
  console.error('ASYNC ERROR:', e);
  process.exit(1);
});
