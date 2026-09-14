notes = u'''Исправления:
— Кнопка B больше не пропадает: переведена на прямую DOM-вставку (в свежих профилях установщика движок не строил узел виджета)
— Восстановлен загрузчик пользовательских скриптов в config.js движка (повреждался при добавлении автосида — браузер мог стартовать без кастомизации)
— Страж профиля не перехватывает профиль по умолчанию при запуске с ключом -profile
— Русский язык из коробки для новых установок (langpack в поставке, установщик прописывает его сам)

Всё из 2.0.1: плитки — удаление навсегда (режим pinnedOnly), брендинг без упоминаний Firefox и Mozilla, AVA-сплеш, заставка простоя и новая иконка, дождь на панели в цвет темы, установщик с AVA GX-эффектами и сидингом профилей.

Это полный пакет: движок + кастомизация (~150 МБ). Обновившимся с 2.0.1 — всё приедет автоматически; для русского интерфейса переустанови браузер через Blade-Setup 1.4.2+.

--- English ---

Fixes:
— The B-button no longer disappears: moved to direct DOM mounting (the engine never built the widget node in fresh installer profiles)
— Restored the user-script loader in the engine config.js (it got damaged while adding autoseed — the browser could start without customization)
— Profile Guard no longer hijacks the default profile when launched with an explicit -profile flag
— Russian language out of the box for fresh installs (langpack bundled, the installer wires it up)

Everything from 2.0.1: permanent tile removal (pinnedOnly mode), branding with zero Firefox/Mozilla mentions, AVA splash, idle screen and the new icon, theme-colored rain on the toolbar, AVA GX installer with profile seeding.

This is the full package: engine + customization (~150 MB). Patch-upgraders from 2.0.1 get everything automatically; for the Russian UI reinstall via Blade-Setup 1.4.2+.
'''
import codecs
f = codecs.open(r'F:\firefox michael edition\TestReports\notes-202.txt', 'w', 'utf-8-sig')
f.write(notes)
f.close()
print('notes written with BOM')
