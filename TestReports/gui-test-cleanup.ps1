$ErrorActionPreference = 'Stop'
# 1) kill the GUI-test browser and installer
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*blade-gui-test*' })
foreach ($p in $procs) { taskkill /PID $p.ProcessId /T /F | Out-Null }
Get-Process 'Blade-Setup' -ErrorAction SilentlyContinue | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 3
Write-Host 'gui-test processes killed'

# 2) delete test install
Remove-Item (Join-Path $env:TEMP 'blade-gui-test') -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'blade-gui-test removed'

# 3) desktop shortcut if created (pointing to test dir)
$desktop = [Environment]::GetFolderPath('Desktop')
Get-ChildItem $desktop -Filter '*.lnk' -ErrorAction SilentlyContinue | Where-Object {
    $sh = New-Object -ComObject WScript.Shell
    $sh.CreateShortcut($_.FullName).TargetPath -like '*blade-gui-test*'
} | ForEach-Object { Remove-Item $_.FullName -Force; Write-Host ('desktop shortcut removed: ' + $_.Name) }

# 4) strip seeded ini sections for blade-gui-test (headers may be hash-named: find by body lines)
function Clean-Ini([string]$path) {
    $lines = Get-Content $path
    $out = New-Object System.Collections.Generic.List[string]
    $skip = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $l = $lines[$i]
        if ($l -match '^\[(.+)\]') {
            # section is dead if any of the next lines (until next section) mention blade-gui-test
            $skip = $false
            for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                if ($lines[$j] -match '^\[') { break }
                if ($lines[$j] -like '*blade-gui-test*') { $skip = $true; break }
            }
            if ($skip) { continue }
        }
        if (-not $skip) { $out.Add($l) }
    }
    while ($out.Count -gt 0 -and $out[$out.Count - 1] -eq '') { $out.RemoveAt($out.Count - 1) }
    Set-Content -Path $path -Value ($out -join "`r`n") -Encoding ASCII
}
Clean-Ini (Join-Path $env:APPDATA 'Mozilla\Firefox\installs.ini')
Clean-Ini (Join-Path $env:APPDATA 'Mozilla\Firefox\profiles.ini')
Write-Host '=== installs.ini ==='
Get-Content (Join-Path $env:APPDATA 'Mozilla\Firefox\installs.ini')
Write-Host '=== profiles.ini sections ==='
Get-Content (Join-Path $env:APPDATA 'Mozilla\Firefox\profiles.ini') | Where-Object { $_ -match '^\[|Path=|Default=' }
