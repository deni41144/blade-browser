using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;

// Every override belongs to one child process. Keep real handles only for owned cleanup.
public sealed class BladeRegistryFixture : IDisposable
{
    private const string Prefix = @"Software\BladeRegistrationTests\";
    private static readonly IntPtr HKCU = new IntPtr(unchecked((int)0x80000001));
    private static readonly IntPtr HKCR = new IntPtr(unchecked((int)0x80000000));
    private RegistryKey actualUser, owner, userHive, classes;
    private readonly string path, token;
    private bool userOverridden, classesOverridden;

    [DllImport("advapi32.dll")] private static extern int RegOverridePredefKey(IntPtr key, IntPtr replacement);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode)] private static extern int RegQueryValueEx(IntPtr key, string name, IntPtr reserved, out uint type, byte[] data, ref uint size);
    [DllImport("ole32.dll")] private static extern int CoInitializeEx(IntPtr reserved, uint mode);
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] private static extern int SHAssocEnumHandlersForProtocolByApplication(string protocol, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IEnumAssocHandlers handlers);

    [ComImport, Guid("973810ae-9599-4b88-9e4d-6ee98c9552da"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IEnumAssocHandlers
    {
        [PreserveSig] int Next(uint count, [MarshalAs(UnmanagedType.Interface)] out IAssocHandler handler, out uint fetched);
    }
    [ComImport, Guid("f04061ac-1659-4a3f-a954-775aa57fc083"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAssocHandler
    {
        [PreserveSig] int GetName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int GetUIName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    }
    public sealed class Handler
    {
        public string Name;
        public string UIName;
    }

    public BladeRegistryFixture(string id)
    {
        Guid guid;
        if (!Guid.TryParseExact(id, "D", out guid)) throw new ArgumentException("Fixture ID must be exact GUID.");
        path = Prefix + guid.ToString("D");
        token = Guid.NewGuid().ToString("D");
        actualUser = RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, RegistryView.Default);
        using (RegistryKey existing = actualUser.OpenSubKey(path))
            if (existing != null) throw new InvalidOperationException("Fixture key already exists; refusing ownership.");
        try
        {
            owner = actualUser.CreateSubKey(path);
            owner.SetValue("FixtureOwner", token, RegistryValueKind.String);
            userHive = owner.CreateSubKey("HKCU");
            userHive.SetValue("BladeFixtureIsolation", token, RegistryValueKind.String);
            classes = userHive.CreateSubKey(@"Software\Classes");
            classes.SetValue("BladeFixtureIsolation", token, RegistryValueKind.String);
            Check(RegOverridePredefKey(HKCU, userHive.Handle.DangerousGetHandle()));
            userOverridden = true;
            Check(RegOverridePredefKey(HKCR, classes.Handle.DangerousGetHandle()));
            classesOverridden = true;
            using (RegistryKey user = RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, RegistryView.Default))
            using (RegistryKey merged = RegistryKey.OpenBaseKey(RegistryHive.ClassesRoot, RegistryView.Default))
            {
                if (!token.Equals(user.GetValue("BladeFixtureIsolation")) || !token.Equals(merged.GetValue("BladeFixtureIsolation")))
                    throw new InvalidOperationException("Registry isolation failed. Registrar must not run.");
            }
        }
        catch { Dispose(); throw; }
    }
    public string Token { get { return token; } }
    private static void Check(int status) { if (status != 0) throw new Win32Exception(status); }
    public void Dispose()
    {
        // Reset both mappings before touching real HKCU. Never clean an unverified path.
        if (classesOverridden) { Check(RegOverridePredefKey(HKCR, IntPtr.Zero)); classesOverridden = false; }
        if (userOverridden) { Check(RegOverridePredefKey(HKCU, IntPtr.Zero)); userOverridden = false; }
        if (classes != null) { classes.Dispose(); classes = null; }
        if (userHive != null) { userHive.Dispose(); userHive = null; }
        if (owner != null) { owner.Dispose(); owner = null; }
        if (actualUser != null)
        {
            using (RegistryKey candidate = actualUser.OpenSubKey(path))
            {
                if (candidate == null || !token.Equals(candidate.GetValue("FixtureOwner")))
                    throw new InvalidOperationException("Cleanup ownership mismatch; key retained: " + path);
            }
            if (!path.StartsWith(Prefix, StringComparison.Ordinal) || path.Substring(Prefix.Length).Contains("\\"))
                throw new InvalidOperationException("Unsafe registry cleanup path.");
            actualUser.DeleteSubKeyTree(path);
            actualUser.Dispose(); actualUser = null;
        }
    }
    public static string Snapshot(RegistryKey key)
    {
        if (key == null) return "<absent>";
        StringBuilder text = new StringBuilder();
        SnapshotInto(key, "", text);
        return text.ToString();
    }
    private static void SnapshotInto(RegistryKey key, string path, StringBuilder text)
    {
        text.Append("K:").Append(Convert.ToBase64String(Encoding.Unicode.GetBytes(path))).Append('\n');
        string[] values = key.GetValueNames(); Array.Sort(values, StringComparer.Ordinal);
        foreach (string name in values)
        {
            uint type, size = 0;
            int status = RegQueryValueEx(key.Handle.DangerousGetHandle(), name, IntPtr.Zero, out type, null, ref size); if (status == 2 && key.GetValue(name, null) == null) { text.Append("MISSING:").Append(name).Append('\n'); continue; } if (status != 0) throw new Win32Exception(status, key.Name + " value=[" + name + "]");
            byte[] bytes = new byte[size];
            Check(RegQueryValueEx(key.Handle.DangerousGetHandle(), name, IntPtr.Zero, out type, bytes, ref size));
            text.Append("V:").Append(Convert.ToBase64String(Encoding.Unicode.GetBytes(name))).Append(':')
                .Append(type).Append(':').Append(Convert.ToBase64String(bytes, 0, (int)size)).Append('\n');
        }
        string[] names = key.GetSubKeyNames(); Array.Sort(names, StringComparer.Ordinal);
        foreach (string name in names)
            using (RegistryKey child = key.OpenSubKey(name)) SnapshotInto(child, path + "\\" + name, text);
    }
    public static string SnapshotUser(string path)
    {
        using (RegistryKey user = RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, RegistryView.Default))
        using (RegistryKey key = user.OpenSubKey(path)) return Snapshot(key);
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CommandLineToArgvW(string command, out int count);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
    public static string InvokeLauncherPure(string assemblyPath, string method, string value)
    {
        var assembly = System.Reflection.Assembly.LoadFile(assemblyPath);
        var type = assembly.GetType("BladeBrowserLauncher", true);
        var member = type.GetMethod(method, System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic);
        if (member == null) throw new InvalidOperationException("Launcher method missing: " + method);
        return (string)member.Invoke(null, new object[] { value });
    }
    public static string[] ParseCommandLine(string command)
    {
        int count; IntPtr memory = CommandLineToArgvW(command, out count);
        if (memory == IntPtr.Zero) throw new Win32Exception();
        try { string[] result = new string[count]; for(int i=0;i<count;i++) result[i] = Marshal.PtrToStringUni(Marshal.ReadIntPtr(memory, i * IntPtr.Size)); return result; }
        finally { LocalFree(memory); }
    }
    public static Handler[] EnumerateHandlers(string protocol)
    {
        // PowerShell child runs STA; S_FALSE means COM already initialized.
        int initialized = CoInitializeEx(IntPtr.Zero, 2);
        if (initialized < 0 && initialized != unchecked((int)0x80010106)) Marshal.ThrowExceptionForHR(initialized);
        Guid iid = new Guid("973810ae-9599-4b88-9e4d-6ee98c9552da");
        IEnumAssocHandlers enumerator;
        Marshal.ThrowExceptionForHR(SHAssocEnumHandlersForProtocolByApplication(protocol, ref iid, out enumerator));
        List<Handler> result = new List<Handler>();
        try
        {
            for (int i = 0; i < 4096; i++)
            {
                IAssocHandler handler; uint fetched;
                int hr = enumerator.Next(1, out handler, out fetched);
                if (hr < 0) Marshal.ThrowExceptionForHR(hr);
                if (fetched == 0) return result.ToArray();
                try
                {
                    string name, uiName;
                    Marshal.ThrowExceptionForHR(handler.GetName(out name));
                    Marshal.ThrowExceptionForHR(handler.GetUIName(out uiName));
                    result.Add(new Handler { Name = name, UIName = uiName });
                }
                finally { if (handler != null) Marshal.ReleaseComObject(handler); }
            }
            throw new InvalidOperationException("Shell handler enumeration exceeded safety bound.");
        }
        finally { if (enumerator != null) Marshal.ReleaseComObject(enumerator); }
    }
}
