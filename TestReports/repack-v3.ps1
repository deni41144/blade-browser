$ErrorActionPreference = 'Stop'
$root = 'F:\firefox michael edition'
$relDir = Get-ChildItem (Join-Path $root 'Release') -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'data.zip') } | Select-Object -First 1

# sums = только то, что реально в пакете
$lines = @()
foreach ($name in @('Blade-Setup.exe', 'data.zip')) {
    $h = (Get-FileHash (Join-Path $relDir.FullName $name) -Algorithm SHA256).Hash
    $lines += ($h + '  ' + $name)
}
$sums = Join-Path $relDir.FullName 'SHA256SUMS.txt'
$utf8bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($sums, ($lines -join "`r`n") + "`r`n", $utf8bom)

# пересборка v3
$v3 = Join-Path $root 'Release\Blade-Setup-2.0.1-v3.zip'
if (Test-Path $v3) { Remove-Item $v3 -Force }
Compress-Archive -Path (Join-Path $relDir.FullName 'Blade-Setup.exe'),
                  (Join-Path $relDir.FullName 'data.zip'),
                  (Join-Path $relDir.FullName 'README.txt'),
                  (Join-Path $relDir.FullName 'SHA256SUMS.txt') -DestinationPath $v3 -CompressionLevel Optimal
Write-Host ('rebuilt: ' + $v3 + '  ' + [math]::Round((Get-Item $v3).Length/1MB,1) + ' MB')

# верификация: распаковка + сверка всех сумм
$chk = Join-Path $env:TEMP 'v3-verify'
if (Test-Path $chk) { Remove-Item $chk -Recurse -Force }
Expand-Archive -Path $v3 -DestinationPath $chk -Force
$allOk = $true
foreach ($line in (Get-Content (Join-Path $chk 'SHA256SUMS.txt'))) {
    $parts = $line -split '  '
    $actual = (Get-FileHash (Join-Path $chk $parts[1]) -Algorithm SHA256).Hash
    if ($actual -eq $parts[0]) { Write-Host ('OK  ' + $parts[1]) } else { $allOk = $false; Write-Host ('FAIL ' + $parts[1]) }
}
Remove-Item $chk -Recurse -Force
if (-not $allOk) { throw 'hash mismatch!' }
Write-Host 'ALL CHECKSUMS OK'
