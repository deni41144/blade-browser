$ErrorActionPreference = 'Stop'
$src = 'C:\Users\Deni\AppData\Local\Blade\Data\profile\prefs.js'
$lines = Get-Content $src
$n = 0
foreach ($line in $lines) {
    if ($line -notmatch '^user_pref\("browser\.uiCustomization\.state",') { continue }
    $n++
    # вынимаем JSON-значение: между первой и последней кавычкой значения
    $start = $line.IndexOf(', "') + 3
    $json = $line.Substring($start, $line.Length - $start - 2)
    # prefs.js хранит \" — разворачиваем в "
    $json = $json.Replace('\"', '"').Replace('\\\\', '\')
    Write-Host ("=== occurrence $n (line length " + $line.Length + ") ===")
    try {
        $obj = $json | ConvertFrom-Json
        $nav = $obj.placements.'nav-bar'
        Write-Host ("nav-bar count: " + $nav.Count)
        Write-Host ("nav-bar: " + ($nav -join ', '))
        $dupes = $obj.placements.PSObject.Properties | ForEach-Object {
            $area = $_.Name; $items = $_.Value
            $groups = $items | Group-Object | Where-Object { $_.Count -gt 1 }
            foreach ($g in $groups) { "$area : $($g.Name) x$($g.Count)" }
        }
        if ($dupes) { Write-Host ("DUPLICATES: " + ($dupes -join ' | ')) } else { Write-Host 'no duplicates inside areas' }
        $allIds = @()
        foreach ($p in $obj.placements.PSObject.Properties) { $allIds += $p.Value }
        $d2 = $allIds | Group-Object | Where-Object { $_.Count -gt 1 -and $_.Name -ne 'customizableui-special-spring1' -and $_.Name -ne 'customizableui-special-spring2' }
        if ($d2) { Write-Host ("CROSS-AREA duplicates: " + (($d2 | ForEach-Object { "$($_.Name) x$($_.Count)" }) -join ' | ')) } else { Write-Host 'no cross-area duplicates' }
    } catch {
        Write-Host ("JSON PARSE FAIL: " + $_.Exception.Message)
        Write-Host $json.Substring(0, [Math]::Min(300, $json.Length))
    }
}
Write-Host ("total occurrences: $n")
# прочие подозрительные префы
Write-Host '=== suspicious prefs ==='
foreach ($line in $lines) {
    if ($line -match 'uiCustomization|browser\.toolbar|overflow|customiz') { Write-Host $line.Substring(0, [Math]::Min(200, $line.Length)) }
}
