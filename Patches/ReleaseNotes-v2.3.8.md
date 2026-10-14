## Blade — Возврат / Return

Исправлены две заметные регрессии после обновления: удалённые плитки больше не заменяются сайтами из истории, а окна Blade снова получают фирменный значок вместо иконки Firefox.

- Firefox для установленного движка Blade теперь получает идентификатор `BladeBrowser.Desktop`; прежняя запись Windows сохраняется в резервной копии.
- Фирменный лаунчер указывает Windows на `Blade.ico` и при запуске проверяет отложенное исправление плиток.
- Если старый обновлятор обновил оформление, но не смог прошить движок, он оставляет маркер. После закрытия Blade и следующего запуска из ярлыка **Blade Browser** патч движка применяется автоматически, а кэш запуска очищается.
- Исправление затрагивает только точный путь установленного движка Blade. `firefox.exe`, его подпись Mozilla, оформление, темы и фоны не меняются.

---

## Blade — Return

This release fixes two visible update regressions: removed new-tab tiles stay empty instead of being replaced with sites from history, and Blade windows use the branded icon instead of Firefox's icon.

- The installed Blade engine receives the `BladeBrowser.Desktop` identity; the previous Windows registry value is backed up.
- The Blade launcher points Windows to `Blade.ico` and checks for a deferred tile repair before opening the browser.
- If an older updater changed the browser chrome without patching its engine, it leaves a repair marker. After closing Blade, the next launch from the **Blade Browser** shortcut applies the engine patch and clears the startup cache.
- The repair targets the exact installed Blade engine path. The signed Mozilla `firefox.exe`, browser appearance, themes and backgrounds remain intact.
