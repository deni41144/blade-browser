## Что нового

Плавность повседневной работы, аккуратное управление фоновыми вкладками и фирменное обновление Blade.

- В режимах Eco и энергосбережения теперь останавливаются также погодные анимации снега, звёзд и тумана на новой вкладке, включая неактивные окна.
- При 18 и более вкладках фоновые вкладки показывают значки без обрезанных фрагментов заголовков, активная вкладка сохраняет место для названия.
- Часы панели браузера (формат HH:mm, без секунд) синхронизируются раз в минуту; большой циферблат новой вкладки продолжает обновлять секунды каждую секунду. Визуальные эффекты Blade сохранены.
- Декоративные анимации панели приостанавливаются в свёрнутых и неактивных окнах и продолжаются после возврата фокуса; активное окно сохраняет полный визуал.
- Неиспользуемые веб-вкладки автоматически выгружаются через 30 минут бездействия с сохранением сессии. Закреплённые, активные, приватные вкладки, звук, PiP и демонстрация экрана защищены; оформление панели не меняется.
- Удалены ручные overrides для графики, GC, сетевых буферов и медиапредзагрузки без подтверждённого выигрыша.
- Предзагрузка новой вкладки отключена: анимированная Blade-страница не создаётся до открытия вкладки.
- Установщик выпускается одним автономным EXE со встроенным движком; пакет проверяется по SHA-256 и распаковывается во временную папку до переключения установки.
- Обновлятор получил фирменную панель Blade с читаемой хроникой, понятным прогрессом, кнопкой отмены и клавиатурным управлением. Автообновление выбирает патч, проверяет наличие SHA-256 и передаёт архив установщику только после полной загрузки.
- Установщик показывает режим обновления отдельно от первой установки, использует актуальную эмблему Blade и ограничивает частоту декоративных кадров и обновлений прогресса; оформление не меняется во время установки.
- Архив патча и установщик сначала собираются во временных файлах и проверяются; готовая версия заменяет прошлый локальный артефакт только после успешной сборки, с возможностью отката.
- Full-сборка автоматически брендирует системные строки, страницы сведений и логотипы Blade; иллюстрации встроенных страниц сохраняются.

Patch-пакет содержит только кастомизацию. Движок — Firefox 158.0; исходный `firefox.exe` сохраняет действительную подпись Mozilla Corporation. Юридические страницы сохраняют атрибуцию Mozilla.

---

## English

**Blood Moon** brings smoother everyday use, more deliberate background-tab handling and a polished Blade update experience.

- Eco and battery-saver modes now pause snow, star and fog effects on the new-tab page, including in inactive windows.
- With 18 or more tabs, background tabs show their icons without clipped title fragments; the selected tab keeps room for its title.
- The browser-toolbar clock displays hours and minutes and refreshes once a minute. The large new-tab clock still updates every second. Blade's visual effects remain intact.
- Decorative browser-chrome animations pause while a window is minimized or inactive and resume when it regains focus. The active window keeps the full visual experience.
- Unused web tabs are unloaded after 30 minutes of inactivity; Firefox SessionStore preserves their session. Active, pinned, private, audible, Picture-in-Picture and screen-sharing tabs are protected.
- Removed unverified internal overrides for graphics, garbage collection, network buffers and media preloading.
- Disabled new-tab preloading so the animated Blade page is created only when requested.
- The standalone installer embeds the browser, verifies its package with SHA-256 and stages files before switching an installation.
- The Blade updater now has a branded release panel, readable notes, clear progress, cancellation and keyboard controls. It downloads patches to disk, checks for the published SHA-256 file and starts the installer only after the download completes.
- The installer distinguishes updates from first-time installation, uses the current Blade emblem and limits decorative frames and progress refreshes during installation.
- Patch archives and the installer are built and verified in staging files before replacing local artifacts; previous files remain available for recovery.
- Full packages apply Blade branding to application strings, information pages and logos while preserving built-in Firefox illustrations.

Patch packages contain Blade customizations only. The engine is Firefox 158.0; the original `firefox.exe` retains its valid Mozilla Corporation signature. Mozilla attribution remains on the legal pages.
