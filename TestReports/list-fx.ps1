$ErrorActionPreference = 'SilentlyContinue'
Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" | Where-Object { $_.CommandLine -notlike '*-contentproc*' } |
    ForEach-Object { "{0}  start={1}  cmd={2}" -f $_.ProcessId, ([Management.ManagementDateTimeConverter]::ToDateTime($_.CreationDate).ToString('HH:mm:ss')), $_.CommandLine }
