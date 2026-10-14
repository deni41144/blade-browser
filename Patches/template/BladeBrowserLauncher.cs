using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

[assembly: AssemblyTitle("Blade Browser")]
[assembly: AssemblyDescription("Blade Browser link handler")]
[assembly: AssemblyProduct("Blade Browser")]
[assembly: AssemblyCompany("Blade-Creations")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

internal static class BladeBrowserLauncher
{
    // Windows quoting doubles backslashes before quotes and the closing quote.
    internal static string Quote(string value)
    {
        var result = new StringBuilder("\"");
        int slashes = 0;
        foreach (char ch in value)
        {
            if (ch == '\\') { slashes++; continue; }
            result.Append('\\', ch == '"' ? slashes * 2 + 1 : slashes);
            result.Append(ch);
            slashes = 0;
        }
        result.Append('\\', slashes * 2);
        return result.Append('"').ToString();
    }

    internal static string NormalizeInput(string input)
    {
        if (input == "about:blank") return input;
        if (String.IsNullOrWhiteSpace(input) || input.StartsWith("/", StringComparison.Ordinal) ||
            input.StartsWith("-", StringComparison.Ordinal)) return null;
        Uri uri;
        if (Uri.TryCreate(input, UriKind.Absolute, out uri) &&
            (uri.Scheme == "http" || uri.Scheme == "https" || uri.Scheme == "file"))
            return uri.AbsoluteUri;
        if (Path.IsPathRooted(input)) return new Uri(Path.GetFullPath(input)).AbsoluteUri;
        return null;
    }

    private static string GetFirefoxEnginePath(string root)
    {
        string exe = Path.Combine(root, "App", "Blade", "firefox.exe");
        if (!File.Exists(exe)) exe = Path.Combine(root, "App", "Firefox64", "firefox.exe");
        return File.Exists(exe) ? Path.GetFullPath(exe) : null;
    }

    private static bool IsFirefoxEngineRunning(string engineExe)
    {
        foreach (Process process in Process.GetProcessesByName("firefox"))
        {
            try
            {
                string imagePath = process.MainModule.FileName;
                if (String.Equals(Path.GetFullPath(imagePath), engineExe, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            catch
            {
                // An unreadable Firefox process is treated as possibly ours.
                return true;
            }
            finally
            {
                process.Dispose();
            }
        }
        return false;
    }

    private static bool RepairPendingTilePatch(string root, string profile, string engineExe, out string warning)
    {
        warning = null;
        string resources = Path.Combine(profile, "chrome", "resources");
        string pending = Path.Combine(resources, "TILES-REPAIR-PENDING");
        if (!File.Exists(pending) || IsFirefoxEngineRunning(engineExe)) return true;
        try
        {
            if ((File.GetAttributes(pending) & FileAttributes.ReparsePoint) != 0)
            {
                warning = "Blade не стал запускать восстановление плиток: служебный маркер является ссылкой.";
                return false;
            }
        }
        catch
        {
            warning = "Blade не смог проверить маркер восстановления плиток. Проверь обновление через B → Обновы.";
            return false;
        }

        string patcher = Path.Combine(resources, "Apply-Blade-Tiles.ps1");
        if (!File.Exists(patcher))
        {
            warning = "Blade не нашёл встроенный файл восстановления плиток. Проверь обновление через B → Обновы.";
            return false;
        }

        string powershell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),
            "System32\\WindowsPowerShell\\v1.0\\powershell.exe");
        if (!File.Exists(powershell)) powershell = "powershell.exe";
        var start = new ProcessStartInfo(powershell,
            "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File " + Quote(patcher) +
            " -AppDir " + Quote(Path.GetDirectoryName(engineExe)) +
            " -BackupRoot " + Quote(Path.Combine(root, "Backups", "tiles-engine")) +
            " -SkipSyntaxCheck");
        start.WorkingDirectory = root;
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.WindowStyle = ProcessWindowStyle.Hidden;
        try
        {
            using (Process repair = Process.Start(start))
            {
                if (!repair.WaitForExit(90000))
                {
                    try { repair.Kill(); } catch { }
                    warning = "Blade не завершил восстановление плиток за отведённое время. Повтори проверку обновления через B → Обновы.";
                    return false;
                }
                if (repair.ExitCode != 0)
                {
                    warning = "Blade не смог восстановить плитки автоматически. Повтори проверку обновления через B → Обновы.";
                    return false;
                }
            }

            string startupCache = Path.Combine(profile, "startupCache");
            if (Directory.Exists(startupCache))
            {
                var cache = new DirectoryInfo(startupCache);
                if ((cache.Attributes & FileAttributes.ReparsePoint) != 0)
                {
                    warning = "Патч плиток применён, но кэш запуска является ссылкой и не был очищен. Перезапусти Blade.";
                    return false;
                }
                cache.Delete(true);
            }

            FileAttributes pendingAttributes = File.GetAttributes(pending);
            if ((pendingAttributes & FileAttributes.ReparsePoint) == 0) File.Delete(pending);
            return true;
        }
        catch
        {
            warning = "Blade не смог завершить восстановление плиток. Повтори проверку обновления через B → Обновы.";
            return false;
        }
    }

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length > 1) return 2;
            string input = args.Length == 1 ? NormalizeInput(args[0]) : null;
            if (args.Length == 1 && input == null) return 2;
            string root = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string profile = Path.Combine(root, "Data", "profile");
            string exe = GetFirefoxEnginePath(root);
            if (!File.Exists(exe) || !Directory.Exists(profile))
                throw new FileNotFoundException("Installed Blade Browser or its profile is missing.");
            string tileRepairWarning;
            RepairPendingTilePatch(root, profile, exe, out tileRepairWarning);
            string arguments = "-profile " + Quote(profile);
            if (input != null) arguments += " -url " + Quote(input);
            var start = new ProcessStartInfo(exe, arguments);
            start.WorkingDirectory = Path.GetDirectoryName(exe);
            start.UseShellExecute = false;
            using (Process process = Process.Start(start)) { }
            if (!String.IsNullOrEmpty(tileRepairWarning))
                MessageBox.Show(tileRepairWarning, "Blade Browser", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Blade Browser", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
