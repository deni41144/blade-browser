const fs = require('fs');
const p = 'C:' + String.fromCharCode(92) + 'Users' + String.fromCharCode(92) + 'Deni' + String.fromCharCode(92) + 'AppData' + String.fromCharCode(92) + 'Local' + String.fromCharCode(92) + 'Blade' + String.fromCharCode(92) + 'Data' + String.fromCharCode(92) + 'profile' + String.fromCharCode(92) + 'extensions.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
for (const a of j.addons) {
  if (!a.active) continue;
  const upd = a.updateDate ? new Date(a.updateDate).toISOString() : '-';
  const inst = a.installDate ? new Date(a.installDate).toISOString() : '-';
  console.log(a.id, '| update:', upd, '| install:', inst);
}
