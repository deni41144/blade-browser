using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace BladeSetup;

public class InstallProgressReport
{
    public double Percent { get; set; }
    public string Stage { get; set; } = string.Empty;
    public string CurrentItem { get; set; } = string.Empty;
    public long ProcessedBytes { get; set; }
    public long TotalBytes { get; set; }
}

public static class InstallerLogic
{
    public const string BladeVersion = "1.4.1"; // фолбэк, если VERSION из data.zip не читается

    /// <summary>
    /// Версия сборки из data.zip (profile/chrome/VERSION) — единственный источник
    /// истины, тот же файл, что читает меню B и HUD-бейдж браузера.
    /// </summary>
    public static string DetectedVersion { get; private set; } = BladeVersion;

    public static void InitDetectedVersion(string? dataZipPath)
    {
        try
        {
            if (string.IsNullOrEmpty(dataZipPath) || !File.Exists(dataZipPath)) return;
            using ZipArchive archive = ZipFile.OpenRead(dataZipPath);
            var entry = archive.Entries.FirstOrDefault(e =>
                e.FullName.Equals("profile/chrome/VERSION", StringComparison.OrdinalIgnoreCase));
            if (entry is null) return;
            using var sr = new StreamReader(entry.Open(), Encoding.UTF8);
            string v = sr.ReadToEnd().Trim().TrimStart('\uFEFF');
            if (!string.IsNullOrWhiteSpace(v)) DetectedVersion = v;
        }
        catch { }
    }

    public static string DefaultInstallPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Blade");

    /// <summary>
    /// Нормализация целевой папки (баг владельца 2026-09-14: «установщик
    /// распаковывает всё прямо в выбранное место»): юзер выбирает D:\Games —
    /// App\, Data\, Blade.ico летят вперемешку с чужими файлами. Если имя
    /// последнего сегмента не «Blade» и это не существующая установка —
    /// добавляем подпапку «Blade». Существующая установка (App\Blade\firefox.exe)
    /// и уже «…\Blade» не трогаются — обновление должно попадать в тот же корень.
    /// </summary>
    public static string EnsureBladeSubfolder(string targetDir)
    {
        if (string.IsNullOrWhiteSpace(targetDir)) return targetDir;

        string full = Path.GetFullPath(targetDir.Trim());
        // хвостовые слэши; «D:\» не режем до «D:» — оставляем диск корректным.
        // Пустое имя сегмента бывает только у корня диска — это как раз кейс
        // «добавить Blade» (распаковка прямо в корень = каша).
        string trimmed = full.TrimEnd('\\', '/');
        if (trimmed.Length <= 2) trimmed += '\\'; // корень диска («D:\»)
        string name = Path.GetFileName(trimmed);
        if (!name.Equals("Blade", StringComparison.OrdinalIgnoreCase) &&
            !IsExistingInstallation(trimmed))
        {
            return Path.Combine(trimmed, "Blade");
        }
        return trimmed;
    }

    /// <summary>
    /// Finds data.zip next to the installer executable.
    /// </summary>
    public static string? FindDataZipPath()
    {
        string baseDir = AppContext.BaseDirectory;
        string candidate1 = Path.Combine(baseDir, "data.zip");
        if (File.Exists(candidate1)) return candidate1;

        try
        {
            string? procDir = Path.GetDirectoryName(Process.GetCurrentProcess().MainModule?.FileName);
            if (!string.IsNullOrEmpty(procDir))
            {
                string candidate2 = Path.Combine(procDir, "data.zip");
                if (File.Exists(candidate2)) return candidate2;
            }
        }
        catch
        {
            // Ignore access limitations
        }

        return null;
    }

    /// <summary>
    /// Checks whether an existing Blade/Firefox installation resides in targetDir.
    /// </summary>
    public static bool IsExistingInstallation(string targetDir)
    {
        if (string.IsNullOrWhiteSpace(targetDir)) return false;
        string firefoxExe = Path.Combine(targetDir, "App", "Blade", "firefox.exe");
        return File.Exists(firefoxExe);
    }

    /// <summary>
    /// Checks if any Firefox instance is running from target directory.
    /// </summary>
    public static bool IsFirefoxRunningFromTarget(string targetDir)
    {
        string fullTarget = Path.GetFullPath(targetDir).TrimEnd('\\');
        try
        {
            var processes = Process.GetProcessesByName("firefox");
            foreach (var proc in processes)
            {
                try
                {
                    string? exePath = proc.MainModule?.FileName;
                    if (!string.IsNullOrEmpty(exePath) &&
                        Path.GetFullPath(exePath).StartsWith(fullTarget, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
                catch
                {
                    // MainModule недоступен (права/битность) — не наш процесс, пропускаем:
                    // чужой Firefox не должен блокировать установку Blade
                    continue;
                }
            }
        }
        catch
        {
            // Fallback
        }

        return false;
    }

    /// <summary>
    /// Performs safe cleaning of old engine and chrome files during an update,
    /// preserving all user personal data: prefs.js, cookies*, places*, logins*, key*,
    /// sessionstore*, chrome\img\custom_* and chrome\img\Без*.
    /// </summary>
    public static void CleanForUpdate(string targetDir)
    {
        string appDir = Path.Combine(targetDir, "App");
        if (Directory.Exists(appDir))
        {
            try
            {
                Directory.Delete(appDir, recursive: true);
            }
            catch
            {
                // If recursive delete fails on specific in-use file, delete contents individually
                DeleteDirectoryContentsSafe(appDir);
            }
        }

        string chromeDir = Path.Combine(targetDir, "Data", "profile", "chrome");
        if (Directory.Exists(chromeDir))
        {
            CleanChromeDirectoryPreservingCustom(chromeDir);
        }

        // Clean stale compatibility and plugin files that could conflict on relocation
        string profileDir = Path.Combine(targetDir, "Data", "profile");
        if (Directory.Exists(profileDir))
        {
            string compatFile = Path.Combine(profileDir, "compatibility.ini");
            if (File.Exists(compatFile))
            {
                try { File.Delete(compatFile); } catch { }
            }

            string pluginFile = Path.Combine(profileDir, "pluginreg.dat");
            if (File.Exists(pluginFile))
            {
                try { File.Delete(pluginFile); } catch { }
            }
        }
    }

    private static void DeleteDirectoryContentsSafe(string dirPath)
    {
        var dirInfo = new DirectoryInfo(dirPath);
        if (!dirInfo.Exists) return;

        foreach (var file in dirInfo.GetFiles())
        {
            try { file.Delete(); } catch { }
        }

        foreach (var subDir in dirInfo.GetDirectories())
        {
            try { subDir.Delete(true); } catch { }
        }
    }

    private static void CleanChromeDirectoryPreservingCustom(string chromeDir)
    {
        var chromeInfo = new DirectoryInfo(chromeDir);
        if (!chromeInfo.Exists) return;

        // Clean files in chrome root (userChrome.css, userContent.css, VERSION, etc.)
        foreach (var file in chromeInfo.GetFiles())
        {
            try { file.Delete(); } catch { }
        }

        // Handle subdirectories: JS, utils, img, themes, covers, etc.
        foreach (var subDir in chromeInfo.GetDirectories())
        {
            if (subDir.Name.Equals("img", StringComparison.OrdinalIgnoreCase))
            {
                // In img/: keep custom_* and Без*
                CleanImgDirectoryPreservingCustom(subDir);
            }
            else
            {
                // Delete all other subdirectories like JS, utils, etc. to replace with fresh ones
                try { subDir.Delete(recursive: true); } catch { }
            }
        }
    }

    private static void CleanImgDirectoryPreservingCustom(DirectoryInfo imgDir)
    {
        foreach (var file in imgDir.GetFiles())
        {
            string name = file.Name;
            bool isPreserved = name.StartsWith("custom_", StringComparison.OrdinalIgnoreCase) ||
                               name.StartsWith("Без", StringComparison.OrdinalIgnoreCase);
            if (!isPreserved)
            {
                try { file.Delete(); } catch { }
            }
        }

        foreach (var sub in imgDir.GetDirectories())
        {
            string name = sub.Name;
            bool isPreserved = name.StartsWith("custom_", StringComparison.OrdinalIgnoreCase) ||
                               name.StartsWith("Без", StringComparison.OrdinalIgnoreCase);
            if (!isPreserved)
            {
                try { sub.Delete(recursive: true); } catch { }
            }
        }
    }

    /// <summary>
    /// Unpacks data.zip to targetDir with real-time byte and entry progress reporting.
    /// Maps App/ -> {target}\FirefoxPortable\App\
    /// Maps profile/ -> {target}\FirefoxPortable\Data\profile\
    /// </summary>
    public static async Task ExtractDataZipAsync(
        string dataZipPath,
        string targetDir,
        IProgress<InstallProgressReport> progress,
        CancellationToken cancellationToken)
    {
        await Task.Run(() =>
        {
            using var archive = ZipFile.OpenRead(dataZipPath);

            var validEntries = archive.Entries
                .Where(e => !e.FullName.EndsWith('/') && !e.FullName.EndsWith('\\'))
                .ToList();

            long totalBytes = validEntries.Sum(e => e.Length);
            long processedBytes = 0;
            long processedEntries = 0;
            long totalEntries = validEntries.Count;

            const int bufferSize = 64 * 1024;
            byte[] buffer = new byte[bufferSize];

            foreach (var entry in validEntries)
            {
                cancellationToken.ThrowIfCancellationRequested();

                string normalized = entry.FullName.Replace('/', '\\').TrimStart('\\');
                string destPath;

                // Маппинг БЕЗ "FirefoxPortable" и БЕЗ "Firefox64":
                // App/Firefox64/... → {target}\App\Blade\...
                // profile/...       → {target}\Data\profile\...
                if (normalized.StartsWith("App\\", StringComparison.OrdinalIgnoreCase))
                {
                    string sub = normalized.Substring("App\\".Length);
                    // Заменяем Firefox64 → Blade в первом сегменте пути
                    if (sub.StartsWith("Firefox64\\", StringComparison.OrdinalIgnoreCase))
                    {
                        sub = "Blade\\" + sub.Substring("Firefox64\\".Length);
                    }
                    destPath = Path.Combine(targetDir, "App", sub);
                }
                else if (normalized.StartsWith("profile\\", StringComparison.OrdinalIgnoreCase))
                {
                    string sub = normalized.Substring("profile\\".Length);
                    destPath = Path.Combine(targetDir, "Data", "profile", sub);
                }
                else
                {
                    destPath = Path.Combine(targetDir, normalized);
                }

                string? dir = Path.GetDirectoryName(destPath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                string stage = "Распаковка...";
                if (normalized.StartsWith("App\\", StringComparison.OrdinalIgnoreCase))
                    stage = "Распаковка движка Firefox...";
                else if (normalized.StartsWith("profile\\chrome\\", StringComparison.OrdinalIgnoreCase))
                    stage = "Установка кастомизации Blade...";
                else if (normalized.StartsWith("profile\\", StringComparison.OrdinalIgnoreCase))
                    stage = "Настройка профиля...";

                // Stream copy entry with progress tracking
                using (var entryStream = entry.Open())
                using (var fileStream = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    int bytesRead;
                    while ((bytesRead = entryStream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        fileStream.Write(buffer, 0, bytesRead);
                        processedBytes += bytesRead;

                        double percent = totalBytes > 0
                            ? Math.Min(98.0, (double)processedBytes / totalBytes * 100.0)
                            : Math.Min(98.0, (double)processedEntries / Math.Max(1, totalEntries) * 100.0);

                        progress.Report(new InstallProgressReport
                        {
                            Percent = percent,
                            Stage = stage,
                            CurrentItem = Path.GetFileName(destPath),
                            ProcessedBytes = processedBytes,
                            TotalBytes = totalBytes
                        });
                    }
                }

                processedEntries++;
            }

            // Ensure compatibility.ini and pluginreg.dat are cleaned up if present
            string profileDir = Path.Combine(targetDir, "Data", "profile");
            try
            {
                string compat = Path.Combine(profileDir, "compatibility.ini");
                if (File.Exists(compat)) File.Delete(compat);
                string plugin = Path.Combine(profileDir, "pluginreg.dat");
                if (File.Exists(plugin)) File.Delete(plugin);
            }
            catch { }

        }, cancellationToken);
    }

    /// <summary>
    /// Deploys Blade.ico to {target}\Blade.ico.
    /// Checks adjacent folder first, then pack resources, then embedded resources.
    /// </summary>
    public static void DeployIcon(string targetDir)
    {
        string destIco = Path.Combine(targetDir, "Blade.ico");
        string localIco = Path.Combine(AppContext.BaseDirectory, "Blade.ico");

        if (File.Exists(localIco))
        {
            try
            {
                File.Copy(localIco, destIco, overwrite: true);
                return;
            }
            catch { }
        }

        // 1. Try WPF pack URI resource
        try
        {
            var res = System.Windows.Application.GetResourceStream(new Uri("/Blade.ico", UriKind.Relative))
                   ?? System.Windows.Application.GetResourceStream(new Uri("pack://application:,,,/Blade-Setup;component/Blade.ico", UriKind.Absolute));
            if (res != null)
            {
                using var fs = new FileStream(destIco, FileMode.Create, FileAccess.Write);
                res.Stream.CopyTo(fs);
                return;
            }
        }
        catch { }

        // 2. Try EmbeddedResource manifest stream
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            using var stream = assembly.GetManifestResourceStream("BladeSetup.Blade.ico")
                ?? assembly.GetManifestResourceStream("Blade-Setup.Blade.ico")
                ?? assembly.GetManifestResourceNames().Where(n => n.EndsWith("Blade.ico", StringComparison.OrdinalIgnoreCase)).Select(assembly.GetManifestResourceStream).FirstOrDefault();

            if (stream != null)
            {
                using var fs = new FileStream(destIco, FileMode.Create, FileAccess.Write);
                stream.CopyTo(fs);
            }
        }
        catch { }
    }

    /// <summary>
    /// Creates Start Menu and Desktop shortcuts via COM WScript.Shell.
    /// Target: {target}\FirefoxPortable\App\Firefox64\firefox.exe
    /// Args: -profile "{target}\FirefoxPortable\Data\profile"
    /// WorkDir: {target}\FirefoxPortable\App\Firefox64
    /// Icon: {target}\Blade.ico
    /// </summary>
    public static void CreateShortcuts(string targetDir, bool createDesktopShortcut)
    {
        string firefoxExe = Path.Combine(targetDir, "App", "Blade", "firefox.exe");
        string profileDir = Path.Combine(targetDir, "Data", "profile");
        string workDir = Path.Combine(targetDir, "App", "Blade");
        string iconPath = Path.Combine(targetDir, "Blade.ico");
        string arguments = $"-profile \"{profileDir}\"";

        Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType == null) return;

        dynamic shell = Activator.CreateInstance(shellType)!;

        // 1. Start Menu Shortcut
        try
        {
            string startMenuDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            string startMenuLnk = Path.Combine(startMenuDir, "Blade.lnk");
            dynamic smShortcut = shell.CreateShortcut(startMenuLnk);
            smShortcut.TargetPath = firefoxExe;
            smShortcut.Arguments = arguments;
            smShortcut.WorkingDirectory = workDir;
            if (File.Exists(iconPath))
            {
                smShortcut.IconLocation = $"{iconPath},0";
            }
            smShortcut.Save();
        }
        catch { }

        // 2. Desktop Shortcut
        if (createDesktopShortcut)
        {
            try
            {
                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string desktopLnk = Path.Combine(desktopDir, "Blade.lnk");
                dynamic dtShortcut = shell.CreateShortcut(desktopLnk);
                dtShortcut.TargetPath = firefoxExe;
                dtShortcut.Arguments = arguments;
                dtShortcut.WorkingDirectory = workDir;
                if (File.Exists(iconPath))
                {
                    dtShortcut.IconLocation = $"{iconPath},0";
                }
                dtShortcut.Save();
            }
            catch { }
        }
    }

    /// <summary>
    /// Creates {target}\Uninstall-Blade.bat (which copies itself to %TEMP% before deleting)
    /// and adds HKCU entry for "Programs and Features".
    /// </summary>
    public static void CreateUninstaller(string targetDir)
    {
        string batPath = Path.Combine(targetDir, "Uninstall-Blade.bat");
        string batContent =
            "@echo off\r\n" +
            "chcp 65001 >nul\r\n" +
            "setlocal\r\n" +
            "title Blade Uninstaller\r\n" +
            "echo ========================================================\r\n" +
            "echo               BLADE — ДЕИНСТАЛЛЯЦИЯ\r\n" +
            "echo ========================================================\r\n" +
            "\r\n" +
            ":: Fix: Self-copy to TEMP so bat does not lock its own folder\r\n" +
            "set \"TEMP_SCRIPT=%TEMP%\\blade_uninstall_worker_%RANDOM%.bat\"\r\n" +
            "if /i not \"%~dp0\"==\"%TEMP%\\\" (\r\n" +
            "    copy /y \"%~f0\" \"%TEMP_SCRIPT%\" >nul 2>&1\r\n" +
            "    start \"\" \"%TEMP_SCRIPT%\" \"%~dp0\"\r\n" +
            "    exit /b\r\n" +
            ")\r\n" +
            "\r\n" +
            ":: Running from TEMP\r\n" +
            "set \"TARGET_DIR=%~1\"\r\n" +
            "if \"%TARGET_DIR%\"==\"\" set \"TARGET_DIR=%~dp0\"\r\n" +
            "if \"%TARGET_DIR:~-1%\"==\"\\\" set \"TARGET_DIR=%TARGET_DIR:~0,-1%\"\r\n" +
            "\r\n" +
            "echo Закрытие запущенного браузера Blade...\r\n" +
            "taskkill /f /im firefox.exe >nul 2>&1\r\n" +
            "timeout /t 1 /nobreak >nul\r\n" +
            "\r\n" +
            "echo Удаление ярлыков...\r\n" +
            "del /f /q \"%USERPROFILE%\\Desktop\\Blade.lnk\" >nul 2>&1\r\n" +
            "del /f /q \"%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Blade.lnk\" >nul 2>&1\r\n" +
            "\r\n" +
            "echo Удаление записи из реестра...\r\n" +
            "reg delete \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Blade\" /f >nul 2>&1\r\n" +
            "\r\n" +
            "echo Удаление файлов Blade...\r\n" +
            "timeout /t 2 /nobreak >nul\r\n" +
            "rmdir /s /q \"%TARGET_DIR%\" >nul 2>&1\r\n" +
            "\r\n" +
            "echo [BLADE] Деинсталляция успешно завершена.\r\n" +
            "timeout /t 2 /nobreak >nul\r\n" +
            "\r\n" +
            ":: Remove temp worker script\r\n" +
            "(goto) 2>nul & del \"%~f0\"\r\n";

        try
        {
            File.WriteAllText(batPath, batContent, Encoding.UTF8);
        }
        catch { }

        // Register in HKCU Programs and Features
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Blade");
            if (key != null)
            {
                key.SetValue("DisplayName", "Blade Browser");
                key.SetValue("DisplayVersion", DetectedVersion);
                key.SetValue("Publisher", "Blade-Creations");
                key.SetValue("DisplayIcon", Path.Combine(targetDir, "Blade.ico"));
                key.SetValue("InstallLocation", targetDir);
                key.SetValue("UninstallString", $"cmd.exe /c \"\"{batPath}\"\"");
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
        }
        catch { }
    }

    /// <summary>
    /// Launches Blade with the portable profile.
    /// </summary>
    public static void LaunchBlade(string targetDir)
    {
        string firefoxExe = Path.Combine(targetDir, "App", "Blade", "firefox.exe");
        string profileDir = Path.Combine(targetDir, "Data", "profile");
        string workDir = Path.Combine(targetDir, "App", "Blade");

        if (!File.Exists(firefoxExe)) return;

        var startInfo = new ProcessStartInfo
        {
            FileName = firefoxExe,
            Arguments = $"-profile \"{profileDir}\"",
            WorkingDirectory = workDir,
            UseShellExecute = true
        };

        Process.Start(startInfo);
    }

    /// <summary>
    /// Loads license text from adjacent file, pack resource, or embedded resource.
    /// </summary>
    public static string LoadLicenseText()
    {
        string localLicense = Path.Combine(AppContext.BaseDirectory, "license.txt");
        if (File.Exists(localLicense))
        {
            try { return File.ReadAllText(localLicense, Encoding.UTF8); } catch { }
        }

        // 1. Try WPF pack URI resource
        try
        {
            var res = System.Windows.Application.GetResourceStream(new Uri("/license.txt", UriKind.Relative))
                   ?? System.Windows.Application.GetResourceStream(new Uri("pack://application:,,,/Blade-Setup;component/license.txt", UriKind.Absolute));
            if (res != null)
            {
                using var reader = new StreamReader(res.Stream, Encoding.UTF8);
                return reader.ReadToEnd();
            }
        }
        catch { }

        // 2. Try EmbeddedResource
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            using var stream = assembly.GetManifestResourceStream("BladeSetup.license.txt")
                ?? assembly.GetManifestResourceStream("Blade-Setup.license.txt")
                ?? assembly.GetManifestResourceNames().Where(n => n.EndsWith("license.txt", StringComparison.OrdinalIgnoreCase)).Select(assembly.GetManifestResourceStream).FirstOrDefault();

            if (stream != null)
            {
                using var reader = new StreamReader(stream, Encoding.UTF8);
                return reader.ReadToEnd();
            }
        }
        catch { }

        return "BLADE BROWSER — LICENSE\nDenis Bobliksov";
    }

    /// <summary>
    /// Сидинг profiles.ini / installs.ini для «голого» запуска firefox.exe без
    /// -profile (автозагрузка, пин таскбара, двойной клик): движок резолвит
    /// профиль по секции [Install&lt;ХЭШ&gt;] в %APPDATA%\Mozilla\Firefox\profiles.ini,
    /// где ХЭШ = CityHash64 пути каталога движка. Без секции Firefox создаёт
    /// свежий «обычный» профиль. Идемпотентно: чужие секции и профили не
    /// трогаем, при первом изменении бэкап *.blade-bak. Fail-soft — ошибки
    /// глотаются, установку сидинг ломать не должен. Живой профиль
    /// дополнительно подстраивает BladeProfileGuard.uc.js (канал патчей).
    /// </summary>
    public static void SeedFirefoxProfilesIni(string targetDir)
    {
        try
        {
            // P2-аудит: перевод строки в targetDir инъектирует секцию INI — режем
            targetDir = targetDir.Replace("\r", "").Replace("\n", "");
            if (string.IsNullOrWhiteSpace(targetDir)) return;

            string installDir = Path.Combine(targetDir, "App", "Blade");
            string profileDir = Path.Combine(targetDir, "Data", "profile");
            // Хэш каталога движка: UTF-16LE байты пути БЕЗ терминатора (Encoding.Unicode).
            // P2-аудит: движок хэширует КАНОНИЧЕСКИЙ путь (nsXREDirProvider делает
            // ResolveJunctionPointsAndSymLinks перед CityHash64) — регистр/джанкшены
            // введённого targetDir могут дать чужой хэш, канонизируем (фолбэк: как есть)
            string hash = CityHash.Hash64(
                Encoding.Unicode.GetBytes(CanonicalizePathCase(installDir))).ToString("X");

            string appDataFF = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "Mozilla", "Firefox");
            Directory.CreateDirectory(appDataFF);

            string profilesIniPath = Path.Combine(appDataFF, "profiles.ini");
            string installsIniPath = Path.Combine(appDataFF, "installs.ini");

            // profiles.ini: нет — создаём только с нашими секциями; есть — идемпотентно правим
            if (File.Exists(profilesIniPath))
            {
                var ini = EnsureProfilesIni(File.ReadAllText(profilesIniPath, Encoding.UTF8), hash, profileDir);
                if (ini.Changed)
                {
                    BackupOnce(profilesIniPath);
                    WriteIni(profilesIniPath, ini.Text);
                }
            }
            else
            {
                WriteIni(profilesIniPath, EnsureProfilesIni(string.Empty, hash, profileDir).Text);
            }

            // installs.ini: секция [<ХЭШ>] Default/Locked=1 (файла может не быть)
            if (File.Exists(installsIniPath))
            {
                var ini = EnsureInstallsIni(File.ReadAllText(installsIniPath, Encoding.UTF8), hash, profileDir);
                if (ini.Changed)
                {
                    BackupOnce(installsIniPath);
                    WriteIni(installsIniPath, ini.Text);
                }
            }
            else
            {
                WriteIni(installsIniPath, EnsureInstallsIni(string.Empty, hash, profileDir).Text);
            }
        }
        catch
        {
            // fail-soft: сидинг не должен валить установку
        }
    }

    /// <summary>
    /// 1.4.2: русский из коробки — langpack-ru едет в chrome\extensions
    /// поставки; сетап кладёт его в профиль и прописывает в policies
    /// (механизм боевой копии владельца, но с путём машины пользователя;
    /// инцидент 2026-09-14 «в Browser Language нету русского»). Идемпотентно:
    /// xpi копируется поверх, дубликат пути в Extensions.Install не пишется,
    /// остальные ключи (uBO/SponsorBlock/DarkReader и пр.) сохраняются.
    /// Fail-soft — ошибки глотаются, установку не валить.
    /// </summary>
    public static void SeedLangpackPolicy(string targetDir)
    {
        try
        {
            // P2-аудит: перевод строки в targetDir — инъекция в JSON, режем
            targetDir = targetDir.Replace("\r", "").Replace("\n", "");
            if (string.IsNullOrWhiteSpace(targetDir)) return;

            // Поставка без langpack (старая data.zip) — тихо выходим
            string src = Path.Combine(targetDir, "Data", "profile", "chrome",
                "extensions", "langpack-ru@firefox.mozilla.org.xpi");
            if (!File.Exists(src)) return;

            string dstDir = Path.Combine(targetDir, "Data", "profile", "extensions");
            Directory.CreateDirectory(dstDir);
            string dst = Path.Combine(dstDir, "langpack-ru@firefox.mozilla.org.xpi");
            File.Copy(src, dst, true);

            // policies нет — прописывать некуда, тихо выходим
            string policiesPath = Path.Combine(targetDir, "App", "Blade",
                "distribution", "policies.json");
            if (!File.Exists(policiesPath)) return;

            // JsonNode: читаем-мутируем-пишем, чужие ключи не теряем.
            // Отсутствующие узлы создаём (боевой policies их имеет, но
            // стойкость к ручной правке друга дешевле, чем падение)
            var root = JsonNode.Parse(File.ReadAllText(policiesPath, Encoding.UTF8));
            if (root is null) return;
            var policies = root["policies"] as JsonObject ?? new JsonObject();
            root["policies"] = policies;
            var extensions = policies["Extensions"] as JsonObject ?? new JsonObject();
            policies["Extensions"] = extensions;
            var install = extensions["Install"] as JsonArray ?? new JsonArray();
            extensions["Install"] = install;

            if (!install.Any(n => n is JsonValue v &&
                    v.TryGetValue<string>(out string? s) &&
                    string.Equals(s, dst, StringComparison.OrdinalIgnoreCase)))
            {
                install.Add(JsonValue.Create(dst));
                // Отступы + UTF-8 без BOM: каноничный JSON движка
                File.WriteAllText(policiesPath,
                    JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true }),
                    new UTF8Encoding(false));
            }
        }
        catch
        {
            // fail-soft: русский из коробки не должен валить установку
        }
    }

    /// <summary>
    /// profiles.ini: [Install&lt;ХЭШ&gt;] Default=&lt;профиль&gt; Locked=1 и [ProfileN]
    /// с нашим Path (поиск по Path, иначе следующий свободный N, Name=Blade,
    /// IsRelative=0). Чужие секции не трогает.
    /// </summary>
    private static IniEditor EnsureProfilesIni(string text, string hash, string profileDir)
    {
        var ini = new IniEditor(text);
        // P2-аудит: Gecko считает profiles.ini без [General] битым — при
        // создании с нуля всегда добавляем каноничную шапку
        if (text.Length == 0)
        {
            ini.AppendSection("General", new (string, string)[]
            {
                ("StartWithLastProfile", "1"),
                ("Version", "2"),
            });
        }
        string installName = "Install" + hash;

        var sec = ini.FindSection(installName);
        if (sec is null)
        {
            ini.AppendSection(installName, new (string Key, string Value)[]
            {
                ("Default", profileDir),
                ("Locked", "1"),
            });
        }
        else
        {
            ini.SetKey(sec, "Default", profileDir);
            ini.SetKey(sec, "Locked", "1");
        }

        var profRe = new Regex(@"^profile(\d+)$", RegexOptions.IgnoreCase);
        bool have = false;
        foreach (var s in ini.AllSections())
        {
            if (profRe.IsMatch(s.Name) &&
                string.Equals(ini.GetKeyValue(s, "Path"), profileDir, StringComparison.OrdinalIgnoreCase))
            {
                have = true;
                break;
            }
        }
        if (!have)
        {
            // Движок перебирает Profile0, Profile1, ... ПОДРЯД и ОБРЫВАЕТСЯ на первом
            // пропуске (nsToolkitProfileService: секции за дыркой движку НЕВИДИМЫ —
            // голый запуск уходит в менеджер профилей). Поэтому номер новой секции =
            // НАИМЕНЬШИЙ свободный: занимаем дырки, чужие секции не перенумеровываем
            // и не удаляем (баг-фикс: maxN+1 сохранял пропуск нумерации).
            var taken = new HashSet<int>();
            foreach (var s in ini.AllSections())
            {
                Match m = profRe.Match(s.Name);
                if (m.Success)
                {
                    taken.Add(int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture));
                }
            }
            int n = 0;
            while (taken.Contains(n)) n++;
            ini.AppendSection("Profile" + n.ToString(CultureInfo.InvariantCulture), new (string, string)[]
            {
                ("Name", "Blade"),
                ("IsRelative", "0"),
                ("Path", profileDir),
            });
        }
        return ini;
    }

    /// <summary>
    /// installs.ini: секция [&lt;ХЭШ&gt;] Default=&lt;профиль&gt; Locked=1.
    /// </summary>
    private static IniEditor EnsureInstallsIni(string text, string hash, string profileDir)
    {
        var ini = new IniEditor(text);
        var sec = ini.FindSection(hash);
        if (sec is null)
        {
            ini.AppendSection(hash, new (string, string)[]
            {
                ("Default", profileDir),
                ("Locked", "1"),
            });
        }
        else
        {
            ini.SetKey(sec, "Default", profileDir);
            ini.SetKey(sec, "Locked", "1");
        }
        return ini;
    }

    /// <summary>UTF-8 без BOM, CRLF — так пишут INI-файлы сам движок Firefox.</summary>
    private static void WriteIni(string path, string text)
    {
        File.WriteAllText(path, text, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
    }

    /// <summary>Бэкап ровно один раз: пока *.blade-bak нет, исходник уходит туда целиком.</summary>
    private static void BackupOnce(string path)
    {
        string bak = path + ".blade-bak";
        if (!File.Exists(bak))
        {
            File.Copy(path, bak, overwrite: false);
        }
    }

    #region Канонизация пути (P2-аудит: регистр влияет на CityHash64 инсталла)

    private const uint GENERIC_READ = 0x80000000;
    private const uint FILE_SHARE_READ_WRITE_DELETE = 0x7; // READ|WRITE|DELETE
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000; // открывает и каталоги

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateFileW(
        string lpFileName, uint dwDesiredAccess, uint dwShareMode,
        IntPtr lpSecurityAttributes, uint dwCreationDisposition,
        uint dwFlagsAndAttributes, IntPtr hTemplateFile);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern uint GetFinalPathNameByHandleW(
        IntPtr hFile, System.Text.StringBuilder lpszFilePath, uint cchFilePath, uint dwFlags);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    /// <summary>
    /// Канонический путь (регистр с диска + разворот junction/symlink) — так же,
    /// как движок готовит каталог к CityHash64 (ResolveJunctionPointsAndSymLinks).
    /// internal — для тестов. fail-soft: любая ошибка → исходный путь.
    /// </summary>
    internal static string CanonicalizePathCase(string path)
    {
        IntPtr h = IntPtr.Zero;
        try
        {
            h = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ_WRITE_DELETE,
                IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, IntPtr.Zero);
            if (h == IntPtr.Zero || h == (IntPtr)(-1)) return path;
            var sb = new System.Text.StringBuilder(4096);
            uint len = GetFinalPathNameByHandleW(h, sb, (uint)sb.Capacity, 0);
            if (len == 0 || len >= sb.Capacity) return path;
            string full = sb.ToString();
            // префикс \\?\ от GetFinalPathNameByHandle — движок его не пишет
            if (full.StartsWith(@"\\?\", StringComparison.Ordinal))
            {
                full = full.Substring(4);
            }
            return full;
        }
        catch
        {
            return path;
        }
        finally
        {
            if (h != IntPtr.Zero && h != (IntPtr)(-1))
            {
                try { CloseHandle(h); } catch { }
            }
        }
    }

    #endregion

    /// <summary>
    /// Мини-редактор INI: построчный, каждую операцию пересканирует секции —
    /// файлы крошечные, зато индексы не протухают после вставок. Чужие строки
    /// не переформатируются. Выход: CRLF, завершающий перевод строки.
    /// </summary>
    private sealed class IniEditor
    {
        private readonly List<string> _lines;
        public bool Changed { get; private set; }

        public IniEditor(string text)
        {
            _lines = text.Length == 0
                ? new List<string>()
                : new List<string>(text.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None));
        }

        internal sealed class Section
        {
            public string Name = string.Empty;
            public int Start;
            public int End;
        }

        public List<Section> AllSections()
        {
            var result = new List<Section>();
            Section? cur = null;
            for (int i = 0; i < _lines.Count; i++)
            {
                Match m = Regex.Match(_lines[i], @"^\s*\[([^\]]*)\]");
                if (m.Success)
                {
                    if (cur != null) cur.End = i;
                    cur = new Section { Name = m.Groups[1].Value.Trim(), Start = i, End = _lines.Count };
                    result.Add(cur);
                }
            }
            return result;
        }

        public Section? FindSection(string name)
        {
            foreach (Section s in AllSections())
            {
                if (string.Equals(s.Name, name, StringComparison.OrdinalIgnoreCase)) return s;
            }
            return null;
        }

        public void SetKey(Section sec, string key, string value)
        {
            string line = key + "=" + value;
            int i = FindKeyLine(sec, key);
            if (i >= 0)
            {
                if (_lines[i] != line)
                {
                    _lines[i] = line;
                    Changed = true;
                }
                return;
            }
            // вставка после последней содержательной строки секции (пустые-разделители не рвём)
            int at = sec.End;
            while (at > sec.Start + 1 && _lines[at - 1].Trim().Length == 0) at--;
            _lines.Insert(at, line);
            Changed = true;
        }

        public string? GetKeyValue(Section sec, string key)
        {
            int i = FindKeyLine(sec, key);
            return i < 0 ? null : _lines[i].Substring(_lines[i].IndexOf('=') + 1).Trim();
        }

        public void AppendSection(string name, IEnumerable<(string Key, string Value)> kv)
        {
            if (_lines.Count > 0 && _lines[^1].Trim().Length > 0)
            {
                _lines.Add(string.Empty);
            }
            _lines.Add("[" + name + "]");
            foreach ((string key, string value) in kv)
            {
                _lines.Add(key + "=" + value);
            }
            Changed = true;
        }

        public string Text => _lines.Count == 0
            ? string.Empty
            : string.Join("\r\n", _lines) + "\r\n";

        private int FindKeyLine(Section sec, string key)
        {
            for (int i = sec.Start + 1; i < sec.End; i++)
            {
                int eq = _lines[i].IndexOf('=');
                if (eq >= 0 && _lines[i].Substring(0, eq).Trim().Equals(key, StringComparison.OrdinalIgnoreCase))
                {
                    return i;
                }
            }
            return -1;
        }
    }
}

/// <summary>
/// Порт CityHash64 v1.0 (Mozilla-vendored: other-licenses/nsis/Contrib/CityHash) —
/// им движок считает хэш инсталла для секций [InstallXXXX] в profiles.ini.
/// Эталон: cityhash_blade.py (порт 1:1, проверен по живым парам). Формат движка —
/// %llX (верхний регистр, без ведущих нулей), вход — UTF-16LE байты пути каталога
/// firefox.exe без терминатора. ulong-арифметика требует unchecked-контекста
/// (перенос по модулю 2^64).
/// </summary>
internal static class CityHash
{
    private const ulong K0 = 0xC3A5C85C97CB3127UL;
    private const ulong K1 = 0xB492B66FBE98F273UL;
    private const ulong K2 = 0x9AE16A3B2F90404FUL;
    private const ulong K3 = 0xC949D7C7509E6557UL;
    private const ulong KMul = 0x9DDFEA08EB382D69UL;

    /// <summary>Чистая функция: CityHash64 v1.0 по байтам (порт cityhash_blade.py).</summary>
    internal static ulong Hash64(byte[] s)
    {
        int len = s.Length;
        if (len <= 32)
        {
            return len <= 16 ? Hash0To16(s) : Hash17To32(s);
        }
        if (len <= 64)
        {
            return Hash33To64(s);
        }

        unchecked
        {
            ulong x = Load64(s, 0);
            ulong y = Load64(s, len - 16) ^ K1;
            ulong z = Load64(s, len - 56) ^ K0;
            (ulong A, ulong B) v = WeakHash32(s, len - 64, (ulong)len, y);
            (ulong A, ulong B) w = WeakHash32(s, len - 32, (ulong)len * K1, K0);
            z += Mix(v.B) * K1;
            x = Rot(z + x, 39) * K1;
            y = Rot(y, 33) * K1;

            // хвост: ((длина-1) & ~63) байт чанками по 64
            int tail = (len - 1) & ~63;
            int i = 0;
            while (true)
            {
                x = Rot(x + y + v.A + Load64(s, i + 16), 37) * K1;
                y = Rot(y + v.B + Load64(s, i + 48), 42) * K1;
                x ^= w.B;
                y ^= v.A;
                z = Rot(z ^ w.A, 33);
                v = WeakHash32(s, i, v.B * K1, x + w.A);
                w = WeakHash32(s, i + 32, z + w.B, y);
                (z, x) = (x, z);
                i += 64;
                tail -= 64;
                if (tail == 0) break;
            }
            return Hash128To64(
                Hash128To64(v.A, w.A) + Mix(y) * K1 + z,
                Hash128To64(v.B, w.B) + x);
        }
    }

    private static ulong Hash0To16(byte[] s)
    {
        int len = s.Length;
        unchecked
        {
            if (len > 8)
            {
                ulong a = Load64(s, 0);
                ulong b = Load64(s, len - 8);
                return Hash128To64(a, Rot(b + (ulong)len, len)) ^ b;
            }
            if (len >= 4)
            {
                ulong a = Load32(s, 0);
                return Hash128To64((ulong)len + (a << 3), Load32(s, len - 4));
            }
            if (len > 0)
            {
                ulong a = s[0];
                ulong b = s[len >> 1];
                ulong c = s[len - 1];
                ulong y = a + (b << 8);
                ulong z = (ulong)len + (c << 2);
                return Mix(y * K2 ^ z * K3) * K2;
            }
            return K2;
        }
    }

    private static ulong Hash17To32(byte[] s)
    {
        int len = s.Length;
        unchecked
        {
            ulong a = Load64(s, 0) * K1;
            ulong b = Load64(s, 8);
            ulong c = Load64(s, len - 8) * K2;
            ulong d = Load64(s, len - 16) * K0;
            return Hash128To64(
                Rot(a - b, 43) + Rot(c, 30) + d,
                a + Rot(b ^ K3, 20) - c + (ulong)len);
        }
    }

    private static ulong Hash33To64(byte[] s)
    {
        int len = s.Length;
        unchecked
        {
            ulong z = Load64(s, 24);
            ulong a = Load64(s, 0) + ((ulong)len + Load64(s, len - 16)) * K0;
            ulong b = Rot(a + z, 52);
            ulong c = Rot(a, 37);
            a += Load64(s, 8);
            c += Rot(a, 7);
            a += Load64(s, 16);
            ulong vf = a + z;
            ulong vs = b + Rot(a, 31) + c;
            a = Load64(s, 16) + Load64(s, len - 32);
            z = Load64(s, len - 8);
            b = Rot(a + z, 52);
            c = Rot(a, 37);
            a += Load64(s, len - 24);
            c += Rot(a, 7);
            a += Load64(s, len - 16);
            ulong wf = a + z;
            ulong ws = b + Rot(a, 31) + c;
            ulong r = Mix((vf + ws) * K2 + (wf + vs) * K0);
            return Mix(r * K0 + vs) * K2;
        }
    }

    private static (ulong A, ulong B) WeakHash32(ulong w, ulong x, ulong y, ulong z, ulong a, ulong b)
    {
        unchecked
        {
            a += w;
            b = Rot(b + a + z, 21);
            ulong c = a;
            a += x;
            a += y;
            b += Rot(a, 44);
            return (a + z, b + c);
        }
    }

    private static (ulong A, ulong B) WeakHash32(byte[] s, int off, ulong a, ulong b) =>
        WeakHash32(Load64(s, off), Load64(s, off + 8), Load64(s, off + 16), Load64(s, off + 24), a, b);

    private static ulong Hash128To64(ulong u, ulong v)
    {
        unchecked
        {
            ulong a = (u ^ v) * KMul;
            a ^= a >> 47;
            ulong b = (v ^ a) * KMul;
            b ^= b >> 47;
            return b * KMul;
        }
    }

    private static ulong Rot(ulong val, int shift) =>
        shift == 0 ? val : (val >> shift) | (val << (64 - shift));

    private static ulong Mix(ulong val) => val ^ (val >> 47);

    private static ulong Load64(byte[] s, int i) =>
        s[i] | ((ulong)s[i + 1] << 8) | ((ulong)s[i + 2] << 16) | ((ulong)s[i + 3] << 24)
        | ((ulong)s[i + 4] << 32) | ((ulong)s[i + 5] << 40) | ((ulong)s[i + 6] << 48)
        | ((ulong)s[i + 7] << 56);

    private static ulong Load32(byte[] s, int i) =>
        s[i] | ((ulong)s[i + 1] << 8) | ((ulong)s[i + 2] << 16) | ((ulong)s[i + 3] << 24);
}
