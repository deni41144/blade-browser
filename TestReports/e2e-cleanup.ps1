$ErrorActionPreference = 'Stop'
# 1) kill E2E
$procs = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" |
    Where-Object { $_.CommandLine -like '*blade-e2e*' })
foreach ($p in $procs) { taskkill /PID $p.ProcessId /T /F | Out-Null }
Start-Sleep -Seconds 3
Write-Host ('e2e processes killed: ' + $procs.Count)

# 2) delete test install
Remove-Item (Join-Path $env:TEMP 'blade-e2e') -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'blade-e2e removed'

# 3) strip seeded ini sections pointing to blade-e2e (profiles.ini + installs.ini)
function Clean-Ini([string]$path) {
    $lines = Get-Content $path
    $out = New-Object System.Collections.Generic.List[string]
    $skip = $false
    foreach ($l in $lines) {
        if ($l -match '^\[(.+)\]') { $skip = ($l -like '*blade-e2e*') }
        if ($l -like '*blade-e2e*') { $skip = $true; continue }
        if (-not $skip) { $out.Add($l) }
    }
    # dedupe trailing blanks
    while ($out.Count -gt 0 -and $out[$out.Count - 1] -eq '') { $out.RemoveAt($out.Count - 1) }
    Set-Content -Path $path -Value ($out -join "`r`n") -Encoding ASCII
    Write-Host ($path + ': cleaned')
}
Clean-Ini (Join-Path $env:APPDATA 'Mozilla\Firefox\installs.ini')
Clean-Ini (Join-Path $env:APPDATA 'Mozilla\Firefox\profiles.ini')
Write-Host '=== installs.ini ==='
Get-Content (Join-Path $env:APPDATA 'Mozilla\Firefox\installs.ini')
Write-Host '=== profiles.ini Path lines ==='
Get-Content (Join-Path $env:APPDATA 'Mozilla\Firefox\profiles.ini') | Where-Object { $_ -match '^(Path|Default|\[)' }
