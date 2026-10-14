using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Blade Browser")]
[assembly: AssemblyDescription("Blade Browser link handler")]
[assembly: AssemblyProduct("Blade Browser")]
[assembly: AssemblyCompany("Blade-Creations")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

internal static class BladeBrowserLauncher
{
    private const uint WM_GETICON = 0x007F;
    private const uint WM_SETICON = 0x0080;
    private const uint IMAGE_ICON = 1;
    private const uint LR_LOADFROMFILE = 0x0010;
    private const uint EVENT_OBJECT_SHOW = 0x8002;
    private const int ICON_SMALL = 0;
    private const int ICON_BIG = 1;
    private const int ICON_SMALL2 = 2;
    private const uint WINEVENT_OUTOFCONTEXT = 0;
    private const string IconWatcherMutexPrefix = "Local\\BladeBrowser.TaskbarIconWatcher.";

    private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
    private delegate void WinEventProc(IntPtr hook, uint eventType, IntPtr hwnd, int idObject,
        int idChild, uint eventThread, uint eventTime);

    private static HashSet<uint> BrowserProcessIds = new HashSet<uint>();
    private static string BrowserEnginePath;
    private static IntPtr BladeIconHandle = IntPtr.Zero;
    private static IntPtr WindowEventHook = IntPtr.Zero;
    private static WinEventProc WindowEventCallback;
    private static ApplicationContext IconWatcherContext;
    private static System.Windows.Forms.Timer IconWatcherTimer;
    private static DateTime FirstWindowDeadline;
    private static DateTime LastBrowserWindowSeen = DateTime.MinValue;
    private static bool SawBrowserWindow;

    [DllImport("user32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    private static extern IntPtr LoadImageW(IntPtr hInst, string name, uint type, int cx, int cy, uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SendMessageTimeoutW(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam,
        uint flags, uint timeout, out IntPtr result);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWinEventHook(uint eventMin, uint eventMax, IntPtr eventHookProcess,
        WinEventProc callback, uint processId, uint threadId, uint flags);

    [DllImport("user32.dll")]
    private static extern bool UnhookWinEvent(IntPtr hook);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hwnd);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

    private static void RefreshBrowserProcessIds()
    {
        HashSet<uint> processIds = new HashSet<uint>();
        foreach (Process process in Process.GetProcessesByName("firefox"))
        {
            try
            {
                string imagePath = process.MainModule.FileName;
                if (String.Equals(Path.GetFullPath(imagePath), BrowserEnginePath, StringComparison.OrdinalIgnoreCase))
                    processIds.Add((uint)process.Id);
            }
            catch
            {
                // Чужой или недоступный процесс не должен получить значок Blade.
            }
            finally
            {
                process.Dispose();
            }
        }

        BrowserProcessIds = processIds;
    }

    private static bool ApplyBladeIconToWindow(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !IsWindowVisible(hwnd)) return false;
        uint ownerProcessId;
        GetWindowThreadProcessId(hwnd, out ownerProcessId);
        if (!BrowserProcessIds.Contains(ownerProcessId)) return false;

        IntPtr currentIcon = IntPtr.Zero;
        bool gotIcon = SendMessageTimeoutW(hwnd, WM_GETICON, (IntPtr)ICON_BIG, IntPtr.Zero,
            0x0002, 1000, out currentIcon);
        if (!gotIcon || currentIcon != BladeIconHandle)
        {
            SendMessageTimeoutW(hwnd, WM_SETICON, (IntPtr)ICON_BIG, BladeIconHandle, 0x0002, 1000, out currentIcon);
            SendMessageTimeoutW(hwnd, WM_SETICON, (IntPtr)ICON_SMALL, BladeIconHandle, 0x0002, 1000, out currentIcon);
            SendMessageTimeoutW(hwnd, WM_SETICON, (IntPtr)ICON_SMALL2, BladeIconHandle, 0x0002, 1000, out currentIcon);
        }
        return true;
    }

    private static int ApplyToExistingWindows()
    {
        int count = 0;
        EnumWindowsProc callback = delegate(IntPtr hwnd, IntPtr unused)
        {
            if (ApplyBladeIconToWindow(hwnd)) count++;
            return true;
        };
        EnumWindows(callback, IntPtr.Zero);
        return count;
    }

    private static int CountVisibleBrowserWindows()
    {
        int count = 0;
        EnumWindowsProc callback = delegate(IntPtr hwnd, IntPtr unused)
        {
            if (!IsWindowVisible(hwnd)) return true;
            uint ownerProcessId;
            GetWindowThreadProcessId(hwnd, out ownerProcessId);
            if (BrowserProcessIds.Contains(ownerProcessId)) count++;
            return true;
        };
        EnumWindows(callback, IntPtr.Zero);
        return count;
    }

    private static void OnBrowserWindowEvent(IntPtr hook, uint eventType, IntPtr hwnd, int idObject,
        int idChild, uint eventThread, uint eventTime)
    {
        if (eventType != EVENT_OBJECT_SHOW || idObject != 0 || idChild != 0 || hwnd == IntPtr.Zero) return;
        if (BrowserProcessIds.Count == 0) RefreshBrowserProcessIds();
        if (ApplyBladeIconToWindow(hwnd))
        {
            SawBrowserWindow = true;
            LastBrowserWindowSeen = DateTime.UtcNow;
        }
    }

    private static string GetIconWatcherMutexName(string engineExe)
    {
        using (SHA256 sha256 = SHA256.Create())
        {
            byte[] digest = sha256.ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(engineExe).ToUpperInvariant()));
            StringBuilder name = new StringBuilder(IconWatcherMutexPrefix);
            foreach (byte value in digest) name.Append(value.ToString("x2"));
            return name.ToString();
        }
    }

    private static void OnIconWatcherTimerTick(object sender, EventArgs args)
    {
        RefreshBrowserProcessIds();
        int visibleWindows = WindowEventHook == IntPtr.Zero
            ? ApplyToExistingWindows()
            : CountVisibleBrowserWindows();
        if (visibleWindows > 0)
        {
            SawBrowserWindow = true;
            LastBrowserWindowSeen = DateTime.UtcNow;
            return;
        }

        DateTime now = DateTime.UtcNow;
        if (!SawBrowserWindow && now < FirstWindowDeadline) return;
        // Не держим launcher после закрытия окна дольше необходимого: setup и updater
        // должны быстро получить возможность заменить этот исполняемый файл.
        if (SawBrowserWindow && now - LastBrowserWindowSeen < TimeSpan.FromSeconds(5)) return;

        IconWatcherTimer.Stop();
        IconWatcherContext.ExitThread();
    }

    // У Firefox свой значок в firefox.exe. Слушаем появление его окон и задаём
    // HICON Blade на уровне HWND; подписанный Mozilla бинарник не меняется.
    private static bool ApplyBladeWindowIcon(string engineExe, string iconPath)
    {
        if (!File.Exists(iconPath) || !File.Exists(engineExe)) return false;

        bool createdNew;
        using (Mutex watcherMutex = new Mutex(true, GetIconWatcherMutexName(engineExe), out createdNew))
        {
            if (!createdNew) return false;

            BladeIconHandle = LoadImageW(IntPtr.Zero, iconPath, IMAGE_ICON, 0, 0, LR_LOADFROMFILE);
            if (BladeIconHandle == IntPtr.Zero) return false;

            BrowserEnginePath = Path.GetFullPath(engineExe);
            FirstWindowDeadline = DateTime.UtcNow.AddSeconds(15);
            RefreshBrowserProcessIds();
            WindowEventCallback = new WinEventProc(OnBrowserWindowEvent);
            WindowEventHook = SetWinEventHook(EVENT_OBJECT_SHOW, EVENT_OBJECT_SHOW, IntPtr.Zero,
                WindowEventCallback, 0, 0, WINEVENT_OUTOFCONTEXT);
            int existingWindows = ApplyToExistingWindows();
            if (existingWindows > 0)
            {
                SawBrowserWindow = true;
                LastBrowserWindowSeen = DateTime.UtcNow;
            }

            IconWatcherContext = new ApplicationContext();
            IconWatcherTimer = new System.Windows.Forms.Timer();
            IconWatcherTimer.Interval = WindowEventHook == IntPtr.Zero ? 500 : 1000;
            IconWatcherTimer.Tick += OnIconWatcherTimerTick;
            IconWatcherTimer.Start();
            try
            {
                Application.Run(IconWatcherContext);
            }
            catch
            {
                // Значок не должен мешать запуску браузера.
            }
            finally
            {
                if (IconWatcherTimer != null)
                {
                    IconWatcherTimer.Dispose();
                    IconWatcherTimer = null;
                }
                if (WindowEventHook != IntPtr.Zero)
                {
                    UnhookWinEvent(WindowEventHook);
                    WindowEventHook = IntPtr.Zero;
                }
                try { watcherMutex.ReleaseMutex(); } catch { }
            }
        }
        return true;
    }

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
            ApplyBladeWindowIcon(exe, Path.Combine(root, "Blade.ico"));
            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Blade Browser", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
