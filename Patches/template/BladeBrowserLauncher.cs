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
            string exe = Path.Combine(root, "App", "Blade", "firefox.exe");
            if (!File.Exists(exe)) exe = Path.Combine(root, "App", "Firefox64", "firefox.exe");
            if (!File.Exists(exe) || !Directory.Exists(profile))
                throw new FileNotFoundException("Installed Blade Browser or its profile is missing.");
            string arguments = "-profile " + Quote(profile);
            if (input != null) arguments += " -url " + Quote(input);
            var start = new ProcessStartInfo(exe, arguments);
            start.WorkingDirectory = Path.GetDirectoryName(exe);
            start.UseShellExecute = false;
            using (Process process = Process.Start(start)) { }
            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Blade Browser", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}