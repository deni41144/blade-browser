import re

BS = chr(92)
p = r'C:' + BS + 'Users' + BS + 'Deni' + BS + 'AppData' + BS + 'Roaming' + BS + 'Mozilla' + BS + 'Firefox' + BS + 'profiles.ini'
src = open(p, encoding='utf-8').read()
temp_path = r'C:' + BS + 'Users' + BS + 'Deni' + BS + 'AppData' + BS + 'Local' + BS + 'Temp' + BS + 'blade-diag-prof'
owner_path = r'C:' + BS + 'Users' + BS + 'Deni' + BS + 'AppData' + BS + 'Local' + BS + 'Blade' + BS + 'Data' + BS + 'profile'
src = src.replace('Default=' + temp_path, 'Default=' + owner_path)
src = re.sub(r'\[Profile3\]\r?\nName=Blade\r?\nIsRelative=0\r?\nPath=' + re.escape(temp_path) + r'\r?\n?', '', src)
open(p, 'w', encoding='utf-8', newline='').write(src)
print('profiles.ini cleaned')
