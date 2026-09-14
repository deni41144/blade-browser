$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = 'F:\firefox michael edition'
$zipPath = Join-Path $root 'BladeSetup\Output\data.zip'
$target = Join-Path $env:TEMP 'blade-e2e\Blade'

# 0) guard: no firefox running (fresh-profile launch must be our own)
$running = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" -ErrorAction SilentlyContinue)
if ($running.Count -gt 0) { throw 'firefox is running - close it first' }

# 1) clean slate
if (Test-Path (Join-Path $env:TEMP 'blade-e2e')) { Remove-Item (Join-Path $env:TEMP 'blade-e2e') -Recurse -Force }
New-Item -ItemType Directory -Path $target -Force | Out-Null

# 2) extract with the INSTALLER mapping (App\Firefox64 -> App\Blade, profile -> Data\profile)
$z = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
foreach ($e in $z.Entries) {
    if ($e.FullName.EndsWith('/') -or $e.FullName.EndsWith('\')) { continue }
    $norm = $e.FullName.Replace('/', '\').TrimStart('\')
    $dest = if ($norm.StartsWith('App\')) {
        $sub = $norm.Substring(4)
        if ($sub.StartsWith('Firefox64\')) { $sub = 'Blade\' + $sub.Substring(10) }
        Join-Path $target ('App\' + $sub)
    } elseif ($norm.StartsWith('profile\')) {
        Join-Path $target ('Data\profile\' + $norm.Substring(8))
    } else {
        Join-Path $target $norm
    }
    $dir = Split-Path $dest -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)
}
$z.Dispose()
$cnt = (Get-ChildItem $target -Recurse -File).Count
Write-Host ("extracted: $cnt files -> $target")

# 3) launch AS A FRIEND WOULD (bare -profile on its own install)
$fx = Join-Path $target 'App\Blade\firefox.exe'
if (-not (Test-Path $fx)) { throw 'engine not extracted!' }
Start-Process $fx -ArgumentList ('-no-remote -profile "' + (Join-Path $target 'Data\profile') + '"')
Write-Host 'launched, waiting for startup...'
Start-Sleep -Seconds 8

# 4) wait for health mark
$js = Join-Path $target 'Data\profile\chrome\JS'
$deadline = (Get-Date).AddSeconds(35)
while ((Get-Date) -lt $deadline) {
    $h = Get-Item (Join-Path $js 'blade_health.txt') -ErrorAction SilentlyContinue
    if ($h) { break }
    Start-Sleep -Seconds 5
}
Write-Host '=== HEALTH (fresh install from new data.zip) ==='
Get-Content (Join-Path $js 'blade_health.txt') -ErrorAction SilentlyContinue
Write-Host '=== SETTINGS MARK ==='
Get-Content (Join-Path $js 'bobliks_settings_mark.txt') -ErrorAction SilentlyContinue
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*blade-e2e*' -and $_.CommandLine -notlike '*-contentproc*' })
if ($procs.Count -gt 0) { Write-Host ('E2E PID: ' + $procs[0].ProcessId) } else { Write-Host 'E2E: no process!' }
