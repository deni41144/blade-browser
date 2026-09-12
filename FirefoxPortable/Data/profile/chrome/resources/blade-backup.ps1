# Blade-Backup: архив кастомизации профиля (запускается из BobliksSettings
# через runPsEncoded — base64 UTF-16LE, аргументы командной строки не рвутся)
param([Parameter(Mandatory = $true)][string]$ProfileDir)

$ErrorActionPreference = 'Stop'

# Корень Portable-сборки: profile -> Data -> <root>. Нестандартная раскладка
# (нет App) — считаем корнем родителя папки профиля
$root = Split-Path -Parent (Split-Path -Parent $ProfileDir)
if (-not (Test-Path (Join-Path $root 'App'))) {
  $root = Split-Path -Parent $ProfileDir
}

$stamp  = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$bkDir  = Join-Path $root 'Backups'
$bkFile = Join-Path $bkDir ("Blade-backup-$stamp.zip")

$items = @(
  (Join-Path $ProfileDir 'chrome'),
  (Join-Path $ProfileDir 'user.js'),
  (Join-Path $ProfileDir 'prefs.js')
)

$missing = @($items | Where-Object { -not (Test-Path $_) })
if ($missing.Count -gt 0) {
  Write-Host "ОШИБКА: не найдены пути:" $missing -ForegroundColor Red
  exit 1
}

# policies.json движка — опциональный: есть не в каждой раскладке
$policies = Join-Path $root 'App\Blade\distribution\policies.json'
$hasPolicies = Test-Path $policies
if ($hasPolicies) { $items += $policies }

New-Item -ItemType Directory -Force -Path $bkDir | Out-Null
Compress-Archive -Path $items -DestinationPath $bkFile -Force

$size = [math]::Round((Get-Item $bkFile).Length / 1KB)
Write-Host "Бэкап создан: $bkFile ($size КБ)"
if ($hasPolicies) {
  Write-Host "Внутри: chrome (темы/ридер/скрипты), user.js, prefs.js, policies.json."
} else {
  Write-Host "Внутри: chrome (темы/ридер/скрипты), user.js, prefs.js (policies.json не найден — пропущен)."
}
