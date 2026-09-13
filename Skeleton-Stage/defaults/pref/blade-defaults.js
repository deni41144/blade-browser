// Blade: движковые дефолты — гасят «дефолтный первый запуск Firefox»
// на ЛЮБОМ профиле этого движка (fresh-профиль, чужой профиль, после обновления).
// Это дефолты (не user-префы): всё, что юзер меняет руками, перебивает их.

// Первый запуск: никаких welcome-страниц и отложенных туров
pref("browser.aboutwelcome.enabled", false);
pref("browser.startup.homepage_welcome_url", "");
pref("browser.startup.homepage_welcome_url.additional", "");
pref("startup.homepage_welcome_url", "");
pref("startup.homepage_override_url", "");
pref("browser.laterrun.enabled", false);
pref("browser.uitour.enabled", false);

// Не спрашивать про дефолтный браузер
pref("browser.shell.checkDefaultBrowser", false);
pref("browser.shell.skipDefaultBrowserCheckOnFirstRun", true);
pref("browser.defaultbrowser.notificationbar", false);

// Не дёргать пользователя телеметрией и опросами
pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);

// Обновления только наши (Update-Blade), движок сам не обновляется
pref("app.update.enabled", false);
pref("app.update.auto", false);

// Настройки: без рекламы Mozilla и входа в их аккаунты
pref("browser.preferences.moreFromMozilla", false);
// about:addons: без витрины Discover (ссылки на mozilla.org)
pref("extensions.htmlaboutaddons.discover.enabled", false);
// about:config: без Firefox-предупреждения
pref("general.warnOnAboutConfig", false);
pref("general.warnOnAboutProfiling", false);
// Падения обрабатываем локально, ничего не отправляем Mozilla
// (crashreporter.exe из движка удалён)
pref("breakpad.reportURL", "");
pref("browser.crashReports.unsubmittedCheck.enabled", false);
pref("browser.crashReports.unsubmittedCheck.autoSubmit2", false);
// DevTools сразу тёмные
pref("devtools.theme", "dark");

// Переводчик страниц: нативный офлайн Firefox Translations (модели качаются
// один раз, перевод идёт локально, никуда не отправляется). Панель сама
// всплывает на страницах на чужом языке.
pref("extensions.translations.disabled", false);
pref("browser.translations.automaticallyPopup", true);

/* НАШИ ПЛИТКИ ВМЕСТО ДЕФОЛТНЫХ FIREFOX: на свежем профиле нет истории
   и закладок — Firefox показывает свои 4 стоковых ярлыка (Wiki, Amazon...).
   Этот преф подставляет НАШИ сайты, для которых есть тематические обложки */
pref("browser.newtabpage.activity-stream.default.sites", "[{\"url\":\"https://youtube.com\",\"title\":\"YouTube\"},{\"url\":\"https://music.youtube.com\",\"title\":\"YouTube Music\"},{\"url\":\"https://instagram.com\",\"title\":\"Instagram\"},{\"url\":\"https://www.olx.ua\",\"title\":\"OLX\"},{\"url\":\"https://pinterest.com\",\"title\":\"Pinterest\"},{\"url\":\"https://rozetka.com.ua\",\"title\":\"Rozetka\"},{\"url\":\"https://temu.com\",\"title\":\"Temu\"},{\"url\":\"https://aliexpress.com\",\"title\":\"AliExpress\"},{\"url\":\"https://mail.google.com\",\"title\":\"Gmail\"},{\"url\":\"https://classroom.google.com\",\"title\":\"Classroom\"}]");
