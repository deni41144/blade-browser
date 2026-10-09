param(
    [Parameter(Mandatory=$true)][string]$ChromePath,
    [Parameter(Mandatory=$true)][string]$ExecutablePath,
    [Parameter(Mandatory=$true)][ValidateSet('1RED','2BLOOD','3PURPLE','4GREEN','5WHITE','6ORANGE','7CHERRY','8BLUE','9YELLOW')][string]$IconName,
    [string]$DesktopPath = [Environment]::GetFolderPath('Desktop'),
    [long]$RequestStamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
)
$ErrorActionPreference = 'Stop'
$sourcePath = Join-Path $ChromePath ('img\ico\' + $IconName + '.png')
$iconDirectory = Join-Path (Split-Path -Parent $ChromePath) 'ThemeIcons'
[void][IO.Directory]::CreateDirectory($iconDirectory)
$mutex = New-Object Threading.Mutex($false, ('Local\BladeDesktopIcon-' + [Environment]::UserName))
$locked = $false
try {
    try { $locked = $mutex.WaitOne(30000) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { throw 'Desktop icon update is busy' }
    # Scope ordering to the shortcut folder; test fixtures never supersede the real desktop.
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $scope = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes([IO.Path]::GetFullPath($DesktopPath).ToLowerInvariant()))).Replace('-','') } finally { $hash.Dispose() }
    $statePath = Join-Path $iconDirectory ("last-request-$scope.txt")
    $lastStamp = 0L
    if (Test-Path -LiteralPath $statePath) { [void][long]::TryParse([IO.File]::ReadAllText($statePath),[ref]$lastStamp) }
    if ($RequestStamp -lt $lastStamp) { Write-Output 'Blade desktop icon: superseded'; return }
$iconPath = Join-Path $iconDirectory ($IconName + '.ico')
if (!(Test-Path -LiteralPath $iconPath) -or (Get-Item -LiteralPath $sourcePath).LastWriteTimeUtc -gt (Get-Item -LiteralPath $iconPath).LastWriteTimeUtc) {
    Add-Type -AssemblyName System.Drawing
    $source = [Drawing.Image]::FromFile($sourcePath)
    $bitmap = New-Object Drawing.Bitmap 256,256
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $stream = New-Object IO.MemoryStream
    try {
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($source,0,0,256,256)
        $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
        $png = $stream.ToArray()
        $output = New-Object IO.MemoryStream
        $writer = New-Object IO.BinaryWriter $output
        try {
            $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
            $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$png.Length); $writer.Write([uint32]22); $writer.Write([byte[]]$png)
            [IO.File]::WriteAllBytes($iconPath,$output.ToArray())
        } finally { $writer.Dispose(); $output.Dispose() }
    } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $source.Dispose() }
}
$shell = New-Object -ComObject WScript.Shell
$installedExe = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Blade\App\Blade\firefox.exe'
$changed = 0
$iconDirs = @($DesktopPath)
$iconDirs += Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'
$iconDirs += Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
foreach ($iconDir in ($iconDirs | Where-Object { Test-Path -LiteralPath $_ })) {
foreach ($file in Get-ChildItem -LiteralPath $iconDir -Filter '*.lnk' -File) {
    $shortcut = $shell.CreateShortcut($file.FullName)
    $sameExecutable = [string]::Equals($shortcut.TargetPath,$ExecutablePath,[StringComparison]::OrdinalIgnoreCase)
    $installedBlade = $false
    if (!($sameExecutable -or $installedBlade)) { continue }
    if ($shortcut.IconLocation -ne "$iconPath,0") {
        $shortcut.IconLocation = "$iconPath,0"
        $shortcut.Save()
        $changed++
    }
}
}
if ($changed) {
    Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices; public static class BladeIconNotify { [DllImport("shell32.dll")] public static extern void SHChangeNotify(uint e,uint f,IntPtr a,IntPtr b); }'
    [BladeIconNotify]::SHChangeNotify(0x08000000,0,[IntPtr]::Zero,[IntPtr]::Zero)
}
Write-Output "Blade desktop icon: $IconName, updated=$changed"
[IO.File]::WriteAllText($statePath,[string]$RequestStamp)
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
