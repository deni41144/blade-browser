$ErrorActionPreference = 'Continue'
$root = 'F:\firefox michael edition'
$testRoot = Join-Path $env:TEMP 'blade-cwd-test\Blade'
$engineDir = Join-Path $testRoot 'App\Blade'
$profileDir = Join-Path $testRoot 'Data\profile'
$fullZip = Join-Path $root 'Patches\Blade-Full-v2.0.2.zip'

function Reset-TestInstall {
    if (Test-Path (Join-Path $env:TEMP 'blade-cwd-test')) { Remove-Item (Join-Path $env:TEMP 'blade-cwd-test') -Recurse -Force }
    New-Item -ItemType Directory -Path $engineDir -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $profileDir 'chrome') -Force | Out-Null
    Copy-Item (Join-Path $root 'Skeleton-Stage\firefox.exe') (Join-Path $engineDir 'firefox.exe') -Force
    Set-Content (Join-Path $profileDir 'chrome\VERSION') '2.0.1'
}

# old applier from git HEAD
git -C $root show HEAD:FirefoxPortable/Data/profile/chrome/resources/blade-apply-update.ps1 | Out-File (Join-Path $env:TEMP 'applier-old.ps1') -Encoding UTF8
# new applier from working tree
$applierNew = Join-Path $root 'FirefoxPortable\Data\profile\chrome\resources\blade-apply-update.ps1'

Write-Host '=== ROUND A: OLD applier, CWD = engine dir (incident repro) ==='
Reset-TestInstall
Push-Location $engineDir
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $env:TEMP 'applier-old.ps1') -ZipPath $fullZip -BladeRoot $testRoot -ProfileDir $profileDir -Auto 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Host ("  A| " + $_) }
$codeA = $LASTEXITCODE
Pop-Location
Write-Host ("  A| exit=" + $codeA + "  engine-after=" + (Test-Path (Join-Path $engineDir 'firefox.exe')))

Write-Host '=== ROUND B: NEW applier, CWD = engine dir (fix check) ==='
Reset-TestInstall
Push-Location $engineDir
& powershell -NoProfile -ExecutionPolicy Bypass -File $applierNew -ZipPath $fullZip -BladeRoot $testRoot -ProfileDir $profileDir -Auto 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Host ("  B| " + $_) }
$codeB = $LASTEXITCODE
Pop-Location
Write-Host ("  B| exit=" + $codeB + "  engine-new=" + (Test-Path (Join-Path $engineDir 'firefox.exe')) + "  version=" + (Get-Content (Join-Path $profileDir 'chrome\VERSION') -First 1))

Write-Host '=== VERDICT ==='
Write-Host ("A(old) exit=$codeA (1=FAIL expected)   B(new) exit=$codeB (0=OK expected)")
# cleanup
Start-Sleep -Seconds 1
Remove-Item (Join-Path $env:TEMP 'blade-cwd-test') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:TEMP 'applier-old.ps1') -Force -ErrorAction SilentlyContinue
Write-Host 'test sandbox cleaned'
