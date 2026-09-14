$ErrorActionPreference = 'Stop'
$root = 'F:\firefox michael edition'
$relDir = (Get-ChildItem (Join-Path $root 'Release') -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'data.zip') } | Select-Object -First 1).FullName
Write-Host ('release dir: ' + $relDir.Name)
# свежие data.zip + exe в релизную папку
Copy-Item (Join-Path $root 'BladeSetup\Output\data.zip') (Join-Path $relDir 'data.zip') -Force
Copy-Item (Join-Path $root 'BladeSetup\Output\Blade-Setup.exe') (Join-Path $relDir 'Blade-Setup.exe') -Force
# суммы по факту пакета
$lines = @()
foreach ($name in @('Blade-Setup.exe', 'data.zip')) {
    $h = (Get-FileHash (Join-Path $relDir $name) -Algorithm SHA256).Hash
    $lines += ($h + '  ' + $name)
}
$utf8bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText((Join-Path $relDir 'SHA256SUMS.txt'), ($lines -join "`r`n") + "`r`n", $utf8bom)
# дистрибутив
$zip = Join-Path $root 'Release\Blade-Setup-2.0.2.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $relDir 'Blade-Setup.exe'),
                  (Join-Path $relDir 'data.zip'),
                  (Join-Path $relDir 'README.txt'),
                  (Join-Path $relDir 'SHA256SUMS.txt') -DestinationPath $zip -CompressionLevel Optimal
# верификация распаковкой
$chk = Join-Path $env:TEMP 'v302-verify'
if (Test-Path $chk) { Remove-Item $chk -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $chk -Force
$allOk = $true
foreach ($line in (Get-Content (Join-Path $chk 'SHA256SUMS.txt'))) {
    $parts = $line -split '  '
    $actual = (Get-FileHash (Join-Path $chk $parts[1]) -Algorithm SHA256).Hash
    if ($actual -eq $parts[0]) { Write-Host ('OK  ' + $parts[1]) } else { $allOk = $false; Write-Host ('FAIL ' + $parts[1]) }
}
Remove-Item $chk -Recurse -Force
if (-not $allOk) { throw 'checksum mismatch' }
Write-Host ('Blade-Setup-2.0.2.zip: ' + [math]::Round((Get-Item $zip).Length/1MB,1) + ' MB — ALL CHECKSUMS OK')
# деплой VERSION/CODENAME в боевую копию владельца (панель апдейтера покажет 2.0.2)
Copy-Item (Join-Path $root 'FirefoxPortable\Data\profile\chrome\VERSION') 'C:\Users\Deni\AppData\Local\Blade\Data\profile\chrome\VERSION' -Force
Copy-Item (Join-Path $root 'FirefoxPortable\Data\profile\chrome\CODENAME') 'C:\Users\Deni\AppData\Local\Blade\Data\profile\chrome\CODENAME' -Force
Write-Host 'VERSION/CODENAME 2.0.2 deployed to installed profile'
