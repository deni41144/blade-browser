Add-Type -AssemblyName System.IO.Compression.FileSystem
$relDir = Get-ChildItem 'F:\firefox michael edition\Release' -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'data.zip') } | Select-Object -First 1
$zipPath = Join-Path $relDir.FullName 'data.zip'
Write-Host ('zip: ' + $zipPath)
$z = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
function Read-Entry([string]$name) {
    $e = $z.Entries | Where-Object { $_.FullName -eq $name } | Select-Object -First 1
    if (-not $e) { return $null }
    $r = New-Object System.IO.StreamReader($e.Open())
    $t = $r.ReadToEnd(); $r.Close(); return $t
}
$cfg = Read-Entry 'App\Firefox64\config.js'
if ($cfg) {
    Write-Host ('config.js: lines=' + ($cfg -split "`n").Count + ' loader=' + $cfg.Contains('boot.sys.mjs') + ' autoseed=' + $cfg.Contains('bladeAutoSeed'))
} else { Write-Host 'config.js NOT FOUND' }
$bs = Read-Entry 'profile\chrome\JS\BobliksSettings.uc.js'
if ($bs) {
    $v = if ($bs -match 'v1\.\d+\.\d+ ') { $Matches[0] } else { '?' }
    Write-Host ('BobliksSettings: mark-prefix=' + $v + ' dom-mount=' + $bs.Contains('mountMenuButton'))
} else { Write-Host 'BobliksSettings NOT FOUND' }
$guard = Read-Entry 'profile\chrome\JS\BladeProfileGuard.uc.js'
if ($guard) {
    Write-Host ('BladeProfileGuard: skip-foreign=' + $guard.Contains('skip foreign'))
} else { Write-Host 'BladeProfileGuard NOT FOUND' }
$ver = Read-Entry 'profile\chrome\VERSION'
Write-Host ('VERSION: ' + $ver)
# образец личных файлов (guard 2c)
$personal = $z.Entries | Where-Object { $_.FullName -match 'logins|cookies|places|formhistory|key[34]\.db|cert9' } | Select-Object -First 5
Write-Host ('personal files inside: ' + (@($personal).Count))
$z.Dispose()
