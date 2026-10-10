# Register the installed Blade Browser without writing Windows UserChoice hashes.
# -RegisterOnly is used by setup/startup migration; explicit use opens Settings.
[CmdletBinding()]
param(
    [string]$EnginePath = '',
    [switch]$RegisterOnly,
    [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'

function Resolve-BladeRegistration {
    if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is missing.' }
    $root = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Blade')).TrimEnd('\')
    $engines = @('App\Blade', 'App\Firefox64') | ForEach-Object {
        [IO.Path]::GetFullPath((Join-Path $root $_)).TrimEnd('\')
    }
    if (-not $EnginePath) {
        $script:EnginePath = $engines | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'firefox.exe') -PathType Leaf } | Select-Object -First 1
    }
    if (-not $EnginePath) { throw 'Installed Blade engine is missing.' }
    $engine = [IO.Path]::GetFullPath($EnginePath).TrimEnd('\')
    if ($engine -eq $root) {
        $engine = $engines | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'firefox.exe') -PathType Leaf } | Select-Object -First 1
    }
    if (-not $engine -or $engines -notcontains $engine) {
        throw 'Development/portable builds cannot register as the installed browser.'
    }
    $preferredEngine = $engines | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'firefox.exe') -PathType Leaf } | Select-Object -First 1
    if ($engine -ne $preferredEngine) { throw 'Requested engine differs from the installed launcher engine.' }
    # Validate every ancestor, not only Blade itself: junctions can redirect LOCALAPPDATA.
    $ancestor = $root
    while ($ancestor) {
        if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Registration ancestor is a directory link: $ancestor"
        }
        $parent = [IO.Directory]::GetParent($ancestor)
        $ancestor = if ($null -ne $parent) { $parent.FullName } else { $null }
    }
    $profile = Join-Path $root 'Data\profile'
    $resources = Join-Path $profile 'chrome\resources'
    $expectedScript = Join-Path $resources 'set-blade-default.ps1'
    if ([IO.Path]::GetFullPath($PSCommandPath) -ne [IO.Path]::GetFullPath($expectedScript)) {
        throw 'Registration must run from the installed Blade profile.'
    }
    foreach ($dir in @($root, (Join-Path $root 'App'), (Join-Path $root 'Data'), $engine, $profile, (Join-Path $profile 'chrome'), $resources)) {
        if (-not (Test-Path -LiteralPath $dir -PathType Container)) { throw "Required installed directory is missing: $dir" }
        if ((Get-Item -LiteralPath $dir -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Registration through a directory link is not allowed: $dir"
        }
    }
    $engineExe = Join-Path $engine 'firefox.exe'
    $sourceLauncher = Join-Path $resources 'BladeBrowser.exe'
    foreach ($file in @($engineExe, $sourceLauncher, $expectedScript)) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required installed file is missing: $file" }
        if ((Get-Item -LiteralPath $file -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Registration through a file link is not allowed: $file"
        }
    }
    $launcher = Join-Path $root 'BladeBrowser.exe'
    if (Test-Path -LiteralPath $launcher) {
        if ((Get-Item -LiteralPath $launcher -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw 'Existing launcher is a file link.'
        }
    }
    if (-not $env:APPDATA) { throw 'APPDATA is missing.' }
    $shortcutPath = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Blade Browser.lnk'
    $shortcutParent = [IO.Path]::GetDirectoryName($shortcutPath)
    while ($shortcutParent) {
        if ((Test-Path -LiteralPath $shortcutParent) -and
            ((Get-Item -LiteralPath $shortcutParent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Registration shortcut ancestor is a directory link: $shortcutParent"
        }
        $parent = [IO.Directory]::GetParent($shortcutParent)
        $shortcutParent = if ($null -ne $parent) { $parent.FullName } else { $null }
    }
    if ((Test-Path -LiteralPath $shortcutPath) -and
        ((Get-Item -LiteralPath $shortcutPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Existing browser shortcut is a file link.'
    }
    $backups = Join-Path $root 'Backups'
    if ((Test-Path -LiteralPath $backups) -and
        ((Get-Item -LiteralPath $backups -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Registration backup directory is a link.'
    }
    $iconFile = Join-Path $root 'Blade.ico'
    if (-not (Test-Path -LiteralPath $iconFile -PathType Leaf)) { $iconFile = $launcher }
    return [pscustomobject]@{
        Root = $root; Engine = $engine; Profile = $profile; Launcher = $launcher
        SourceLauncher = $sourceLauncher; Icon = "$iconFile,0"
        LauncherHash = (Get-FileHash -LiteralPath $sourceLauncher -Algorithm SHA256).Hash
    }
}

function Get-RegistryTree([Microsoft.Win32.RegistryKey]$Key) {
    $values = @{}
    foreach ($name in $Key.GetValueNames()) {
        $values[$name] = @{ Kind = $Key.GetValueKind($name).ToString(); Value = $Key.GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) }
    }
    $children = @{}
    foreach ($name in $Key.GetSubKeyNames()) {
        $child = $Key.OpenSubKey($name)
        try { $children[$name] = Get-RegistryTree $child } finally { $child.Dispose() }
    }
    return @{ Values = $values; Children = $children }
}

function Get-LegacyBladeSelections($Registration) {
    $choices = @('Software\Classes\Applications\firefox.exe')
    foreach ($association in @('http','https','.htm','.html','.xhtml','.shtml')) {
        $base = if ($association.StartsWith('.')) {
            "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$association"
        } else { "Software\Microsoft\Windows\Shell\Associations\UrlAssociations\$association" }
        foreach ($suffix in @('UserChoice','UserChoiceLatest\ProgId')) {
            $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("$base\$suffix")
            try {
                if ($null -ne $key) {
                    $id = [string]$key.GetValue('ProgId', '')
                    if ($id -match '^Firefox(HTML|URL)-[A-Fa-f0-9]+$') { $choices += "Software\Classes\$id" }
                }
            } finally { if ($null -ne $key) { $key.Dispose() } }
        }
    }
    $owned = @()
    foreach ($path in ($choices | Select-Object -Unique)) {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("$path\shell\open\command")
        $command = ''
        try { if ($null -ne $key) { $command = [string]$key.GetValue('', '') } }
        finally { if ($null -ne $key) { $key.Dispose() } }
        if ($command -notmatch '^"([^"\r\n]+)"') { continue }
        $exe = $Matches[1]
        $ours = $exe -eq (Join-Path $Registration.Engine 'firefox.exe')
        if (-not $ours -and (Test-Path -LiteralPath $exe -PathType Leaf)) {
            $info = [Diagnostics.FileVersionInfo]::GetVersionInfo($exe)
            $ours = $info.ProductName -eq 'Blade' -or $info.FileDescription -eq 'Blade Browser'
        }
        # Never rewrite a genuine Firefox/Thorium handler based only on its ProgID.
        if ($ours) { $owned += $path }
    }
    return $owned
}
function Save-RegistrationBackup($Registration) {
    $snapshot = @{}
    $paths = @('Software\Clients\StartMenuInternet\Blade', 'Software\Clients\StartMenuInternet\BladeBrowser',
        'Software\Clients\StartMenuInternet\Blade Browser', 'Software\Classes\BladeURL', 'Software\Classes\BladeHTML',
        'Software\Classes\BladeBrowserURL', 'Software\Classes\BladeBrowserHTML', 'Software\Classes\Applications\BladeBrowser.exe',
        'Software\Classes\AppUserModelId\BladeBrowser.Desktop', 'Software\Microsoft\Windows\CurrentVersion\App Paths\BladeBrowser.exe', 'Software\Blade\BrowserRegistration') + $script:legacySelections
    foreach ($path in $paths) {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($path)
        try { $snapshot[$path] = if ($null -ne $key) { Get-RegistryTree $key } else { $null } }
        finally { if ($null -ne $key) { $key.Dispose() } }
    }
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\RegisteredApplications')
    try {
        $snapshot['RegisteredApplications'] = @{}
        foreach ($name in @('Blade', 'Blade Browser', 'BladeBrowser')) {
            $snapshot['RegisteredApplications'][$name] = if ($null -ne $key) { $key.GetValue($name, $null) } else { $null }
        }
    } finally { if ($null -ne $key) { $key.Dispose() } }
    $dir = Join-Path $Registration.Root ('Backups\browser-registration-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    [IO.Directory]::CreateDirectory($dir) | Out-Null
    [IO.File]::WriteAllText((Join-Path $dir 'registry.json'), ($snapshot | ConvertTo-Json -Depth 50), (New-Object Text.UTF8Encoding($false)))
    if (Test-Path -LiteralPath $Registration.Launcher -PathType Leaf) {
        Copy-Item -LiteralPath $Registration.Launcher -Destination (Join-Path $dir 'BladeBrowser.exe')
    }
    $shortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Blade Browser.lnk'
    if (Test-Path -LiteralPath $shortcut -PathType Leaf) {
        Copy-Item -LiteralPath $shortcut -Destination (Join-Path $dir 'Blade Browser.lnk')
    }
    return $dir
}

function Set-RegistrationValue([string]$Path, [string]$Name, $Value, [Microsoft.Win32.RegistryValueKind]$Kind = [Microsoft.Win32.RegistryValueKind]::String) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($Path)
    try {
        if ($key.GetValueNames() -contains $Name) {
            if ($key.GetValueKind($Name) -eq $Kind -and $key.GetValue($Name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -ceq $Value) { return }
        }
        $key.SetValue($Name, $Value, $Kind)
    } finally { $key.Dispose() }
}

function Initialize-RegistrationShell {
    if ('BladeBrowserRegistrationShellV2' -as [type]) { return }
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class BladeBrowserRegistrationShellV2 {
 [StructLayout(LayoutKind.Sequential)] public struct Key { public Guid format; public uint id; public Key(Guid g,uint i){format=g;id=i;} }
 [StructLayout(LayoutKind.Explicit,Size=24)] public struct Value { [FieldOffset(0)] public ushort type; [FieldOffset(8)] public IntPtr text; }
 [ComImport,Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface Store {
  void GetCount(out uint n); void GetAt(uint n,out Key k); void GetValue(ref Key k,out Value v); void SetValue(ref Key k,ref Value v); void Commit();
 }
 [DllImport("shell32.dll",CharSet=CharSet.Unicode)] static extern int SHGetPropertyStoreFromParsingName(string path,IntPtr context,uint flags,ref Guid iid,out Store store);
 [DllImport("ole32.dll")] static extern int PropVariantClear(ref Value value);
 [DllImport("shell32.dll")] public static extern void SHChangeNotify(uint id,uint flags,IntPtr first,IntPtr second);
 public static void SetShortcutIdentity(string path,string identity) {
  var iid=typeof(Store).GUID; Store store; Marshal.ThrowExceptionForHR(SHGetPropertyStoreFromParsingName(path,IntPtr.Zero,2,ref iid,out store));
  try { var key=new Key(new Guid("9f4c2855-9f79-4b39-a8d0-e1d42de1d5f3"),5); var value=new Value{type=31,text=Marshal.StringToCoTaskMemUni(identity)};
   try { store.SetValue(ref key,ref value); store.Commit(); } finally { PropVariantClear(ref value); }
  } finally { Marshal.ReleaseComObject(store); }
 }
}
"@
}

try {
    $registration = Resolve-BladeRegistration
    if ($ValidateOnly) {
        Write-Output ('VALID: ' + $registration.Engine + ' | ' + $registration.Profile)
        exit 0
    }
    $script:legacySelections = @(Get-LegacyBladeSelections $registration)
    # Back up only Blade-owned entries. UserChoice/UserChoiceLatest are never written.
    $marker = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Blade\BrowserRegistration')
    $backupNeeded = $true
    try {
        if ($null -ne $marker) {
            $backupNeeded = $marker.GetValue('SchemaVersion', 0) -ne 2 -or
                $marker.GetValue('EnginePath', '') -ne $registration.Engine -or
                $marker.GetValue('LauncherHash', '') -ne $registration.LauncherHash
        }
    } finally { if ($null -ne $marker) { $marker.Dispose() } }
    foreach ($path in $script:legacySelections) {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("$path\shell\open\command")
        try {
            if ($null -ne $key -and $key.GetValue('', '') -cne ('"{0}" "%1"' -f $registration.Launcher)) {
                $backupNeeded = $true
            }
        } finally { if ($null -ne $key) { $key.Dispose() } }
    }
    if ($backupNeeded) { $null = Save-RegistrationBackup $registration }
    if (-not (Test-Path -LiteralPath $registration.Launcher) -or
        (Get-FileHash -LiteralPath $registration.Launcher -Algorithm SHA256).Hash -ne $registration.LauncherHash) {
        Copy-Item -LiteralPath $registration.SourceLauncher -Destination $registration.Launcher -Force
    }
    $client = 'Software\Clients\StartMenuInternet\BladeBrowser'
    $cap = "$client\Capabilities"
    $command = '"{0}" "%1"' -f $registration.Launcher
    Set-RegistrationValue $client '' 'Blade Browser'
    Set-RegistrationValue "$client\DefaultIcon" '' $registration.Icon
    Set-RegistrationValue "$client\shell\open\command" '' ('"{0}"' -f $registration.Launcher)
    Set-RegistrationValue "$client\InstallInfo" 'IconsVisible' 1 DWord
    Set-RegistrationValue $cap 'ApplicationName' 'Blade Browser'
    Set-RegistrationValue $cap 'ApplicationDescription' 'Blade Browser'
    Set-RegistrationValue $cap 'ApplicationIcon' $registration.Icon
    Set-RegistrationValue $cap 'Hidden' 0 DWord
    Set-RegistrationValue "$cap\StartMenu" 'StartMenuInternet' 'BladeBrowser'
    foreach ($scheme in @('http', 'https')) { Set-RegistrationValue "$cap\URLAssociations" $scheme 'BladeBrowserURL' }
    foreach ($extension in @('.htm', '.html', '.xhtml', '.shtml')) { Set-RegistrationValue "$cap\FileAssociations" $extension 'BladeBrowserHTML' }
    foreach ($progId in @('BladeBrowserURL', 'BladeBrowserHTML', 'BladeURL', 'BladeHTML')) {
        $legacy = $progId -in @('BladeURL', 'BladeHTML')
        $path = "Software\Classes\$progId"
        # Existing selections keep their ProgID; only stale Blade-owned commands are repaired.
        if ($legacy) {
            $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($path)
            if ($null -eq $key) { continue }
            $key.Dispose()
        }
        $title = if ($progId.EndsWith('URL')) { 'Blade Browser URL' } else { 'Blade Browser HTML Document' }
        Set-RegistrationValue $path '' $title
        Set-RegistrationValue $path 'FriendlyTypeName' $title
        Set-RegistrationValue $path 'AppUserModelId' 'BladeBrowser.Desktop'
        Set-RegistrationValue "$path\Application" 'AppUserModelId' 'BladeBrowser.Desktop'
        Set-RegistrationValue "$path\Application" 'ApplicationName' 'Blade Browser'
        Set-RegistrationValue "$path\Application" 'ApplicationDescription' 'Blade Browser'
        Set-RegistrationValue "$path\Application" 'ApplicationCompany' 'Blade-Creations'
        Set-RegistrationValue "$path\Application" 'ApplicationIcon' $registration.Icon
        Set-RegistrationValue "$path\DefaultIcon" '' $registration.Icon
        Set-RegistrationValue "$path\shell" '' 'open'
        Set-RegistrationValue "$path\shell\open\command" '' $command
        if ($progId.EndsWith('URL')) { Set-RegistrationValue $path 'URL Protocol' '' }
    }
    foreach ($path in $script:legacySelections) {
        Set-RegistrationValue "$path\shell\open\command" '' $command
        Set-RegistrationValue "$path\DefaultIcon" '' $registration.Icon
        Set-RegistrationValue "$path\Application" 'ApplicationName' 'Blade Browser'
        Set-RegistrationValue "$path\Application" 'AppUserModelId' 'BladeBrowser.Desktop'
        Set-RegistrationValue "$path\Application" 'ApplicationIcon' $registration.Icon
        if ($path.EndsWith('Applications\firefox.exe')) { Set-RegistrationValue $path 'FriendlyAppName' 'Blade Browser' }
    }
    Set-RegistrationValue 'Software\RegisteredApplications' 'Blade Browser' $cap
    foreach ($alias in @('Blade', 'BladeBrowser')) {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\RegisteredApplications', $true)
        try {
            if ($key.GetValue($alias, '') -in @('Software\Clients\StartMenuInternet\Blade\Capabilities', $cap)) {
                $key.DeleteValue($alias, $false)
            }
        } finally { $key.Dispose() }
    }
    foreach ($oldClient in @('Blade', 'Blade Browser')) {
        $path = "Software\Clients\StartMenuInternet\$oldClient\Capabilities"
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($path)
        if ($null -ne $key) {
            $key.Dispose()
            Set-RegistrationValue $path 'Hidden' 1 DWord
        }
    }
    $application = 'Software\Classes\Applications\BladeBrowser.exe'
    Set-RegistrationValue $application 'FriendlyAppName' 'Blade Browser'
    Set-RegistrationValue "$application\DefaultIcon" '' $registration.Icon
    Set-RegistrationValue "$application\shell\open\command" '' $command
    foreach ($extension in @('.htm', '.html', '.xhtml', '.shtml')) { Set-RegistrationValue "$application\SupportedTypes" $extension '' }
    Set-RegistrationValue 'Software\Classes\AppUserModelId\BladeBrowser.Desktop' 'DisplayName' 'Blade Browser'
    Set-RegistrationValue 'Software\Classes\AppUserModelId\BladeBrowser.Desktop' 'IconUri' ($registration.Icon -replace ',0$', '')
    Set-RegistrationValue 'Software\Microsoft\Windows\CurrentVersion\App Paths\BladeBrowser.exe' '' $registration.Launcher
    Initialize-RegistrationShell
    $programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
    [IO.Directory]::CreateDirectory($programs) | Out-Null
    $shortcutPath = Join-Path $programs 'Blade Browser.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $registration.Launcher
    $shortcut.Arguments = ''
    $shortcut.WorkingDirectory = $registration.Root
    $shortcut.Description = 'Blade Browser'
    $shortcut.IconLocation = $registration.Icon
    $shortcut.Save()
    [BladeBrowserRegistrationShellV2]::SetShortcutIdentity($shortcutPath, 'BladeBrowser.Desktop')
    # Write success marker last: failed/partial attempts must remain retryable.
    Set-RegistrationValue 'Software\Blade\BrowserRegistration' 'EnginePath' $registration.Engine
    Set-RegistrationValue 'Software\Blade\BrowserRegistration' 'ProfilePath' $registration.Profile
    Set-RegistrationValue 'Software\Blade\BrowserRegistration' 'LauncherHash' $registration.LauncherHash
    Set-RegistrationValue 'Software\Blade\BrowserRegistration' 'SchemaVersion' 2 DWord
    [BladeBrowserRegistrationShellV2]::SHChangeNotify(0x08000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero)
    Write-Output 'Registered: Blade Browser. Windows default choices were preserved.'
    if ($RegisterOnly) { exit 0 }
    Start-Process 'ms-settings:defaultapps?registeredAppUser=Blade%20Browser'
    exit 2
} catch {
    Write-Error -Message ('Blade registration failed: ' + $_.Exception.Message) -ErrorAction Continue
    exit 1
}