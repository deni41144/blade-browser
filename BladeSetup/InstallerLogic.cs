using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
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
}
