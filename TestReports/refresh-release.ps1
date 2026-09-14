$ErrorActionPreference = 'Stop'
$root = 'F:\firefox michael edition'
$relDir = Get-ChildItem (Join-Path $root 'Release') -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'data.zip') } | Select-Object -First 1
$newData = Join-Path $root 'BladeSetup\Output\data.zip'

# 1) fresh data.zip into release dir
Copy-Item $newData (Join-Path $relDir.FullName 'data.zip') -Force
Write-Host 'data.zip updated in release dir'

# 2) SHA256SUMS.txt: same format (HASH + two spaces + name, UTF-8 BOM)
$lines = @()
foreach ($name in @('Blade-Setup.exe', 'data.zip', 'Blade-Patch-v2.0.1.zip')) {
    $p = Join-Path $relDir.FullName $name
    if (-not (Test-Path $p)) { $p = Join-Path $root ("Patches\" + $name) }
    $h = (Get-FileHash $p -Algorithm SHA256).Hash
    $lines += ($h + '  ' + $name)
}
$sums = Join-Path $relDir.FullName 'SHA256SUMS.txt'
$utf8bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($sums, ($lines -join "`r`n") + "`r`n", $utf8bom)
Write-Host 'SHA256SUMS.txt regenerated:'
Get-Content $sums | ForEach-Object { Write-Host ('  ' + $_) }

# 3) distributive zip v3 (clean set: setup + data + readme + sums)
$v3 = Join-Path $root 'Release\Blade-Setup-2.0.1-v3.zip'
if (Test-Path $v3) { Remove-Item $v3 -Force }
Compress-Archive -Path (Join-Path $relDir.FullName 'Blade-Setup.exe'),
                  (Join-Path $relDir.FullName 'data.zip'),
                  (Join-Path $relDir.FullName 'README.txt'),
                  (Join-Path $relDir.FullName 'SHA256SUMS.txt') -DestinationPath $v3 -CompressionLevel Optimal
$mb = [Math]::Round((Get-Item $v3).Length / 1MB, 1)
Write-Host ("Blade-Setup-2.0.1-v3.zip built: $mb MB")
