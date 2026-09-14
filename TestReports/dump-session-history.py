import sqlite3, datetime, shutil, tempfile, os

src = r'C:\Users\Deni\AppData\Local\Blade\Data\profile\places.sqlite'
tmp = os.path.join(tempfile.gettempdir(), 'blade-diag-places.sqlite')
shutil.copy2(src, tmp)

con = sqlite3.connect(tmp)
cur = con.cursor()
# окно сессии: 15:40 - 16:03 местного (UTC+3) 2026-09-14
lo = int(datetime.datetime(2026, 9, 14, 15, 40, 0, tzinfo=datetime.timezone.utc).timestamp() * 1_000_000) - 3 * 3600 * 1_000_000
hi = int(datetime.datetime(2026, 9, 14, 16, 3, 0, tzinfo=datetime.timezone.utc).timestamp() * 1_000_000) - 3 * 3600 * 1_000_000
rows = cur.execute('''
    SELECT v.visit_date/1000, p.url, p.title
    FROM moz_historyvisits v JOIN moz_places p ON p.id = v.place_id
    WHERE v.visit_date >= ? AND v.visit_date <= ?
    ORDER BY v.visit_date
''', (lo, hi)).fetchall()
print(f'visits 15:40-16:03 local: {len(rows)}')
for ms, url, title in rows:
    t = datetime.datetime.fromtimestamp(ms / 1_000_000).strftime('%H:%M:%S')
    print(t, '|', (title or '')[:60], '|', url[:110])
con.close()
os.remove(tmp)
