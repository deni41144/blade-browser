using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
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
    private const string EmbeddedPayloadResource = "BladeSetup.BladePayload.zip";
    private const string EmbeddedPayloadHashResource = "BladeSetup.BladePayload.sha256";
    private const long MaxPayloadBytes = 2L * 1024 * 1024 * 1024;
    private const int MaxPayloadEntries = 25000;
    private static readonly string[] ReservedWindowsNames =
        { "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9" };

    public const string BladeVersion = "2.3.6"; // версия пакета, если VERSION не читается

    /// <summary>
    /// Версия сборки из data.zip (profile/chrome/VERSION) — единственный источник
    /// истины, тот же файл, что читает меню B и HUD-бейдж браузера.
    /// </summary>
    public static string DetectedVersion { get; private set; } = BladeVersion;

    public static void InitDetectedVersion(string? dataZipPath)
    {
        try
        {
            using ZipArchive archive = OpenPayloadArchive(dataZipPath);
            var entry = archive.Entries.FirstOrDefault(e =>
                NormalizeArchivePath(e.FullName).Equals("profile/VERSION", StringComparison.OrdinalIgnoreCase) ||
                NormalizeArchivePath(e.FullName).Equals("profile/chrome/VERSION", StringComparison.OrdinalIgnoreCase));
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
        if (HasEmbeddedPayload()) return null;
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

    public static bool HasDataPayload(string? dataZipPath = null) =>
        HasEmbeddedPayload() || (!string.IsNullOrWhiteSpace(dataZipPath) && File.Exists(dataZipPath));

    private static bool HasEmbeddedPayload() =>
        Assembly.GetExecutingAssembly().GetManifestResourceInfo(EmbeddedPayloadResource) is not null;

    private static Stream OpenPayloadStream(string? dataZipPath)
    {
        var assembly = Assembly.GetExecutingAssembly();
        if (HasEmbeddedPayload())
            return assembly.GetManifestResourceStream(EmbeddedPayloadResource)
                ?? throw new InvalidDataException("В установщике не удалось открыть встроенный пакет Blade.");

        if (!string.IsNullOrWhiteSpace(dataZipPath) && File.Exists(dataZipPath))
            return new FileStream(dataZipPath, FileMode.Open, FileAccess.Read, FileShare.Read);

        throw new FileNotFoundException("Пакет Blade не найден. Пересоберите комплект установщика.");
    }

    private static ZipArchive OpenPayloadArchive(string? dataZipPath) =>
        new(OpenPayloadStream(dataZipPath), ZipArchiveMode.Read);

    private static string ReadExpectedPayloadHash(string? dataZipPath)
    {
        var assembly = Assembly.GetExecutingAssembly();
        using Stream? embedded = assembly.GetManifestResourceStream(EmbeddedPayloadHashResource);
        if (embedded is not null)
        {
            using var reader = new StreamReader(embedded, Encoding.ASCII, detectEncodingFromByteOrderMarks: false);
            return ParseSha256(reader.ReadToEnd());
        }

        string? sidecar = string.IsNullOrWhiteSpace(dataZipPath) ? null : dataZipPath + ".sha256";
        if (sidecar is null || !File.Exists(sidecar))
            throw new InvalidDataException("Не найден SHA-256 пакета. Скачайте комплект установщика заново.");
        return ParseSha256(File.ReadAllText(sidecar, Encoding.ASCII));
    }

    private static string ParseSha256(string text)
    {
        string hash = text.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? string.Empty;
        if (hash.Length != 64 || !hash.All(Uri.IsHexDigit))
            throw new InvalidDataException("Файл SHA-256 имеет неверный формат.");
        return hash.ToUpperInvariant();
    }

    private static string NormalizeArchivePath(string path) => path.Replace('\\', '/');

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
    /// Checks if the Firefox engine or Blade's launcher is running from target directory.
    /// </summary>
    public static bool IsFirefoxRunningFromTarget(string targetDir)
    {
        string root = Path.GetFullPath(targetDir).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string expectedFirefox = Path.GetFullPath(Path.Combine(root, "App", "Blade", "firefox.exe"));
        string expectedLauncher = Path.GetFullPath(Path.Combine(root, "BladeBrowser.exe"));
        foreach (string processName in new[] { "firefox", "BladeBrowser" })
        {
            try
            {
                foreach (var proc in Process.GetProcessesByName(processName))
                {
                    using (proc)
                    {
                        try
                        {
                            string? exePath = proc.MainModule?.FileName;
                            if (!string.IsNullOrEmpty(exePath))
                            {
                                string fullPath = Path.GetFullPath(exePath);
                                if (fullPath.Equals(expectedFirefox, StringComparison.OrdinalIgnoreCase) ||
                                    fullPath.Equals(expectedLauncher, StringComparison.OrdinalIgnoreCase))
                                    return true;
                            }
                        }
                        catch
                        {
                            // Чужой недоступный процесс не должен блокировать установку Blade.
                        }
                    }
                }
            }
            catch { }
        }
        return false;
    }

    private sealed record PayloadEntry(ZipArchiveEntry Entry, string RelativePath, string ArchivePath);

    /// <summary>
    /// Extracts into a unique sibling staging directory. Existing installs are
    /// switched only after the complete archive has been checked and extracted.
    /// </summary>
    public static async Task InstallDataZipAsync(
        string? dataZipPath,
        string targetDir,
        bool isUpdate,
        IProgress<InstallProgressReport> progress,
        CancellationToken cancellationToken)
    {
        string target = Path.GetFullPath(targetDir);
        string? parent = Path.GetDirectoryName(target.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        if (string.IsNullOrWhiteSpace(parent))
            throw new InvalidOperationException("Выберите папку установки внутри диска, а не корень диска.");

        Directory.CreateDirectory(parent);
        string stage = Path.Combine(parent, $".{Path.GetFileName(target)}.blade-stage-{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(stage);
            await ExtractDataZipAsync(dataZipPath, stage, progress, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();

            progress.Report(new InstallProgressReport
            {
                Percent = 98.5,
                Stage = isUpdate ? "Безопасное обновление..." : "Завершение установки...",
                CurrentItem = "Подготовка файлов и сохранение профиля"
            });

            await Task.Run(() => CommitStagedInstallation(stage, target, isUpdate), CancellationToken.None);
        }
        finally
        {
            TryDeleteDirectory(stage);
        }
    }

    private static void CommitStagedInstallation(string stageDir, string targetDir, bool isUpdate)
    {
        string target = Path.GetFullPath(targetDir);
        string stage = Path.GetFullPath(stageDir);
        string stagedApp = Path.Combine(stage, "App");
        string stagedProfile = Path.Combine(stage, "Data", "profile");
        string stagedChrome = Path.Combine(stagedProfile, "chrome");
        string stagedUserJs = Path.Combine(stagedProfile, "user.js");

        if (!File.Exists(Path.Combine(stagedApp, "Blade", "firefox.exe")) ||
            !File.Exists(Path.Combine(stagedChrome, "userChrome.css")) ||
            !File.Exists(Path.Combine(stagedChrome, "utils", "boot.sys.mjs")) ||
            !File.Exists(Path.Combine(stagedChrome, "resources", "BladeBrowser.exe")) ||
            !File.Exists(stagedUserJs))
            throw new InvalidDataException("В пакете не хватает обязательных файлов Firefox, Blade или фирменного launcher.");

        if (!isUpdate)
        {
            if (Directory.Exists(target) && Directory.EnumerateFileSystemEntries(target).Any())
                throw new IOException("Для новой установки выберите пустую папку.");

            string emptyTargetBackup = CreateSiblingPath(target, "empty-backup");
            bool movedEmptyTarget = false;
            try
            {
                if (Directory.Exists(target))
                {
                    Directory.Move(target, emptyTargetBackup);
                    movedEmptyTarget = true;
                }
                Directory.Move(stage, target);
                if (movedEmptyTarget) TryDeleteDirectory(emptyTargetBackup);
            }
            catch
            {
                if (movedEmptyTarget && !Directory.Exists(target) && Directory.Exists(emptyTargetBackup))
                    Directory.Move(emptyTargetBackup, target);
                throw;
            }
            return;
        }

        if (!IsExistingInstallation(target))
            throw new IOException("Существующая установка Blade не найдена; обновление отменено.");

        string appDir = Path.Combine(target, "App");
        string profileDir = Path.Combine(target, "Data", "profile");
        string chromeDir = Path.Combine(profileDir, "chrome");
        string userJs = Path.Combine(profileDir, "user.js");
        PreserveUserWallpapers(Path.Combine(chromeDir, "img"), Path.Combine(stagedChrome, "img"));

        string backupRoot = CreateSiblingPath(target, "rollback");
        Directory.CreateDirectory(backupRoot);
        string backupApp = Path.Combine(backupRoot, "App");
        string backupChrome = Path.Combine(backupRoot, "chrome");
        string backupUserJs = Path.Combine(backupRoot, "user.js");
        bool oldAppMoved = false, newAppMoved = false;
        bool oldChromeMoved = false, newChromeMoved = false;
        bool oldUserJsMoved = false, newUserJsMoved = false;

        try
        {
            if (Directory.Exists(appDir)) { Directory.Move(appDir, backupApp); oldAppMoved = true; }
            Directory.Move(stagedApp, appDir); newAppMoved = true;

            Directory.CreateDirectory(profileDir);
            if (Directory.Exists(chromeDir)) { Directory.Move(chromeDir, backupChrome); oldChromeMoved = true; }
            Directory.Move(stagedChrome, chromeDir); newChromeMoved = true;

            if (File.Exists(userJs)) { File.Move(userJs, backupUserJs); oldUserJsMoved = true; }
            File.Move(stagedUserJs, userJs); newUserJsMoved = true;

            foreach (string staleName in new[] { "compatibility.ini", "pluginreg.dat" })
            {
                string stale = Path.Combine(profileDir, staleName);
                if (File.Exists(stale)) File.Delete(stale);
            }

            TryDeleteDirectory(backupRoot);
        }
        catch (Exception commitError)
        {
            Exception? rollbackError = null;
            try
            {
                if (newUserJsMoved && File.Exists(userJs)) File.Delete(userJs);
                if (oldUserJsMoved && File.Exists(backupUserJs)) File.Move(backupUserJs, userJs);
                if (newChromeMoved && Directory.Exists(chromeDir)) Directory.Delete(chromeDir, recursive: true);
                if (oldChromeMoved && Directory.Exists(backupChrome)) Directory.Move(backupChrome, chromeDir);
                if (newAppMoved && Directory.Exists(appDir)) Directory.Delete(appDir, recursive: true);
                if (oldAppMoved && Directory.Exists(backupApp)) Directory.Move(backupApp, appDir);
            }
            catch (Exception ex) { rollbackError = ex; }

            if (rollbackError is not null)
                throw new IOException($"Обновление не завершилось; резервная копия оставлена в {backupRoot}. Ошибка отката: {rollbackError.Message}", commitError);

            TryDeleteDirectory(backupRoot);
            throw new IOException("Обновление не завершилось. Предыдущая версия восстановлена.", commitError);
        }
    }

    private static string CreateSiblingPath(string targetDir, string purpose)
    {
        string target = Path.GetFullPath(targetDir);
        string parent = Path.GetDirectoryName(target.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar))
            ?? throw new InvalidOperationException("Некорректная папка установки.");
        return Path.Combine(parent, $".{Path.GetFileName(target)}.blade-{purpose}-{Guid.NewGuid():N}");
    }

    private static void PreserveUserWallpapers(string oldImgDir, string newImgDir)
    {
        if (!Directory.Exists(oldImgDir) || !Directory.Exists(newImgDir)) return;
        foreach (string file in Directory.EnumerateFiles(oldImgDir))
        {
            if ((File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0) continue;
            string destination = Path.Combine(newImgDir, Path.GetFileName(file));
            bool explicitlyCustom = IsCustomAssetName(Path.GetFileName(file));
            if (explicitlyCustom || !File.Exists(destination)) File.Copy(file, destination, overwrite: explicitlyCustom);
        }
        foreach (string dir in Directory.EnumerateDirectories(oldImgDir))
        {
            if ((File.GetAttributes(dir) & FileAttributes.ReparsePoint) != 0) continue;
            string name = Path.GetFileName(dir);
            string destination = Path.Combine(newImgDir, name);
            CopyWallpaperDirectory(dir, destination, IsCustomAssetName(name));
        }
    }

    private static bool IsCustomAssetName(string name) =>
        name.StartsWith("custom_", StringComparison.OrdinalIgnoreCase) ||
        name.StartsWith("Без", StringComparison.OrdinalIgnoreCase);

    private static void CopyWallpaperDirectory(string source, string destination, bool overwrite)
    {
        Directory.CreateDirectory(destination);
        foreach (string file in Directory.EnumerateFiles(source))
        {
            if ((File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0) continue;
            string target = Path.Combine(destination, Path.GetFileName(file));
            if (overwrite || !File.Exists(target)) File.Copy(file, target, overwrite);
        }
        foreach (string dir in Directory.EnumerateDirectories(source))
        {
            if ((File.GetAttributes(dir) & FileAttributes.ReparsePoint) != 0) continue;
            CopyWallpaperDirectory(dir, Path.Combine(destination, Path.GetFileName(dir)), overwrite);
        }
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
        }
        catch { /* Keep a failed staging cleanup recoverable instead of masking the install result. */ }
    }

    /// <summary>
    /// Unpacks data.zip to targetDir with real-time byte and entry progress reporting.
    /// Maps App/ -> {target}\FirefoxPortable\App\
    /// Maps profile/ -> {target}\FirefoxPortable\Data\profile\
    /// </summary>
    public static async Task ExtractDataZipAsync(
        string? dataZipPath,
        string targetDir,
        IProgress<InstallProgressReport> progress,
        CancellationToken cancellationToken)
    {
        await Task.Run(() =>
        {
            using Stream payload = OpenPayloadStream(dataZipPath);
            string expectedHash = ReadExpectedPayloadHash(dataZipPath);
            using (var sha256 = SHA256.Create())
            {
                string actualHash = Convert.ToHexString(sha256.ComputeHash(payload));
                if (!actualHash.Equals(expectedHash, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("SHA-256 пакета не совпадает. Установка остановлена, файлы не изменены.");
            }
            if (!payload.CanSeek) throw new InvalidDataException("Пакет установщика нельзя безопасно перемотать для проверки.");
            payload.Position = 0;

            using var archive = new ZipArchive(payload, ZipArchiveMode.Read, leaveOpen: true);
            List<PayloadEntry> entries = BuildPayloadPlan(archive);
            long totalBytes = entries.Sum(e => e.Entry.Length);
            long processedBytes = 0;
            long processedEntries = 0;
            long lastProgressTimestamp = Stopwatch.GetTimestamp();
            double lastReportedPercent = -1;
            string lastReportedStage = string.Empty;
            const int bufferSize = 64 * 1024;
            byte[] buffer = new byte[bufferSize];
            string root = Path.GetFullPath(targetDir);
            Directory.CreateDirectory(root);

            foreach (PayloadEntry planned in entries)
            {
                cancellationToken.ThrowIfCancellationRequested();
                string destPath = GetContainedDestination(root, planned.RelativePath);
                string? dir = Path.GetDirectoryName(destPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

                string stage = planned.ArchivePath.StartsWith("App/", StringComparison.OrdinalIgnoreCase)
                    ? "Распаковка движка Firefox..."
                    : planned.ArchivePath.StartsWith("profile/chrome/", StringComparison.OrdinalIgnoreCase)
                        ? "Установка кастомизации Blade..."
                        : "Настройка профиля...";

                long entryBytes = 0;
                using (Stream entryStream = planned.Entry.Open())
                using (var fileStream = new FileStream(destPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    int bytesRead;
                    while ((bytesRead = entryStream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        entryBytes += bytesRead;
                        if (entryBytes > planned.Entry.Length)
                            throw new InvalidDataException($"Размер файла в архиве некорректен: {planned.ArchivePath}");
                        fileStream.Write(buffer, 0, bytesRead);
                        processedBytes += bytesRead;
                        double percent = totalBytes > 0
                            ? Math.Min(97.5, (double)processedBytes / totalBytes * 97.5)
                            : Math.Min(97.5, (double)processedEntries / Math.Max(1, entries.Count) * 97.5);
                        long now = Stopwatch.GetTimestamp();
                        double elapsedMs = (now - lastProgressTimestamp) * 1000.0 / Stopwatch.Frequency;
                        if (stage != lastReportedStage || percent - lastReportedPercent >= 0.25 || elapsedMs >= 100)
                        {
                            progress.Report(new InstallProgressReport
                            {
                                Percent = percent,
                                Stage = stage,
                                CurrentItem = Path.GetFileName(destPath),
                                ProcessedBytes = processedBytes,
                                TotalBytes = totalBytes
                            });
                            lastProgressTimestamp = now;
                            lastReportedPercent = percent;
                            lastReportedStage = stage;
                        }
                    }
                }
                if (entryBytes != planned.Entry.Length)
                    throw new InvalidDataException($"Файл в архиве неполный: {planned.ArchivePath}");
                processedEntries++;
            }
            progress.Report(new InstallProgressReport
            {
                Percent = 97.5,
                Stage = "Проверка пакета завершена...",
                CurrentItem = "Файлы подготовлены",
                ProcessedBytes = processedBytes,
                TotalBytes = totalBytes
            });
        }, cancellationToken);
    }

    private static List<PayloadEntry> BuildPayloadPlan(ZipArchive archive)
    {
        if (archive.Entries.Count == 0 || archive.Entries.Count > MaxPayloadEntries)
            throw new InvalidDataException("В архиве пустой или чрезмерно большой список файлов.");

        var plan = new List<PayloadEntry>(archive.Entries.Count);
        var destinations = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        long totalBytes = 0;
        bool hasBrowser = false, hasChrome = false, hasBoot = false, hasUserJs = false;

        foreach (ZipArchiveEntry entry in archive.Entries)
        {
            string archivePath = NormalizeArchivePath(entry.FullName);
            bool isDirectory = archivePath.EndsWith("/", StringComparison.Ordinal);
            string trimmed = isDirectory ? archivePath.TrimEnd('/') : archivePath;
            if (trimmed.Length == 0 || trimmed.StartsWith("/", StringComparison.Ordinal) ||
                Path.IsPathRooted(trimmed) || trimmed.Contains(':'))
                throw new InvalidDataException($"Недопустимый путь в архиве: {entry.FullName}");

            string[] segments = trimmed.Split('/');
            foreach (string segment in segments)
            {
                if (segment.Length == 0 || segment is "." or ".." || segment.EndsWith(' ') || segment.EndsWith('.') ||
                    segment.Any(ch => char.IsControl(ch) || Path.GetInvalidFileNameChars().Contains(ch)))
                    throw new InvalidDataException($"Недопустимый путь в архиве: {entry.FullName}");
                string stem = segment.Split('.')[0];
                if (ReservedWindowsNames.Contains(stem, StringComparer.OrdinalIgnoreCase))
                    throw new InvalidDataException($"Имя файла запрещено Windows: {entry.FullName}");
            }

            string relativePath;
            if (segments[0].Equals("App", StringComparison.OrdinalIgnoreCase))
            {
                if (segments.Length < 2) continue;
                string[] mapped = segments.Skip(1).ToArray();
                if (mapped[0].Equals("Firefox64", StringComparison.OrdinalIgnoreCase)) mapped[0] = "Blade";
                relativePath = Path.Combine("App", Path.Combine(mapped));
            }
            else if (segments[0].Equals("profile", StringComparison.OrdinalIgnoreCase))
            {
                if (segments.Length < 2) continue;
                bool chromePath = segments[1].Equals("chrome", StringComparison.OrdinalIgnoreCase);
                bool userJsPath = segments.Length == 2 && segments[1].Equals("user.js", StringComparison.OrdinalIgnoreCase);
                if (!chromePath && !userJsPath)
                    throw new InvalidDataException($"В архиве обнаружен непредусмотренный файл профиля: {entry.FullName}");
                relativePath = Path.Combine("Data", "profile", Path.Combine(segments.Skip(1).ToArray()));
            }
            else
            {
                throw new InvalidDataException($"Неизвестный корневой каталог архива: {entry.FullName}");
            }

            if (isDirectory) continue;
            uint unixMode = unchecked((uint)entry.ExternalAttributes) >> 16;
            if ((unixMode & 0xF000) == 0xA000)
                throw new InvalidDataException($"Символические ссылки в пакете не разрешены: {entry.FullName}");

            string normalizedDestination = relativePath.Replace('\\', '/');
            if (!destinations.Add(normalizedDestination))
                throw new InvalidDataException($"Повторяющийся путь в архиве: {entry.FullName}");
            totalBytes = checked(totalBytes + entry.Length);
            if (entry.Length < 0 || totalBytes > MaxPayloadBytes)
                throw new InvalidDataException("Распакованный пакет превышает безопасный лимит 2 ГБ.");

            if (normalizedDestination.Equals("App/Blade/firefox.exe", StringComparison.OrdinalIgnoreCase)) hasBrowser = true;
            if (normalizedDestination.Equals("Data/profile/chrome/userChrome.css", StringComparison.OrdinalIgnoreCase)) hasChrome = true;
            if (normalizedDestination.Equals("Data/profile/chrome/utils/boot.sys.mjs", StringComparison.OrdinalIgnoreCase)) hasBoot = true;
            if (normalizedDestination.Equals("Data/profile/user.js", StringComparison.OrdinalIgnoreCase)) hasUserJs = true;
            plan.Add(new PayloadEntry(entry, relativePath, archivePath));
        }

        if (!hasBrowser || !hasChrome || !hasBoot || !hasUserJs)
            throw new InvalidDataException("Архив не содержит обязательный Firefox/Blade payload.");
        return plan;
    }

    private static string GetContainedDestination(string rootDir, string relativePath)
    {
        string root = Path.GetFullPath(rootDir).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string destination = Path.GetFullPath(Path.Combine(root, relativePath));
        string rootPrefix = root + Path.DirectorySeparatorChar;
        if (!destination.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException($"Путь архива выходит за границы установки: {relativePath}");
        return destination;
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
    /// Copies the launcher from the hash-verified payload to the installation root.
    /// </summary>
    public static void DeployLauncher(string targetDir)
    {
        string root = Path.GetFullPath(targetDir);
        string source = Path.Combine(root, "Data", "profile", "chrome", "resources", "BladeBrowser.exe");
        string destination = Path.Combine(root, "BladeBrowser.exe");
        if (!File.Exists(source))
            throw new FileNotFoundException("В пакете установки отсутствует launcher Blade.", source);
        if ((File.GetAttributes(source) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("Launcher Blade в пакете не должен быть ссылкой.");
        if ((File.Exists(destination) || Directory.Exists(destination)) &&
            (File.GetAttributes(destination) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("BladeBrowser.exe в папке установки является ссылкой.");

        string temporary = Path.Combine(root, $".BladeBrowser-{Guid.NewGuid():N}.tmp");
        try
        {
            File.Copy(source, temporary, overwrite: false);
            File.Move(temporary, destination, overwrite: true);
        }
        finally
        {
            try { if (File.Exists(temporary)) File.Delete(temporary); } catch { }
        }
    }

    private static bool IsShortcutForInstallation(dynamic shortcut, string targetDir)
    {
        try
        {
            string target = Convert.ToString(shortcut.TargetPath) ?? string.Empty;
            string launcher = Path.GetFullPath(Path.Combine(targetDir, "BladeBrowser.exe"));
            string firefox = Path.GetFullPath(Path.Combine(targetDir, "App", "Blade", "firefox.exe"));
            if (!Path.IsPathRooted(target)) return false;
            string fullTarget = Path.GetFullPath(target);
            if (fullTarget.Equals(launcher, StringComparison.OrdinalIgnoreCase)) return true;
            if (!fullTarget.Equals(firefox, StringComparison.OrdinalIgnoreCase)) return false;

            string profile = Path.GetFullPath(Path.Combine(targetDir, "Data", "profile"));
            string arguments = Convert.ToString(shortcut.Arguments) ?? string.Empty;
            return arguments.IndexOf(profile, StringComparison.OrdinalIgnoreCase) >= 0;
        }
        catch { return false; }
    }

    private static void DeleteOwnedShortcut(dynamic shell, string shortcutPath, string targetDir)
    {
        try
        {
            if (!File.Exists(shortcutPath)) return;
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            if (IsShortcutForInstallation(shortcut, targetDir)) File.Delete(shortcutPath);
        }
        catch { }
    }

    private static void SaveBladeShortcut(dynamic shell, string shortcutPath, string root, string iconPath)
    {
        dynamic shortcut = shell.CreateShortcut(shortcutPath);
        shortcut.TargetPath = Path.Combine(root, "BladeBrowser.exe");
        shortcut.Arguments = string.Empty;
        shortcut.WorkingDirectory = root;
        shortcut.Description = "Blade Browser";
        if (File.Exists(iconPath)) shortcut.IconLocation = $"{iconPath},0";
        shortcut.Save();
    }

    /// <summary>
    /// Creates launcher-backed Start Menu and Desktop shortcuts.
    /// </summary>
    public static void CreateShortcuts(string targetDir, bool createDesktopShortcut)
    {
        string root = Path.GetFullPath(targetDir);
        string launcher = Path.Combine(root, "BladeBrowser.exe");
        string iconPath = Path.Combine(root, "Blade.ico");
        if (!File.Exists(launcher))
            throw new FileNotFoundException("Перед созданием ярлыков не найден launcher Blade.", launcher);

        Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType == null)
            throw new InvalidOperationException("Не удалось создать ярлыки Blade: WScript.Shell недоступен.");
        dynamic shell = Activator.CreateInstance(shellType)!;

        string programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
        string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        string canonicalStartMenu = Path.Combine(programs, "Blade Browser.lnk");
        string legacyStartMenu = Path.Combine(programs, "Blade.lnk");
        string desktopShortcut = Path.Combine(desktop, "Blade.lnk");

        // The registrar creates the same canonical Start Menu entry for default installs.
        DeleteOwnedShortcut(shell, legacyStartMenu, root);
        SaveBladeShortcut(shell, canonicalStartMenu, root, iconPath);
        if (createDesktopShortcut)
            SaveBladeShortcut(shell, desktopShortcut, root, iconPath);
        else
            DeleteOwnedShortcut(shell, desktopShortcut, root);
    }

    /// <summary>Creates a profile-aware uninstaller that only stops/removes this Blade installation.</summary>
    public static void CreateUninstaller(string targetDir)
    {
        string psPath = Path.Combine(targetDir, "Uninstall-Blade.ps1");
        string batPath = Path.Combine(targetDir, "Uninstall-Blade.bat");
        string psContent = """
            $ErrorActionPreference = 'Stop'
            Add-Type -AssemblyName PresentationFramework
            $root = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
            $browser = [IO.Path]::GetFullPath((Join-Path $root 'App\Blade\firefox.exe'))
            $launcher = [IO.Path]::GetFullPath((Join-Path $root 'BladeBrowser.exe'))
            $profile = Join-Path $root 'Data\profile'
            $result = [System.Windows.MessageBox]::Show(
                'Удалить Blade из этой папки? Профиль, закладки и пароли можно сохранить отдельно.',
                'Удаление Blade', [System.Windows.MessageBoxButton]::YesNoCancel,
                [System.Windows.MessageBoxImage]::Question)
            if ($result -ne [System.Windows.MessageBoxResult]::Yes) { exit 0 }

            $running = @(Get-CimInstance Win32_Process -Filter "Name = 'firefox.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath).Equals($browser, [StringComparison]::OrdinalIgnoreCase) })
            if ($running.Count -gt 0) {
                $close = [System.Windows.MessageBox]::Show(
                    'Найдены окна Blade из этой установки. Закрыть только их сейчас?',
                    'Blade запущен', [System.Windows.MessageBoxButton]::YesNoCancel,
                    [System.Windows.MessageBoxImage]::Question)
                if ($close -ne [System.Windows.MessageBoxResult]::Yes) { exit 0 }
                foreach ($item in $running) { Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue }
                Start-Sleep -Milliseconds 700
                $stillRunning = @(Get-CimInstance Win32_Process -Filter "Name = 'firefox.exe'" -ErrorAction SilentlyContinue |
                    Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath).Equals($browser, [StringComparison]::OrdinalIgnoreCase) })
                if ($stillRunning.Count -gt 0) {
                    [System.Windows.MessageBox]::Show('Не удалось закрыть Blade. Закройте его вручную и повторите удаление.', 'Удаление Blade', 'OK', 'Warning') | Out-Null
                    exit 1
                }
            }

            # The icon watcher exits shortly after the last Blade window closes. Wait for it
            # rather than force-killing it or attempting to delete its executable while locked.
            $launcherDeadline = (Get-Date).AddSeconds(12)
            do {
                $launcherRunning = @(Get-CimInstance Win32_Process -Filter "Name = 'BladeBrowser.exe'" -ErrorAction SilentlyContinue |
                    Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath).Equals($launcher, [StringComparison]::OrdinalIgnoreCase) })
                if ($launcherRunning.Count -eq 0) { break }
                Start-Sleep -Milliseconds 300
            } while ((Get-Date) -lt $launcherDeadline)
            if ($launcherRunning.Count -gt 0) {
                [System.Windows.MessageBox]::Show('Значок Blade ещё закрывается. Подождите несколько секунд и повторите удаление.', 'Удаление Blade', 'OK', 'Information') | Out-Null
                exit 1
            }

            $removeProfile = [System.Windows.MessageBox]::Show(
                "Удалить личный профиль: закладки, историю, пароли и cookies?`n`nДа — удалить профиль. Нет — оставить его в Data\profile.",
                'Личные данные', [System.Windows.MessageBoxButton]::YesNoCancel,
                [System.Windows.MessageBoxImage]::Warning)
            if ($removeProfile -eq [System.Windows.MessageBoxResult]::Cancel) { exit 0 }
            $keepProfile = $removeProfile -eq [System.Windows.MessageBoxResult]::No

            $shell = New-Object -ComObject WScript.Shell
            $links = @(
                (Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Blade.lnk'),
                (Join-Path ([Environment]::GetFolderPath('Programs')) 'Blade.lnk'),
                (Join-Path ([Environment]::GetFolderPath('Programs')) 'Blade Browser.lnk'),
                (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Blade.lnk'),
                (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Blade Browser.lnk'))
            foreach ($link in $links) {
                try {
                    if (Test-Path -LiteralPath $link) {
                        $shortcut = $shell.CreateShortcut($link)
                        $target = if ($shortcut.TargetPath) { [IO.Path]::GetFullPath($shortcut.TargetPath) } else { '' }
                        $arguments = [string]$shortcut.Arguments
                        $ownedEngineShortcut = $target.Equals($browser, [StringComparison]::OrdinalIgnoreCase) -and
                            $arguments.IndexOf($profile, [StringComparison]::OrdinalIgnoreCase) -ge 0
                        if ($target.Equals($launcher, [StringComparison]::OrdinalIgnoreCase) -or $ownedEngineShortcut) {
                            Remove-Item -LiteralPath $link -Force
                        }
                    }
                } catch { }
            }

            $uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Blade'
            try {
                $registeredRoot = (Get-ItemProperty -LiteralPath $uninstallKey -Name InstallLocation -ErrorAction Stop).InstallLocation
                if ($registeredRoot -and [IO.Path]::GetFullPath($registeredRoot).TrimEnd('\').Equals($root, [StringComparison]::OrdinalIgnoreCase)) {
                    Remove-Item -LiteralPath $uninstallKey -Recurse -Force
                }
            } catch { }

            $app = Join-Path $root 'App\Blade'
            if (Test-Path -LiteralPath $app) { Remove-Item -LiteralPath $app -Recurse -Force }
            $appParent = Join-Path $root 'App'
            if ((Test-Path -LiteralPath $appParent) -and -not (Get-ChildItem -LiteralPath $appParent -Force | Select-Object -First 1)) {
                Remove-Item -LiteralPath $appParent -Force
            }
            if (-not $keepProfile -and (Test-Path -LiteralPath $profile)) { Remove-Item -LiteralPath $profile -Recurse -Force }
            $data = Join-Path $root 'Data'
            if ((Test-Path -LiteralPath $data) -and -not (Get-ChildItem -LiteralPath $data -Force | Select-Object -First 1)) {
                Remove-Item -LiteralPath $data -Force
            }
            $icon = Join-Path $root 'Blade.ico'
            if (Test-Path -LiteralPath $icon) { Remove-Item -LiteralPath $icon -Force }
            if (Test-Path -LiteralPath $launcher) { Remove-Item -LiteralPath $launcher -Force }

            $remaining = @(Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue)
            if (-not $keepProfile -and @($remaining | Where-Object { $_.Name -notin @('Uninstall-Blade.ps1', 'Uninstall-Blade.bat') }).Count -eq 0) {
                $command = "/d /c timeout /t 3 /nobreak >nul & rmdir /s /q `"$root`""
                Start-Process -FilePath $env:ComSpec -ArgumentList $command -WorkingDirectory $env:TEMP -WindowStyle Hidden
            } else {
                $message = if ($keepProfile) { "Blade удалён. Профиль сохранён: $profile" } else { 'Blade удалён. В папке остались пользовательские файлы, они не затронуты.' }
                [System.Windows.MessageBox]::Show($message, 'Готово', 'OK', 'Information') | Out-Null
            }
            """;
        string batContent = "@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0Uninstall-Blade.ps1\"\r\n";

        try
        {
            File.WriteAllText(psPath, psContent, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
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
                key.SetValue("UninstallString", $"powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{psPath}\"");
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
        }
        catch { }
    }

    /// <summary>
    /// Repairs installed-browser registration without changing the user's defaults.
    /// Returns a warning on failure; custom/portable targets are skipped.
    /// </summary>
    public static async Task<string?> RegisterInstalledBrowserAsync(
        string targetDir, CancellationToken cancellationToken)
    {
        using var process = new Process();
        try
        {
            string root = Path.GetFullPath(targetDir).TrimEnd('\\', '/');
            string installedRoot = Path.GetFullPath(DefaultInstallPath).TrimEnd('\\', '/');
            if (!root.Equals(installedRoot, StringComparison.OrdinalIgnoreCase)) return null;

            string engineDir = Path.Combine(root, "App", "Blade");
            string profileDir = Path.Combine(root, "Data", "profile");
            string registrar = Path.Combine(profileDir, "chrome", "resources", "set-blade-default.ps1");
            if (!File.Exists(Path.Combine(engineDir, "firefox.exe")) ||
                !Directory.Exists(profileDir) || !File.Exists(registrar))
                return "Регистрация Blade пропущена: движок, профиль или общий registrar отсутствует.";

            process.StartInfo = new ProcessStartInfo
            {
                FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),
                    "WindowsPowerShell", "v1.0", "powershell.exe"),
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            foreach (string arg in new[] { "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
                registrar, "-EnginePath", engineDir, "-RegisterOnly" })
                process.StartInfo.ArgumentList.Add(arg);

            cancellationToken.ThrowIfCancellationRequested();
            if (!process.Start()) return "Не удалось запустить общий registrar Blade.";

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(30));
            // Drain both pipes concurrently, including scripts with verbose diagnostics.
            Task<string> stdout = process.StandardOutput.ReadToEndAsync(timeout.Token);
            Task<string> stderr = process.StandardError.ReadToEndAsync(timeout.Token);
            await process.WaitForExitAsync(timeout.Token).ConfigureAwait(false);
            await Task.WhenAll(stdout, stderr).ConfigureAwait(false);
            if (process.ExitCode == 0) return null;

            string detail = (string.IsNullOrWhiteSpace(stderr.Result) ? stdout.Result : stderr.Result).Trim();
            if (detail.Length > 400) detail = detail.Substring(0, 400);
            return $"Регистрация Blade не завершена (код {process.ExitCode}). {detail}".TrimEnd();
        }
        catch (OperationCanceledException)
        {
            try { if (!process.HasExited) { process.Kill(entireProcessTree: true); process.WaitForExit(2000); } }
            catch { }
            cancellationToken.ThrowIfCancellationRequested();
            return "Регистрация Blade прервана: общий registrar не завершился за 30 секунд.";
        }
        catch (Exception ex)
        {
            try { if (!process.HasExited) { process.Kill(entireProcessTree: true); process.WaitForExit(2000); } }
            catch { }
            return $"Регистрация Blade не завершена: {ex.Message}";
        }
    }

    /// <summary>
    /// Launches Blade with the portable profile.
    /// </summary>
    public static void LaunchBlade(string targetDir)
    {
        string root = Path.GetFullPath(targetDir);
        string launcher = Path.Combine(root, "BladeBrowser.exe");
        if (!File.Exists(launcher))
            throw new FileNotFoundException("Не найден фирменный запускатель Blade.", launcher);

        var startInfo = new ProcessStartInfo
        {
            FileName = launcher,
            WorkingDirectory = root,
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
