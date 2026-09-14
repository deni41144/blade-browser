const fs = require('fs');
const src = 'C:\\Users\\Deni\\AppData\\Local\\Blade\\Data\\profile\\prefs.js';
const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
const keys = [
  'browser.uiCustomization.state',
  'browser.uiCustomization.horizontalTabsBackup',
  'browser.uiCustomization.navBarWhenVerticalTabs',
  'sidebar.verticalTabs',
];
for (const line of lines) {
  const m = line.match(/^user_pref\("([^"]+)",\s*(.*)\);\s*$/);
  if (!m) continue;
  if (!keys.some(k => m[1] === k || m[1].includes('verticalTabs') || m[1].includes('uiCustomization'))) continue;
  let val;
  try { val = new Function('return ' + m[2])(); } catch (e) { console.log(m[1] + ' = <EVAL FAIL> ' + m[2].slice(0, 80)); continue; }
  if (typeof val === 'string' && val.startsWith('{')) {
    try {
      const o = JSON.parse(val);
      console.log('--- ' + m[1] + ' (object) ---');
      for (const [area, items] of Object.entries(o.placements || {})) {
        console.log('  ' + area + ' (' + items.length + '): ' + items.join(', '));
      }
    } catch (e) { console.log(m[1] + ' = <parse fail> ' + val.slice(0, 120)); }
  } else if (typeof val === 'string' && val.startsWith('[')) {
    try {
      const a = JSON.parse(val);
      console.log('--- ' + m[1] + ' (array, ' + a.length + ') ---');
      console.log('  ' + a.join(', '));
    } catch (e) { console.log(m[1] + ' = <parse fail> ' + val.slice(0, 120)); }
  } else {
    console.log('--- ' + m[1] + ' = ' + JSON.stringify(val));
  }
}
console.log('=== verticalTabs-related prefs (raw grep) ===');
for (const line of lines) {
  if (/verticalTabs|vertical-tabs/i.test(line)) console.log(line.slice(0, 220));
}
