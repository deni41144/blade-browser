$ErrorActionPreference = 'Stop'
# publish wrapper: reads UTF-8 BOM notes, calls the pipeline (Full mode, no SkipPublish)
$notes = Get-Content 'F:\firefox michael edition\TestReports\notes-202.txt' -Raw -Encoding UTF8
& powershell -NoProfile -ExecutionPolicy Bypass -File 'F:\firefox michael edition\Patches\Publish-Blade-Update.ps1' `
    -Version 2.0.2 -Codename 'Ливень' -Mode Full -Notes $notes
