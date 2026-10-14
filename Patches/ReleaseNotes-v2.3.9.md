## Blade — Единый знак

Исправлена регистрация фирменного значка на Windows для 64-битного Blade. Firefox читает свой `TaskBarIDs` из нативного представления реестра; если старая запись существовала только в 32-битной ветке, теперь создаётся пользовательская запись для недостающего представления. Windows получает фирменный значок из `Blade.ico`.

- Удалённые плитки новой вкладки остаются пустыми: сайты из истории их не занимают.
- Обработка пустых слотов не ломает список Top Sites у расширений.
- Выбор браузера по умолчанию и подпись Mozilla не меняются.

---

## Blade — One Mark

Fixed branded taskbar identity registration on 64-bit Windows. Firefox reads `TaskBarIDs` from the registry view matching its process architecture; when an older mapping exists only in the 32-bit view, Blade now adds a per-user fallback in the missing view. Windows can resolve the Blade icon from `Blade.ico`.

- Removed new-tab tiles stay empty instead of being replaced with sites from history.
- Empty tile slots no longer break the Top Sites list exposed to extensions.
- Windows default-browser choices and Mozilla's executable signature remain unchanged.
