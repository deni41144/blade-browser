import sys
sys.path.insert(0, r'F:\firefox michael edition')
from cityhash_blade import firefox_install_hash

# верификация на известном живом хэше установленной копии
known = r'C:\Users\Deni\AppData\Local\Blade\App\Blade'
print('verify:', firefox_install_hash(known), '(wait D0DD9ACE5A41BA7D)')

targets = {'6FD3671E1FA30125', '5429A0681078FC6F'}
bases = [
    r'D:\Blade', r'E:\Blade', r'F:\Blade', r'C:\Blade',
    r'D:\blade', r'C:\Users\Deni\Desktop\Blade', r'C:\Users\Deni\Desktop\Blade2',
    r'C:\Users\Deni\Downloads\Blade', r'C:\Users\Deni\AppData\Local\Blade2',
    r'C:\Users\Deni\AppData\Local\Blade Test', r'C:\Users\Deni\AppData\Local\Programs\Blade',
    r'F:\firefox michael edition\Blade', r'F:\firefox michael edition\Release\Blade',
    r'F:\firefox michael edition\Release\Blade-Setup-2.0.1.zip',
    r'F:\firefox michael edition\Release\Blade-Setup-2.0.1-v2.zip',
    r'F:\firefox michael edition\Release\Blade-Setup-2.0.1-v2\Blade',
    r'F:\firefox michael edition\Release\Blade-2.0.1-Ливень\Blade',
    r'F:\firefox michael edition\Skeleton-Stage',
    r'F:\firefox michael edition\FirefoxPortable\App\Firefox64',
    r'D:\Blade Test', r'D:\test\Blade', r'D:\Blade2', r'D:\Programs\Blade',
    r'D:\Downloads\Blade', r'D:\Games\Blade', r'E:\Blade2', r'E:\Soft\Blade',
    r'C:\Users\Deni\AppData\Local\Blade-Test', r'C:\Users\Deni\AppData\Local\BladeTest',
]
found = 0
for b in bases:
    for suffix in [r'\App\Blade', '']:
        for p in {b, b.lower()}:
            h = firefox_install_hash(p + suffix)
            if h in targets:
                print('MATCH:', h, '->', p + suffix)
                found += 1
print('matches:', found)
