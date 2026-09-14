import struct, json, sys

# mozlz4: 8-byte header (magic 'mozLz40\0') + u32 uncompressed size + LZ4-block
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
assert raw[:4] == b'mozL', raw[:8]
size = struct.unpack('<I', raw[8:12])[0]
data = json.loads(unlz4_block(raw[12:], size))
wins = data.get('windows', [])
print(f'windows: {len(wins)}')
for i, w in enumerate(wins):
    tabs = w.get('tabs', [])
    cur = w.get('selected', 0)
    print(f'-- window {i}: {len(tabs)} tabs, selected index {cur}')
    for t in tabs:
        e = t.get('entries', [])
        url = e[-1].get('url', '?') if e else '?'
        title = e[-1].get('title', '') if e else ''
        print('   ', (title or '')[:45], '|', url[:90])
closed = data.get('_closedWindows', [])
print(f'closed windows: {len(closed)}')
