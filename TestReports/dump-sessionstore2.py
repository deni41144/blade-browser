import struct, json

def unlz4_block(src, dst_size):
    dst = bytearray(dst_size)
    si = di = 0
    n = len(src)
    while si < n:
        token = src[si]; si += 1
        lit = token >> 4
        if lit == 15:
            while True:
                b = src[si]; si += 1; lit += b
                if b != 255: break
        dst[di:di+lit] = src[si:si+lit]; si += lit; di += lit
        if si >= n: break
        offset = src[si] | (src[si+1] << 8); si += 2
        ml = token & 15
        if ml == 15:
            while True:
                b = src[si]; si += 1; ml += b
                if b != 255: break
        ml += 4
        start = di - offset
        for i in range(ml):
            dst[di] = dst[start + i]; di += 1
    return bytes(dst[:di])

path = r'C:\Users\Deni\AppData\Local\Blade\Data\profile\sessionstore-backups\previous.jsonlz4'
raw = open(path, 'rb').read()
size = struct.unpack('<I', raw[8:12])[0]
data = json.loads(unlz4_block(raw[12:], size))
print('top-level keys:', sorted(data.keys()))
for k in ['session', 'profile', 'startedAt', 'stoppedAt', 'updatedAt']:
    if k in data: print(k, '=', data[k])
wins = data.get('windows', [])
print(f'windows: {len(wins)}')
for i, w in enumerate(wins):
    print(f'== window {i} keys: {sorted(w.keys())}')
    tabs = w.get('tabs', [])
    print(f'   tabs: {len(tabs)}, selected: {w.get("selected")}, closed tabs in window: {len(w.get("_closedTabs", []))}')
    for j, t in enumerate(tabs):
        e = t.get('entries', [])
        url = e[-1].get('url', '?') if e else '?'
        title = (e[-1].get('title', '') if e else '')
        print(f'   tab {j}: {title[:40]!r} | {url[:80]} | entries={len(e)}')
    for j, ct in enumerate(w.get('_closedTabs', [])[:10]):
        st = ct.get('state', {})
        e = st.get('entries', [])
        print(f'   closedTab {j}: {(e[-1].get("title","") if e else "")[:40]!r} | {(e[-1].get("url","?") if e else "?")[:80]}')
print('closed windows:', len(data.get('_closedWindows', [])))
for j, cw in enumerate(data.get('_closedWindows', [])[:10]):
    st = cw.get('tabs', cw.get('state', {}))
    print(f'  closedWin {j}:', str(st)[:120])
