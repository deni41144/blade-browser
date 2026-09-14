$ErrorActionPreference = 'Continue'
$root = 'F:\firefox michael edition'
$testRoot = Join-Path $env:TEMP 'blade-cwd-test\Blade'
$engineDir = Join-Path $testRoot 'App\Blade'
$profileDir = Join-Path $testRoot 'Data\profile'
$fullZip = Join-Path $root 'Patches\Blade-Full-v2.0.2.zip'

function Reset-TestInstall {
    Get-Process firefox -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$testRoot*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    if (Test-Path (Join-Path $env:TEMP 'blade-cwd-test')) { Remove-Item (Join-Path $env:TEMP 'blade-cwd-test') -Recurse -Force }
    New-Item -ItemType Directory -Path $engineDir -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $profileDir 'chrome') -Force | Out-Null
    Copy-Item (Join-Path $root 'Skeleton-Stage\firefox.exe') (Join-Path $engineDir 'firefox.exe') -Force
    Set-Content (Join-Path $profileDir 'chrome\VERSION') '2.0.1'
}

function Wait-Result([int]$seconds) {
    $f = Join-Path $profileDir 'update_result.txt'
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path $f) { Start-Sleep -Seconds 2; return (Get-Content $f -Raw -Encoding UTF8) }
        Start-Sleep -Seconds 2
    }
    return 'TIMEOUT: update_result.txt not written'
}

git -C $root show HEAD:FirefoxPortable/Data/profile/chrome/resources/blade-apply-update.ps1 | Out-File (Join-Path $env:TEMP 'applier-old.ps1') -Encoding UTF8
$applierNew = Join-Path $root 'FirefoxPortable\Data\profile\chrome\resources\blade-apply-update.ps1'

Write-Host '=== ROUND A: OLD applier, CWD = engine dir ==='
Reset-TestInstall
Push-Location $engineDir
Start-Process powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"{0}"' -f (Join-Path $env:TEMP 'applier-old.ps1')),'-ZipPath',('"{0}"' -f $fullZip),'-BladeRoot',('"{0}"' -f $testRoot),'-ProfileDir',('"{0}"' -f $profileDir),'-Auto') -WindowStyle Hidden
Pop-Location
Write-Host ('  A| ' + (Wait-Result 90))

Write-Host '=== ROUND B: NEW applier, CWD = engine dir ==='
Reset-TestInstall
Push-Location $engineDir
Start-Process powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"{0}"' -f $applierNew),'-ZipPath',('"{0}"' -f $fullZip),'-BladeRoot',('"{0}"' -f $testRoot),'-ProfileDir',('"{0}"' -f $profileDir),'-Auto') -WindowStyle Hidden
Pop-Location
Write-Host ('  B| ' + (Wait-Result 90))
Write-Host ('  B| version-after=' + (Get-Content (Join-Path $profileDir 'chrome\VERSION') -First 1) + ' engine=' + (Test-Path (Join-Path $engineDir 'firefox.exe')))

Get-Process firefox -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$testRoot*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Remove-Item (Join-Path $env:TEMP 'blade-cwd-test') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:TEMP 'applier-old.ps1') -Force -ErrorAction SilentlyContinue
Write-Host '=== sandbox cleaned ==='
