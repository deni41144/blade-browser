$ErrorActionPreference = 'Stop'
$src = 'C:\Users\Deni\AppData\Local\Blade\Data\profile'
$dst = Join-Path $env:TEMP 'blade-diag-prof'
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
robocopy $src $dst /E /NFL /NDL /NJH /NJS /XD storage cache2 cache storage-default minidumps crashdeltas datareporting saved-telemetry-pings shader-cache sessionstore-backups thumbnails boringssl-events | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }
Add-Content -Path (Join-Path $dst 'user.js') -Encoding UTF8 -Value @"

// ==== diag clone guard (blade-diag) ====
user_pref("browser.warnOnQuit", false);
user_pref("browser.tabs.warnOnClose", false);
user_pref("browser.tabs.warnOnCloseOtherTabs", false);
user_pref("toolkit.startup.num_recent_crashes", 0);
"@
$mb = [Math]::Round(((Get-ChildItem $dst -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 0)
Write-Host "CLONE OK: $dst ($mb MB)"
