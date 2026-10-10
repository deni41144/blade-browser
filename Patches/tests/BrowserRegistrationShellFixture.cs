using System;
using System.Runtime.InteropServices;
using Microsoft.Win32;
// Suppress global shell broadcasts; exercise real .lnk property store in isolated filesystem.
public static class BladeBrowserRegistrationShellV2 {
    public static string FixtureToken;
    public static int Notifications;
    [StructLayout(LayoutKind.Sequential)] public struct Key { public Guid format; public uint id; public Key(Guid g,uint i){format=g;id=i;} }
    [StructLayout(LayoutKind.Explicit,Size=24)] public struct Value { [FieldOffset(0)] public ushort type; [FieldOffset(8)] public IntPtr text; }
    [ComImport,Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface Store {
        void GetCount(out uint n); void GetAt(uint n,out Key k); void GetValue(ref Key k,out Value v); void SetValue(ref Key k,ref Value v); void Commit();
    }
    [DllImport("shell32.dll",CharSet=CharSet.Unicode)] static extern int SHGetPropertyStoreFromParsingName(string path,IntPtr context,uint flags,ref Guid iid,out Store store);
    [DllImport("ole32.dll")] static extern int PropVariantClear(ref Value value);
    private static void AssertIsolation() {
        if (!FixtureToken.Equals(Registry.CurrentUser.GetValue("BladeFixtureIsolation"))) throw new InvalidOperationException("HKCU isolation lost in shell operation.");
    }
    public static void SHChangeNotify(uint id,uint flags,IntPtr first,IntPtr second) { AssertIsolation(); Notifications++; }
    public static void SetShortcutIdentity(string path,string identity) {
        AssertIsolation();
        var iid=typeof(Store).GUID; Store store; Marshal.ThrowExceptionForHR(SHGetPropertyStoreFromParsingName(path,IntPtr.Zero,2,ref iid,out store));
        try { var key=new Key(new Guid("9f4c2855-9f79-4b39-a8d0-e1d42de1d5f3"),5); var value=new Value{type=31,text=Marshal.StringToCoTaskMemUni(identity)};
            try { store.SetValue(ref key,ref value); store.Commit(); } finally { PropVariantClear(ref value); }
        } finally { Marshal.ReleaseComObject(store); }
        AssertIsolation();
    }
    public static string GetShortcutIdentity(string path) {
        var iid=typeof(Store).GUID; Store store; Marshal.ThrowExceptionForHR(SHGetPropertyStoreFromParsingName(path,IntPtr.Zero,0,ref iid,out store));
        try { var key=new Key(new Guid("9f4c2855-9f79-4b39-a8d0-e1d42de1d5f3"),5); Value value; store.GetValue(ref key,out value);
            try { if(value.type!=31) throw new InvalidOperationException("Shortcut identity is not VT_LPWSTR."); return Marshal.PtrToStringUni(value.text); }
            finally { PropVariantClear(ref value); }
        } finally { Marshal.ReleaseComObject(store); }
    }
}
