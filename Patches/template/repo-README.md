<table>
  <tr>
    <td width="18%" align="center" valign="middle">
      <img src="Branding/master_icon.png" alt="Оригинальная эмблема Blade" width="150">
    </td>
    <td width="82%" valign="middle">
      <img src="assets/blade-github-hero.svg" alt="Blade — Свой знак / Our Mark" width="100%">
    </td>
  </tr>
</table>

<p align="center">
  <a href="https://github.com/deni41144/blade-browser/releases/latest/download/Blade-Setup.exe"><img src="https://img.shields.io/badge/Скачать%20Blade-Windows%20x64-C8102E?style=for-the-badge&logo=windows&logoColor=white" alt="Скачать Blade для Windows x64"></a>
  <a href="https://github.com/deni41144/blade-browser/releases/latest"><img src="https://img.shields.io/badge/Текущая%20глава-Свой%20знак-292329?style=for-the-badge" alt="Текущий релиз — Свой знак"></a>
  <a href="https://github.com/deni41144/blade-browser/releases"><img src="https://img.shields.io/badge/Архив-всех%20релизов-292329?style=for-the-badge&logo=github&logoColor=white" alt="Все релизы Blade"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-10%20%2F%2011-55515A" alt="Windows 10 и 11">
  <img src="https://img.shields.io/badge/Engine-Firefox%20Gecko-FF7139" alt="Движок Firefox Gecko">
  <img src="https://img.shields.io/badge/Release-Our%20Mark-C8102E" alt="Release Our Mark">
</p>

<p align="center"><a href="#ru">Русский</a> · <a href="#en">English</a></p>

---

<a id="ru"></a>

## Blade — браузер с характером

Blade — браузер для Windows на движке Firefox. Gecko остаётся под капотом; Blade добавляет свой интерфейс, тёмные темы, оформление сайтов и инструменты управления фоновыми вкладками.

**Текущая глава — «Свой знак» / Our Mark.** У релизов есть имена, а технические номера сохранены только в тегах и файлах: они нужны для безопасного поиска обновлений и отката.

### Скачать и начать

- **Установить впервые:** [скачать автономный установщик](https://github.com/deni41144/blade-browser/releases/latest/download/Blade-Setup.exe). Браузер уже внутри — отдельный Firefox не нужен.
- **Обновить Blade:** откройте **B → Обновы → Проверить сейчас** или скачайте патч со [страницы текущего релиза](https://github.com/deni41144/blade-browser/releases/latest).
- **Найти предыдущий выпуск:** откройте [архив релизов](https://github.com/deni41144/blade-browser/releases). Доступные файлы и SHA-256 указаны на странице каждого выпуска.

Установщик рассчитан на Windows x64. Он пока **не подписан сертификатом издателя**, поэтому Windows может показать предупреждение SmartScreen. Чтобы проверить загруженный файл, сравните вывод `Get-FileHash` с `.sha256` из того же релиза:

```powershell
Get-FileHash .\Blade-Setup.exe -Algorithm SHA256
```

### Что меняет Blade

**Интерфейс и визуал**

- 10 тёмных тем и конструктор своей темы, панель B, плитки и обложки сайтов.
- Новая вкладка с авторскими фонами, часами, погодой и ярлыками.
- Темы и анимации Blade остаются включены в активном окне.

**Работа в фоне**

- Неиспользуемые веб-вкладки выгружаются после 30 минут бездействия; закреплённые вкладки, звук, PiP и демонстрация экрана защищены.
- Эффекты приостанавливаются у свёрнутого или неактивного окна и возвращаются вместе с фокусом.
- Расход памяти зависит от сайтов, расширений и открытых страниц; фиксированный объём RAM не обещается.

### Приватность и устройство

- Blade основан на Firefox и использует движок Gecko; это кастомная сборка, а не новый движок браузера.
- Защиту от отслеживания обеспечивает Firefox ETP и uBlock Origin.
- DNS-over-HTTPS настраивается пользователем; Blade не обещает скрыть посещённые сайты от всех сетевых сторон.
- Обновлятор Blade загружает патч потоком на диск, проверяет SHA-256, делает резервную копию и умеет откатывать неудачное применение.
- Фирменный значок назначается самим окнам Blade; обновление также переводит старые ярлыки и закреплённые ссылки с `firefox.exe` на Blade launcher.
- В сборке используется Firefox `158.0`; исходный `firefox.exe` сохраняет действительную подпись Mozilla Corporation.

### Имена релизов

Начиная с **Кровавой Луны / Blood Moon**, у каждого обновления будет собственное имя-глава. Номер останется в технической метке и именах файлов, чтобы updater мог безопасно сравнивать сборки и выполнять откат. Старые выпуски сохраняют свои исходные заголовки.

---

<a id="en"></a>

## Blade — a browser with a point of view

Blade is a Windows browser built on Firefox. Gecko stays under the hood; Blade adds its own interface, dark themes, website artwork and background-tab controls.

**The current chapter is “Our Mark.”** Releases have names; technical numbers remain in tags and filenames so the updater can compare builds and roll back safely.

### Download and get started

| You need | Go here |
|---|---|
| Install Blade | [Download the standalone installer](https://github.com/deni41144/blade-browser/releases/latest/download/Blade-Setup.exe). The browser is embedded; no separate Firefox download is needed. |
| Update Blade | Open **B → Обновы → Проверить сейчас**, or choose the patch on the [latest release page](https://github.com/deni41144/blade-browser/releases/latest). |
| Browse previous releases | [All releases](https://github.com/deni41144/blade-browser/releases). Available downloads and SHA-256 files are listed on each release page. |

The installer targets Windows x64. It is **not signed with a publisher certificate**, so Windows SmartScreen may show a warning. Compare `Get-FileHash` with the `.sha256` file from the same release to verify a download.

### What Blade adds

- Ten dark themes, a custom theme builder, the B panel, themed tiles and website artwork.
- An authored new-tab page with backgrounds, a clock, weather and shortcuts.
- Unused web tabs unload after 30 minutes. Pinned tabs, audio, Picture-in-Picture and screen sharing are protected.
- Browser effects pause while the window is minimized or unfocused and return with focus; the active window keeps its full Blade look.
- Memory use depends on websites, extensions and open pages; Blade does not promise a fixed RAM number.
- Firefox Enhanced Tracking Protection and uBlock Origin. DNS-over-HTTPS stays user-configurable.
- One-click updates with streamed downloads, SHA-256 verification, backup and rollback.
- The Blade taskbar icon is applied to browser windows; updates also repair old shortcuts that launched `firefox.exe` directly.

Blade uses Firefox `158.0`; the original `firefox.exe` keeps its valid Mozilla Corporation signature. Blade is a custom Firefox build, not a separate browser engine.

### Release names

Starting with **Blood Moon**, each update gets its own chapter name. The technical tag and filenames stay in place so the updater can compare builds and recover safely. Older releases keep their original titles.

---

## Credits and license

- Browser, code, interface and themes — **Denis Bobliksov**.
- Widget and cover artwork — **zxvolfik**, used with permission and attribution.
- Firefox is distributed under the Mozilla Public License 2.0. See [LICENSE.md](LICENSE.md) for the engine, Blade code and artwork terms.

*Blade is an independent project based on Mozilla Firefox. It is not affiliated with or endorsed by Mozilla. Firefox is a trademark of the Mozilla Foundation.*
