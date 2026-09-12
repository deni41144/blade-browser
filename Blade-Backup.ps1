# Blade-Backup: архив всей кастомизации браузера одним запуском
$ErrorActionPreference = 'Stop'
$ro = Split-Path -Parent $MyInvocation.MyCommand.Path

$stamp  = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$bkDir  = Join-Path $ro 'Backups'
$bkFile = Join-Path $bkDir ("Blade-backup-$stamp.zip")

$items = @(
  (Join-Path $ro 'FirefoxPortable\Data\profile\chrome'),
  (Join-Path $ro 'FirefoxPortable\Data\profile\user.js'),
  (Join-Path $ro 'FirefoxPortable\Data\profile\prefs.js'),
  (Join-Path $ro 'Blade.ico')
)

$missing = @($items | Where-Object { -not (Test-Path $_) })
if ($missing.Count -gt 0) {
  Write-Host "ОШИБКА: не найдены пути:" $missing -ForegroundColor Red
  exit 1
}

# policies.json — опциональный: движок живёт в %LOCALAPPDATA% и есть не на каждой машине
$policies = Join-Path $env:LOCALAPPDATA 'Blade\App\Blade\distribution\policies.json'
$hasPolicies = Test-Path $policies
if ($hasPolicies) { $items += $policies }

New-Item -ItemType Directory -Force -Path $bkDir | Out-Null
Compress-Archive -Path $items -DestinationPath $bkFile -Force

$size = [math]::Round((Get-Item $bkFile).Length / 1KB)
Write-Host "Бэкап создан: $bkFile ($size КБ)"
if ($hasPolicies) {
  Write-Host "Внутри: chrome (темы/ридер/скрипты), user.js, prefs.js, policies.json, иконка."
} else {
  Write-Host "Внутри: chrome (темы/ридер/скрипты), user.js, prefs.js, иконка (policies.json не найден — пропущен)."
}
