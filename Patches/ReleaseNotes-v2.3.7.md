## Blade — Reforged

Восстановление поведения Blade после регрессии: плитки новой вкладки снова показывают только закреплённые сайты, а незаполненные места остаются пустыми. Полная сборка теперь получает тот же патч движка, что и обычное обновление. При обновлении Blade повторно запускается через фирменный ярлык, чтобы сохранить имя и значок приложения.

- Исправлено самопроизвольное заполнение плиток сайтами из истории.
- Один и тот же движковый патч плиток применяется и в Patch, и в Full; сборка проверяет его наличие до упаковки.
- Совместимый с предыдущим обновлятором сценарий чинит движок только после закрытия Blade и очищает startupCache после успешной прошивки.
- После обновления новый апдейтер открывает Blade через его фирменный ярлык и не меняет подписанный `firefox.exe`.
- Существующий интерфейс Blade, темы, фон новой вкладки и пользовательские обои сохранены.

---

## Blade — Reforged

This release restores Blade behavior after a regression: new-tab tiles now show only pinned sites, and unused slots stay empty. Full builds receive the same engine patch as regular updates. Updates relaunch Blade through its branded shortcut to preserve the app identity and icon.

- Fixed new-tab tiles filling themselves with sites from browsing history.
- Patch and Full packages now apply the same tile engine patch, and the build verifies that it is present before packaging.
- A compatibility path lets the previous updater repair the engine only after Blade has closed, then clears `startupCache` after a successful patch.
- The new updater relaunches Blade through its branded shortcut and leaves the signed `firefox.exe` untouched.
- Blade's interface, themes, new-tab artwork and personal wallpapers are preserved.
