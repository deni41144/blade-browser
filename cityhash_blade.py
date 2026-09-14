# Port of Mozilla-vendored CityHash Version 1.0 (other-licenses/nsis/Contrib/CityHash)
# for computing Firefox install hashes: CityHash64(path.utf-16-le) formatted %llX.
# Verified against live install hashes on 2026-09-14.

M = (1 << 64) - 1
K0 = 0xC3A5C85C97CB3127
K1 = 0xB492B66FBE98F273
K2 = 0x9AE16A3B2F90404F
K3 = 0xC949D7C7509E6557
KMUL = 0x9DDFEA08EB382D69


def _u64(x):
    return x & M


def _load64(s, i):
    return int.from_bytes(s[i:i + 8], 'little')


def _load32(s, i):
    return int.from_bytes(s[i:i + 4], 'little')


def _rot(val, shift):
    return val if shift == 0 else _u64((val >> shift) | (val << (64 - shift)))


def _rot1(val, shift):
    return _u64((val >> shift) | (val << (64 - shift)))


def _mix(val):
    return val ^ (val >> 47)


def _hash128to64(u, v):
    a = _u64((u ^ v) * KMUL)
    a ^= a >> 47
    b = _u64((v ^ a) * KMUL)
    b ^= b >> 47
    return _u64(b * KMUL)


def _hash16(u, v):
    return _hash128to64(u, v)


def _hash0to16(s):
    ln = len(s)
    if ln > 8:
        a = _load64(s, 0)
        b = _load64(s, ln - 8)
        return _hash16(a, _rot1(_u64(b + ln), ln)) ^ b
    if ln >= 4:
        a = _load32(s, 0)
        return _hash16(ln + (a << 3), _load32(s, ln - 4))
    if ln > 0:
        a, b, c = s[0], s[ln >> 1], s[ln - 1]
        y = a + (b << 8)
        z = ln + (c << 2)
        return _u64(_mix(_u64(y * K2 ^ z * K3)) * K2)
    return K2


def _hash17to32(s):
    ln = len(s)
    a = _u64(_load64(s, 0) * K1)
    b = _load64(s, 8)
    c = _u64(_load64(s, ln - 8) * K2)
    d = _u64(_load64(s, ln - 16) * K0)
    return _hash16(_u64(_rot(_u64(a - b), 43) + _rot(c, 30) + d),
                   _u64(a + _rot(b ^ K3, 20) - c + ln))


def _weak32(w, x, y, z, a, b):
    a = _u64(a + w)
    b = _rot(_u64(b + a + z), 21)
    c = a
    a = _u64(a + x)
    a = _u64(a + y)
    b = _u64(b + _rot(a, 44))
    return _u64(a + z), _u64(b + c)


def _weak32s(s, a, b):
    return _weak32(_load64(s, 0), _load64(s, 8), _load64(s, 16), _load64(s, 24), a, b)


def _hash33to64(s):
    ln = len(s)
    z = _load64(s, 24)
    a = _u64(_load64(s, 0) + _u64((ln + _load64(s, ln - 16)) * K0))
    b = _rot(_u64(a + z), 52)
    c = _rot(a, 37)
    a = _u64(a + _load64(s, 8))
    c = _u64(c + _rot(a, 7))
    a = _u64(a + _load64(s, 16))
    vf = _u64(a + z)
    vs = _u64(b + _rot(a, 31) + c)
    a = _u64(_load64(s, 16) + _load64(s, ln - 32))
    z = _load64(s, ln - 8)
    b = _rot(_u64(a + z), 52)
    c = _rot(a, 37)
    a = _u64(a + _load64(s, ln - 24))
    c = _u64(c + _rot(a, 7))
    a = _u64(a + _load64(s, ln - 16))
    wf = _u64(a + z)
    ws = _u64(b + _rot(a, 31) + c)
    r = _mix(_u64(_u64((vf + ws) * K2) + _u64((wf + vs) * K0)))
    return _u64(_mix(_u64(r * K0 + vs)) * K2)


def city_hash64(data):
    ln = len(data)
    if ln <= 32:
        if ln <= 16:
            return _hash0to16(data)
        return _hash17to32(data)
    if ln <= 64:
        return _hash33to64(data)

    s = data
    x = _load64(s, 0)
    y = _load64(s, ln - 16) ^ K1
    z = _load64(s, ln - 56) ^ K0
    v = _weak32s(s[ln - 64:], ln, y)
    w = _weak32s(s[ln - 32:], _u64(ln * K1), K0)
    z = _u64(z + _u64(_mix(v[1]) * K1))
    x = _u64(_rot(_u64(z + x), 39) * K1)
    y = _u64(_rot(y, 33) * K1)

    ln = (ln - 1) & ~63
    i = 0
    while True:
        x = _u64(_rot(_u64(x + y + v[0] + _load64(s, i + 16)), 37) * K1)
        y = _u64(_rot(_u64(y + v[1] + _load64(s, i + 48)), 42) * K1)
        x ^= w[1]
        y ^= v[0]
        z = _rot(z ^ w[0], 33)
        v = _weak32s(s[i:], _u64(v[1] * K1), _u64(x + w[0]))
        w = _weak32s(s[i + 32:], _u64(z + w[1]), y)
        z, x = x, z
        i += 64
        ln -= 64
        if ln == 0:
            break
    return _hash16(_u64(_hash16(v[0], w[0]) + _u64(_mix(y) * K1) + z),
                   _u64(_hash16(v[1], w[1]) + x))


def firefox_install_hash(install_dir_path):
    """Хэш инсталла Firefox из пути каталога движка (каталог firefox.exe)."""
    return format(city_hash64(install_dir_path.encode('utf-16-le')), 'X')


if __name__ == '__main__':
    tests = [
        (r'C:\Users\Deni\AppData\Local\Blade\App\Blade', 'D0DD9ACE5A41BA7D'),
        (r'F:\firefox michael edition\FirefoxPortable\App\Firefox64', '841AB720B1601E88'),
    ]
    for path, want in tests:
        got = firefox_install_hash(path)
        print(f'{want} | got {got} | {"MATCH" if got == want else "FAIL"} | {path}')
