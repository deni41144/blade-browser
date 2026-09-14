$ErrorActionPreference = 'Stop'

# 1) ДЕПЛОЙ 1.14.5 в боевую копию владельца (конвенция 9: копирование chrome-файла)
Copy-Item 'F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\JS\BobliksSettings.uc.js' `
          'C:\Users\Deni\AppData\Local\Blade\Data\profile\chrome\JS\BobliksSettings.uc.js' -Force
Write-Host 'DEPLOY: BobliksSettings 1.14.5 -> installed profile'

# 2) installs.ini: снос мёртвой записи [6FD3671E1FA30125] -> Profiles/nirdliiq.default-release (профиль удалён чисткой 14:46)
$ini = 'C:\Users\Deni\AppData\Roaming\Mozilla\Firefox\installs.ini'
Copy-Item $ini "$ini.blade-bak-deadentry" -Force
$lines = Get-Content $ini
$out = New-Object System.Collections.Generic.List[string]
$skip = $false
foreach ($l in $lines) {
    if ($l -match '^\[(.+)\]') { $skip = ($Matches[1] -eq '6FD3671E1FA30125') }
    if (-not $skip) { $out.Add($l) }
}
Set-Content -Path $ini -Value $out -Encoding ASCII
Write-Host ('installs.ini: dead entry removed, backup at installs.ini.blade-bak-deadentry, lines ' + $lines.Count + ' -> ' + $out.Count)

# 3) убить МОИ тест-инстансы (клон + дев) и стенд
$mine = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*blade-diag-prof*' -or $_.CommandLine -like '*blade-fresh-prof*' -or
                   $_.CommandLine -like '*FirefoxPortable\Data\profile*' -or $_.CommandLine -like '*F:\Data\profile*' })
foreach ($p in $mine) { taskkill /PID $p.ProcessId /T /F | Out-Null }
Write-Host ('test instances killed: ' + $mine.Count)

# 4) стенд: удалить диагностический зонд (мои фиксы 1.14.5 + config.js в стенде ОСТАВЛЯЮ — они чинят тест-копию владельца)
Remove-Item 'F:\Data\profile\chrome\JS\ZZ-BladeDiagButton.uc.js' -Force -ErrorAction SilentlyContinue
Remove-Item 'F:\Data\profile\chrome\JS\zz_diag_button.txt' -Force -ErrorAction SilentlyContinue
Write-Host 'testbed: diag probe removed'

# 5) temp-профили в мусор
Remove-Item "$env:TEMP\blade-diag-prof" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\blade-fresh-prof" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'temp profiles removed'
