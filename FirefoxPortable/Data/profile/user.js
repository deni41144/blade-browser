// Firefox Portable — включение userContent.css / userChrome.css
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);

// Тёмная тема для всех сайтов (сайты со своей dark-версией включают её автоматически)
user_pref("layout.css.prefers-color-scheme.content-override", 2);

// ============================================================================
// ПРИВАТНОСТЬ: Уровень 1 — Телеметрия Mozilla (всё глухо)
// ============================================================================
user_pref("toolkit.telemetry.unified", false);
user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.archive.enabled", false);
user_pref("toolkit.telemetry.newProfilePing.enabled", false);
user_pref("toolkit.telemetry.shutdownPingSender.enabled", false);
user_pref("toolkit.telemetry.firstShutdownPing.enabled", false);
user_pref("toolkit.telemetry.bhrPing.enabled", false);
user_pref("toolkit.telemetry.updatePing.enabled", false);
user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
// --- «Скелет» волна B (2.0): телефоны, жившие только в prefs.js владельца или
// --- включённые по умолчанию — имена сверены с greprefs/firefox.js движка
user_pref("app.normandy.enabled", false);            // Normandy: эксперименты Mozilla
user_pref("app.shield.optoutstudies.enabled", false); // Shield-исследования
user_pref("browser.discovery.enabled", false);        // Discovery-панель about:addons
user_pref("browser.ping-centre.telemetry", false);    // Ping-centre (Activity Stream)
user_pref("dom.push.connection.enabled", false);      // push-канал Mozilla (фон-уведомления сайтов)

// --- «Чистый Лист» (фаза 8, 2026-09-13): AI-контролы — нативная блокировка ---
// ⚠️ browser.ai.control.default НЕ ТРОГАТЬ: "blocked" убил бы и переводчик.
// Переводчик (browser.ai.control.translations) остаётся в "default" — модели
// его качаются из Remote Settings, от ML-стека независим (проверено по коду).
user_pref("browser.ai.control.sidebarChatbot", "blocked");       // чатбот-сайдбар + «Ask chatbot»
user_pref("browser.ai.control.smartWindow", "blocked");          // AI-окно, агент, памяти
user_pref("browser.ai.control.linkPreviewKeyPoints", "blocked"); // link preview с key points
user_pref("browser.ai.control.smartTabGroups", "blocked");       // ML-группировка вкладок
user_pref("browser.ai.control.pdfjsAltText", "blocked");         // AI-подписи картинок в PDF
user_pref("browser.smartwindow.agent.enabled", false);
user_pref("browser.smartwindow.memories.generateFromHistory", false);
user_pref("browser.smartwindow.memories.generateFromConversation", false);
user_pref("browser.smartwindow.autoTabGrouping.enabled", false);
user_pref("browser.smartwindow.sidebar.openByDefault", false);
user_pref("browser.ml.chat.enabled", false);
user_pref("browser.ml.chat.sidebar", false);
user_pref("browser.ml.chat.menu", false);
user_pref("browser.ml.chat.shortcuts", false);
user_pref("browser.ml.chat.page", false);
user_pref("browser.ml.linkPreview.enabled", false);
user_pref("browser.ml.enable", false);                // on-device ML-инфраструктура (перевод НЕ зависит — проверено)
user_pref("extensions.ml.enabled", false);            // ML API для расширений
user_pref("browser.preferences.aiControls", false);   // вся категория AI из настроек
user_pref("browser.tabs.groups.smart.enabled", false);
user_pref("browser.tabs.groups.smart.userEnabled", false);
// языки веб-страниц: только русский и английский (каталог выбора в движке
// режется омни-хирургией — Apply-Blade-CleanSheet.ps1, 287 → 3)
user_pref("intl.accept_languages", "ru, en-US, en");
user_pref("breakpad.reportURL", "");
user_pref("browser.tabs.crashReporting.sendReport", false);
user_pref("browser.crashReports.unsubmittedCheck.autoSubmit2", false);
user_pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
user_pref("browser.newtabpage.activity-stream.telemetry", false);
user_pref("browser.newtabpage.activity-stream.telemetry.ut.events", false);

// ============================================================================
// ПРИВАТНОСТЬ: Уровень 2 — Стукачество (Safe Browsing, гео, captive portal)
// ============================================================================
user_pref("browser.safebrowsing.malware.enabled", false);
user_pref("browser.safebrowsing.phishing.enabled", false);
user_pref("browser.safebrowsing.downloads.enabled", false);
user_pref("browser.safebrowsing.downloads.remote.enabled", false);
user_pref("browser.safebrowsing.allowGoogleLists", false);
user_pref("browser.safebrowsing.provider.google.gethashURL", "");
user_pref("browser.safebrowsing.provider.google4.gethashURL", "");
user_pref("browser.safebrowsing.provider.google4.dataSharing.enabled", false);
user_pref("browser.safebrowsing.reportPhishURL", "");
user_pref("geo.enabled", false);
user_pref("geo.provider.network.url", "");
user_pref("network.captive-portal-service.enabled", false);
user_pref("network.connectivity-service.enabled", false);

// ============================================================================
// ПРИВАТНОСТЬ: Уровень 3 — Сеть (никаких упреждающих запросов)
// ============================================================================
user_pref("network.prefetch-next", false);
user_pref("network.predictor.enable-prefetch", false);

user_pref("browser.search.hiddenOneOffs", "Bing,DuckDuckGo,eBay,Ecosia,Qwant,Wikipedia,Amazon.com,Yandex");

/* --- Кэш в RAM: берегём флешку и ускоряем страницы --- */
user_pref("browser.cache.disk.enable", false);
user_pref("browser.cache.memory.enable", true);
user_pref("browser.cache.memory.capacity", 262144); /* 256 МБ */

/* --- Быстрый старт и меньше записей на флешку --- */
user_pref("browser.sessionstore.resume_from_crash", false);
user_pref("browser.sessionstore.interval", 300000);
user_pref("browser.startup.homepage_override.mstone", "ignore");

/* ============================================================================
   ФИНАЛЬНЫЙ ПОЛИШ: лёгкость + удобство (Bobliks-Creations final)
   ============================================================================ */

/* --- ЛЁГКОСТЬ: новая вкладка не тянет ничего из сети --- */
user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
user_pref("browser.newtabpage.activity-stream.feeds.system.topstories", false);
user_pref("browser.newtabpage.activity-stream.system.showWeather", false);
user_pref("browser.newtabpage.activity-stream.feeds.weather", false);
user_pref("browser.newtabpage.activity-stream.showSponsored", false);
user_pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
user_pref("browser.newtabpage.activity-stream.feeds.recommendationproviders", false);
user_pref("browser.newtabpage.activity-stream.feeds.snippets", false);
user_pref("browser.newtabpage.activity-stream.feeds.mozLogo", false);

/* Pocket — вообще выключен */
user_pref("extensions.pocket.enabled", false);

/* ETP Strict — Firefox сам рубит трекеры: страницы грузятся быстрее */
user_pref("browser.contentblocking.category", "strict");

/* --- УДОБСТВО --- */
/* Плавный скролл страниц */
user_pref("general.smoothScroll", true);
/* Закладки открываются в новых вкладках, не убивая текущую */
user_pref("browser.tabs.loadBookmarksInTabs", true);
/* Ctrl+Tab — панель превью вкладок (как в GX/Win11) */
user_pref("browser.ctrlTab.sortByRecentlyUsed", true);
/* Больше отмен закрытых вкладок (Ctrl+Shift+T достаёт глубже) */
user_pref("browser.sessionstore.max_tabs_undo", 40);
/* Панель закладок видна только на новой вкладке — чисто при просмотре */
user_pref("browser.toolbars.bookmarks.visibility", "newtab");


/* --- Поиск: ТОЛЬКО Google (прячем выбор движков в адресной строке) --- */
user_pref("browser.urlbar.scotchBonnet.enableOverride", false);

/* ============================================================================
   BLADE: РЕЖИМ СКОРОСТИ — визуал не трогаем, аппетиты режем
   ============================================================================ */

/* --- ПРОЦЕССЫ И ПАМЯТЬ --- */
user_pref("dom.ipc.processCount", 4);                     /* 4 контентных процесса вместо ~8 */
user_pref("fission.autostart", false);                    /* Fission принудителен в release — установка скорее no-op; статус: about:support → Fission */
user_pref("browser.sessionhistory.max_total_viewers", 2); /* меньше копий страниц в памяти */
user_pref("browser.tabs.unloadOnLowMemory", true);        /* фоновые вкладки выгружаются при нехватке RAM */
user_pref("browser.shell.checkDefaultBrowser", false);    /* не проверять дефолтность при старте */
/* Диета памяти 2.0 (webIsolated 2, медиа/имидж-лимиты) — ОТКАЧЕНА владельцем
   2026-09-13: −20-25 МБ не стоят потенциальных цен (пере-декод картинок,
   до-буферизация видео). Стенд замеров живёт в TestReports\measure-ram.ps1 */

/* --- СЕТЬ: скорость отклика --- */
user_pref("network.predictor.enabled", true);             /* преконнекты к часто посещаемым сайтам */
                                                          /* enable-prefetch=false задан в ПРИВАТНОСТИ Ур.3 */
user_pref("browser.urlbar.speculativeConnect.enabled", true);
user_pref("network.dns.disablePrefetch", false);          /* DNS-префетч обратно: страницы открываются шустрее */
user_pref("network.dns.disablePrefetchFromHTTPS", false);
user_pref("network.http.http3.enable", true);             /* HTTP/3 (QUIC) где поддерживается */

/* --- ОТРИСОВКА --- */
user_pref("media.hardware-video-decoding.enabled", true); /* видео грузит GPU, а не CPU */
user_pref("browser.newtab.preload", true);                /* новая вкладка готова до открытия */


/* --- BLADE: обновления только вручную через Update-Blade (апдейтер удалён) --- */
user_pref("app.update.enabled", false);
user_pref("app.update.auto", false);

/* --- BLADE: ВСЕ штатные виджеты новой вкладки выкл — часы+погода в тулбаре --- */
user_pref("browser.newtabpage.activity-stream.widgets.enabled", false);
user_pref("browser.newtabpage.activity-stream.widgets.weather.enabled", false);
user_pref("browser.newtabpage.activity-stream.widgets.clocks.enabled", false);
user_pref("browser.newtabpage.activity-stream.widgets.system.weather.enabled", false);
user_pref("browser.newtabpage.activity-stream.widgets.system.clocks.enabled", false);

/* --- BLADE: шифрованный DNS (DoH) + ECH ---
   Провайдер больше не видит, какие сайты ты открываешь (DNS уходит по HTTPS
   в Cloudflare). Режим 2: DoH первым, при сбое фолбэк на системный DNS —
   качество не теряется никогда. ECH прячет домен даже на рукопожатии TLS. */
user_pref("network.trr.mode", 2);
user_pref("network.trr.uri", "https://cloudflare-dns.com/dns-query");
user_pref("network.dns.echconfig.enable", true);
user_pref("browser.aboutwelcome.enabled", false);

/* ============================================================================
   BLADE: ЧИСТЫЙ ЛИСТ — стирание Firefox (этапы 1.1/1.4/3.1 плана)
   ============================================================================ */

// Настройки: без рекламы продуктов Mozilla и их аккаунтов
user_pref("browser.preferences.moreFromMozilla", false);
// about:addons: без витрины Discover ( mozilla.org)
user_pref("extensions.htmlaboutaddons.discover.enabled", false);
// about:config: без Firefox-предупреждения
user_pref("general.warnOnAboutConfig", false);
user_pref("general.warnOnAboutProfiling", false);
// Падения локально, отчёты Mozilla выключены (crashreporter.exe удалён)
// breakpad.reportURL и autoSubmit2 уже заданы выше — дубли убраны
user_pref("browser.crashReports.unsubmittedCheck.enabled", false);
// DevTools сразу тёмные
user_pref("devtools.theme", "dark");
// Нативный офлайн-переводчик: панель сама предлагается на чужом языке
user_pref("extensions.translations.disabled", false);
user_pref("browser.translations.automaticallyPopup", true);

/* --- BLADE: ОТЗЫВЧИВОСТЬ И СКОРОСТЬ (раунд 6) --- */

/* Пружинная физика скролла MSD: упругий, тактильный скролл как на 120 Гц
   смартфонах — вместо «мыльного» дефолтного smoothScroll */
user_pref("general.smoothScroll.msdPhysics.enabled", true);
user_pref("general.smoothScroll.msdPhysics.continuousMotionMaxDeltaMS", 250);
user_pref("general.smoothScroll.msdPhysics.motionBeginSpringConstant", 450);
user_pref("general.smoothScroll.msdPhysics.regularSpringConstant", 650);

/* Тяжёлые сайты (Reddit, маркетплейсы): вдвое больше параллельных соединений
   на сервер — картинки грузятся не в очереди */
user_pref("network.http.max-persistent-connections-per-server", 12);

/* --- BLADE: CYBER-STEALTH РАЗГОН (раунд 7) --- */

/* Спекулятивный пре-коннект: TCP/TLS поднимается по НАВЕДЕНИЮ на ссылку,
   до клика; подсказки адресной строки коннектятся на опережение */
user_pref("network.http.speculative-parallel-limit", 6);
/* disablePrefetch и speculativeConnect уже заданы в «СЕТЬ» — дубли убраны */

/* HTTP/3 QUIC: мгновенное открытие Cloudflare/Google (0-RTT рукопожатие) */
user_pref("network.http.http3.retry_different_ip_family", true);

/* Реактивный отклик: тултипы за 120мс вместо ~500, первый чанк HTML
   рендерится немедленно */
user_pref("ui.tooltipDelay", 120);
user_pref("nglayout.initialpaint.delay", 0);

/* Колесо мыши: шаг срабатывает резко и цепко, без ватного скольжения
   (Gemini раунд 12) */
user_pref("general.smoothScroll.mouseWheel.durationMinMS", 60);
user_pref("general.smoothScroll.mouseWheel.durationMaxMS", 140);

/* --- BLADE: РАЗГОН ДВИЖКА (раунд 20, отфильтровано ревью) --- */

/* Предкомпиляция шейдеров WebRender: нет статтеров при первом рендере
   градиентов/свечений/блюров (имя префа precache-shaders, не pre-cache) */
user_pref("gfx.webrender.precache-shaders", true);
user_pref("gfx.webrender.compositor", true);

/* Дисковый кэш выключен, а лимит ОДНОГО файла в мем-кэше был дефолтных
   5 МБ — обои и бандлы тяжелее перекачивались заново. Шапка 50 МБ */
user_pref("browser.cache.memory.max_entry_size", 51200);
user_pref("image.mem.decode_bytes_at_a_time", 65536);

/* TLS-сессии: 32768 токенов вместо 2048 — повторные заходы без
   повторного криптографического рукопожатия */
user_pref("network.ssl_tokens_cache_capacity", 32768);

/* Запросы страницы улетают залпом, без искусственного пейсинга */
user_pref("network.http.pacing.requests.enabled", false);
user_pref("network.buffer.cache.size", 262144);

/* GC квантами по 10 мс: главный поток не замерзает дольше кадра (144 Гц) */
user_pref("javascript.options.mem.gc_incremental_slice_ms", 10);

/* --- BLADE: ФИНАЛЬНЫЕ ШТРИХИ (раунд 21) --- */

/* История до 15к страниц вместо 100к+: places.sqlite не разрастается,
   автодополнение адресной строки не деградирует со временем */
user_pref("places.history.expiration.max_pages", 15000);

/* Автоплей видео/аудио строго заблокирован до клика: фоновые вкладки
   (Twitter, новости, стримы) не жрут трафик и не орут в наушники */
user_pref("media.autoplay.default", 5);

/* НАШИ ПЛИТКИ: дефолтные сайты новой вкладки — наши, не Firefox-овские
   (Wiki/Amazon). Покрыты тематическими обложками для всех 9 тем */
user_pref("browser.newtabpage.activity-stream.default.sites", "[{\"url\":\"https://youtube.com\",\"title\":\"YouTube\"},{\"url\":\"https://music.youtube.com\",\"title\":\"YouTube Music\"},{\"url\":\"https://instagram.com\",\"title\":\"Instagram\"},{\"url\":\"https://www.olx.ua\",\"title\":\"OLX\"},{\"url\":\"https://pinterest.com\",\"title\":\"Pinterest\"},{\"url\":\"https://rozetka.com.ua\",\"title\":\"Rozetka\"},{\"url\":\"https://temu.com\",\"title\":\"Temu\"},{\"url\":\"https://aliexpress.com\",\"title\":\"AliExpress\"},{\"url\":\"https://mail.google.com\",\"title\":\"Gmail\"},{\"url\":\"https://classroom.google.com\",\"title\":\"Classroom\"}]");

/* --- BLADE: АУДИО КАЧЕСТВО (без потери производительности) --- */

/* Медиа-кэш 256МБ: YouTube не сбрасывает качество при микрозадержках сети */
user_pref("media.cache_size", 262144);
user_pref("media.cache_readahead_limit", 999999);
user_pref("media.cache_resume_threshold", 999999);

/* Аудио не зависит от этого префа (он управляет только декодированием
   видео): включаем сейвер по умолчанию — фоновое видео перестаёт жечь
   GPU/CPU впустую, когда смотришь только музыку (фикс Gemini-ревью) */
user_pref("media.suspend-background-video.enabled", true);

/* --- BLADE: АНТИ-ДЕТЕКТ АДБЛОКА (против плашек «выключите блокировщик» и
   самопроизвольной остановки YouTube Music) ---
   YouTube детектит адблокер и ставит воспроизведение на паузу. Список
   Adblock Warning Removal List (awrl) + Annoyance-листы убирают детект-стены.
   adminSettings = управляемый режим uBlock: списки зашиты жёстко и
   не отключаются из интерфейса (наш браузер — наши правила) */
user_pref("ublock0.adminSettings", '{"selectedFilterLists":["user-filters","ublock-filters","ublock-quick-fixes","ublock-annoyance","ublock-badware","ublock-privacy","ublock-unbreak","easylist","easyprivacy","adguard-generic","adguard-annoyance","adguard-social","awrl"]}');

/* Фоновое видео подвешивается только ЧЕРЕЗ ЧАС (вместо 10 секунд):
   раньше suspend обрывал звук YouTube Music в фоне — медиа-пайплайн
   сидит на video-элементе, и мгновенное suspend'ы его роняли */
user_pref("media.suspend-background-video.delay-ms", 3600000);

/* --- BLADE: АНИМАЦИИ КЛИНКА НЕ ГАСИТЬ ---
   Windows с выключенными «эффектами анимации» (SPI_GETCLIENTAREAANIMATION=off,
   частая настройка под производительность) заставляет Firefox считать
   prefers-reduced-motion: reduce — и вежливый блок REDUCED MOTION из
   userChrome v1.7.0 гасил ВСЕ легендарные пульсации тем (кнопка B, дымки,
   лучи). Личность клинка важнее: форсим «без уменьшения движения» внутри
   браузера, системная настройка остаётся нетронутой для остальных программ. */
user_pref("ui.prefersReducedMotion", 0);
