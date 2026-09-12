# ============================================================================
# set-blade-default.ps1 — регистрация Blade в Windows + браузер по умолчанию.
#
# Проблема: портативная сборка ничего не пишет в реестр — Windows не видит
# Blade в списке браузеров (Settings -> Default apps), выбрать его нельзя.
# Решение (всё в HKCU, права администратора не нужны):
#   1. Гигиена: снос мёртвых Firefox-*-регистраций (команда ведёт в никуда)
#   2. StartMenuInternet-клиент "Blade" + Capabilities + RegisteredApplications
#   3. ProgID BladeHTML (.htm/.html/.xhtml/.shtml) и BladeURL (http/https)
#   4. UserChoice с валидным хешем — без него Windows молча игнорирует запись
#
# Алгоритм хеша UserChoice — адаптация PS-SFTA v1.2.0
# (https://github.com/DanysysTeam/PS-SFTA, MIT, (c) 2022 Danysys;
# credits: bbs.pediy.com/thread-213954.htm, LMongrain).
#
# Запуск: powershell -ExecutionPolicy Bypass -File set-blade-default.ps1
#               [-EnginePath <папка с firefox.exe>]
# Идемпотентен: повторный запуск безопасен.
# ============================================================================
param(
    [string]$EnginePath = ''
)
$ErrorActionPreference = 'Stop'

# --- 0. Поиск движка ---
if (-not $EnginePath) {
    foreach ($c in @((Join-Path $env:LOCALAPPDATA 'Blade\App\Blade'),
                     (Join-Path $env:LOCALAPPDATA 'Blade\App\Firefox64'))) {
        if (Test-Path (Join-Path $c 'firefox.exe')) { $EnginePath = $c; break }
    }
}
# BladeUpdater передаёт -EnginePath КОРНЕМ установки (...\Blade), а не папкой
# движка — принимаем оба варианта
if ($EnginePath -and -not (Test-Path (Join-Path $EnginePath 'firefox.exe'))) {
    foreach ($sub in 'App\Blade', 'App\Firefox64') {
        $cand = Join-Path $EnginePath $sub
        if (Test-Path (Join-Path $cand 'firefox.exe')) { $EnginePath = $cand; break }
    }
}
if (-not $EnginePath -or -not (Test-Path (Join-Path $EnginePath 'firefox.exe'))) {
    throw 'firefox.exe не найден. Укажи: -EnginePath <папка с firefox.exe>'
}
$exe = Join-Path $EnginePath 'firefox.exe'
# Профиль установки: <корень>\Data\profile. БЕЗ -profile в командах реестра
# внешние ссылки (из Discord/Telegram и т.д.) открывались в ДЕФОЛТНОМ профиле —
# «голый Firefox» вместо Blade. -osint с -profile совместим (проверено по
# BrowserContentHandler этой сборки)
$root = Split-Path -Parent (Split-Path -Parent $EnginePath)
$profileDir = Join-Path $root 'Data\profile'
$profArg = ''
if (Test-Path $profileDir) { $profArg = " -profile `"$profileDir`"" }
else { Write-Host "ВНИМАНИЕ: профиль не найден ($profileDir) — регистрирую без -profile" }
Write-Host "Движок: $exe | Профиль: $profileDir"

# --- 1. Гигиена: мёртвые Firefox-регистрации (путь в команде не существует) ---
$smi = 'HKCU:\Software\Clients\StartMenuInternet'
if (Test-Path $smi) {
    foreach ($name in @((Get-ChildItem $smi -ErrorAction SilentlyContinue).PSChildName)) {
        if ($name -notlike 'Firefox-*') { continue }
        $cmd = (Get-ItemProperty (Join-Path $smi "$name\shell\open\command") -ErrorAction SilentlyContinue).'(default)'
        $path = ''
        if ($cmd) { $path = (($cmd -replace '^"', '') -split '"')[0] }
        if ($path -and -not (Test-Path $path)) {
            Remove-Item (Join-Path $smi $name) -Recurse -Force -ErrorAction SilentlyContinue
            Remove-ItemProperty 'HKCU:\Software\RegisteredApplications' -Name $name -ErrorAction SilentlyContinue
            Write-Host "Убрана мёртвая регистрация: $name (вела в $path)"
        }
    }
}

# --- 2. Регистрация Blade как браузера (HKCU) ---
$reg = 'HKEY_CURRENT_USER\Software\Clients\StartMenuInternet\Blade'
[Microsoft.Win32.Registry]::SetValue($reg, '', 'Blade')
[Microsoft.Win32.Registry]::SetValue("$reg\DefaultIcon", '', "$exe,0")
[Microsoft.Win32.Registry]::SetValue("$reg\shell\open\command", '', "`"$exe`"$profArg")
$cap = "$reg\Capabilities"
[Microsoft.Win32.Registry]::SetValue($cap, 'ApplicationName', 'Blade')
[Microsoft.Win32.Registry]::SetValue($cap, 'ApplicationIcon', "$exe,0")
[Microsoft.Win32.Registry]::SetValue($cap, 'ApplicationDescription', 'Blade Browser')
[Microsoft.Win32.Registry]::SetValue("$cap\URLAssociations", 'http', 'BladeURL')
[Microsoft.Win32.Registry]::SetValue("$cap\URLAssociations", 'https', 'BladeURL')
foreach ($e in '.htm', '.html', '.xhtml', '.shtml') {
    [Microsoft.Win32.Registry]::SetValue("$cap\FileAssociations", $e, 'BladeHTML')
}
[Microsoft.Win32.Registry]::SetValue('HKEY_CURRENT_USER\Software\RegisteredApplications', 'Blade',
    'Software\Clients\StartMenuInternet\Blade\Capabilities')
foreach ($p in 'BladeHTML', 'BladeURL') {
    $pk = "HKEY_CURRENT_USER\Software\Classes\$p"
    $title = if ($p -eq 'BladeHTML') { 'Blade HTML Document' } else { 'Blade URL' }
    [Microsoft.Win32.Registry]::SetValue($pk, '', $title)
    [Microsoft.Win32.Registry]::SetValue("$pk\DefaultIcon", '', "$exe,0")
    [Microsoft.Win32.Registry]::SetValue("$pk\shell\open\command", '', "`"$exe`"$profArg -osint -url `"%1`"")
}
Write-Host 'Регистрация: Blade виден в Settings -> Default apps'

# ============================================================================
# --- 3. UserChoice с валидным хешем (адаптация PS-SFTA, MIT) ---
# ============================================================================
function Get-UserExperience {
    [OutputType([string])]
    $hardcodedExperience = 'User Choice set via Windows User Experience {D18B6DD5-6124-4341-9318-804003BAFA0B}'
    $userExperienceSearch = 'User Choice set via Windows User Experience'
    $userExperienceString = ''
    $user32Path = [Environment]::GetFolderPath([Environment+SpecialFolder]::SystemX86) + '\Shell32.dll'
    $fileStream = [System.IO.File]::Open($user32Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $binaryReader = New-Object System.IO.BinaryReader($fileStream)
    [Byte[]] $bytesData = $binaryReader.ReadBytes(5mb)
    $fileStream.Close()
    $dataString = [Text.Encoding]::Unicode.GetString($bytesData)
    $position1 = $dataString.IndexOf($userExperienceSearch)
    $position2 = $dataString.IndexOf('}', $position1)
    try {
        $userExperienceString = $dataString.Substring($position1, $position2 - $position1 + 1)
    }
    catch {
        $userExperienceString = $hardcodedExperience
    }
    Write-Output $userExperienceString
}

function Get-UserSid {
    [OutputType([string])]
    $userSid = ((New-Object System.Security.Principal.NTAccount([Environment]::UserName)).Translate([System.Security.Principal.SecurityIdentifier]).value).ToLower()
    Write-Output $userSid
}

function Get-HexDateTime {
    [OutputType([string])]
    $now = [DateTime]::Now
    $dateTime = [DateTime]::New($now.Year, $now.Month, $now.Day, $now.Hour, $now.Minute, 0)
    $fileTime = $dateTime.ToFileTime()
    $hi = ($fileTime -shr 32)
    $low = ($fileTime -band 0xFFFFFFFFL)
    $dateTimeHex = ($hi.ToString('X8') + $low.ToString('X8')).ToLower()
    Write-Output $dateTimeHex
}

function Get-Hash {
    [CmdletBinding()]
    param (
        [Parameter( Position = 0, Mandatory = $True )]
        [string]
        $BaseInfo
    )

    function local:Get-ShiftRight {
        [CmdletBinding()]
        param (
            [Parameter( Position = 0, Mandatory = $true)]
            [long] $iValue,
            [Parameter( Position = 1, Mandatory = $true)]
            [int] $iCount
        )
        if ($iValue -band 0x80000000) {
            Write-Output (( $iValue -shr $iCount) -bxor 0xFFFF0000)
        }
        else {
            Write-Output  ($iValue -shr $iCount)
        }
    }

    function local:Get-Long {
        [CmdletBinding()]
        param (
            [Parameter( Position = 0, Mandatory = $true)]
            [byte[]] $Bytes,
            [Parameter( Position = 1)]
            [int] $Index = 0
        )
        Write-Output ([BitConverter]::ToInt32($Bytes, $Index))
    }

    function local:Convert-Int32 {
        param (
            [Parameter( Position = 0, Mandatory = $true)]
            [long] $Value
        )
        [byte[]] $bytes = [BitConverter]::GetBytes($Value)
        return [BitConverter]::ToInt32( $bytes, 0)
    }

    [Byte[]] $bytesBaseInfo = [System.Text.Encoding]::Unicode.GetBytes($baseInfo)
    $bytesBaseInfo += 0x00, 0x00

    $MD5 = New-Object -TypeName System.Security.Cryptography.MD5CryptoServiceProvider
    [Byte[]] $bytesMD5 = $MD5.ComputeHash($bytesBaseInfo)

    $lengthBase = ($baseInfo.Length * 2) + 2
    $length = (($lengthBase -band 4) -le 1) + (Get-ShiftRight $lengthBase  2) - 1
    $base64Hash = ""

    if ($length -gt 1) {

        $map = @{PDATA = 0; CACHE = 0; COUNTER = 0 ; INDEX = 0; MD51 = 0; MD52 = 0; OUTHASH1 = 0; OUTHASH2 = 0;
            R0 = 0; R1 = @(0, 0); R2 = @(0, 0); R3 = 0; R4 = @(0, 0); R5 = @(0, 0); R6 = @(0, 0); R7 = @(0, 0)
        }

        $map.CACHE = 0
        $map.OUTHASH1 = 0
        $map.PDATA = 0
        $map.MD51 = (((Get-Long $bytesMD5) -bor 1) + 0x69FB0000L)
        $map.MD52 = ((Get-Long $bytesMD5 4) -bor 1) + 0x13DB0000L
        $map.INDEX = Get-ShiftRight ($length - 2) 1
        $map.COUNTER = $map.INDEX + 1

        while ($map.COUNTER) {
            $map.R0 = Convert-Int32 ((Get-Long $bytesBaseInfo $map.PDATA) + [long]$map.OUTHASH1)
            $map.R1[0] = Convert-Int32 (Get-Long $bytesBaseInfo ($map.PDATA + 4))
            $map.PDATA = $map.PDATA + 8
            $map.R2[0] = Convert-Int32 (($map.R0 * ([long]$map.MD51)) - (0x10FA9605L * ((Get-ShiftRight $map.R0 16))))
            $map.R2[1] = Convert-Int32 ((0x79F8A395L * ([long]$map.R2[0])) + (0x689B6B9FL * (Get-ShiftRight $map.R2[0] 16)))
            $map.R3 = Convert-Int32 ((0xEA970001L * $map.R2[1]) - (0x3C101569L * (Get-ShiftRight $map.R2[1] 16) ))
            $map.R4[0] = Convert-Int32 ($map.R3 + $map.R1[0])
            $map.R5[0] = Convert-Int32 ($map.CACHE + $map.R3)
            $map.R6[0] = Convert-Int32 (($map.R4[0] * [long]$map.MD52) - (0x3CE8EC25L * (Get-ShiftRight $map.R4[0] 16)))
            $map.R6[1] = Convert-Int32 ((0x59C3AF2DL * ([long]$map.R6[0])) - (0x2232E0F1L * ([long](Get-ShiftRight $map.R6[0] 16))))
            $map.OUTHASH1 = Convert-Int32 ((0x1EC90001L * $map.R6[1]) + (0x35BD1EC9L * (Get-ShiftRight $map.R6[1] 16)))
            $map.OUTHASH2 = Convert-Int32 ([long]$map.R5[0] + [long]$map.OUTHASH1)
            $map.CACHE = ([long]$map.OUTHASH2)
            $map.COUNTER = $map.COUNTER - 1
        }

        [Byte[]] $outHash = @(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00)
        [byte[]] $buffer = [BitConverter]::GetBytes($map.OUTHASH1)
        $buffer.CopyTo($outHash, 0)
        $buffer = [BitConverter]::GetBytes($map.OUTHASH2)
        $buffer.CopyTo($outHash, 4)

        $map = @{PDATA = 0; CACHE = 0; COUNTER = 0 ; INDEX = 0; MD51 = 0; MD52 = 0; OUTHASH1 = 0; OUTHASH2 = 0;
            R0 = 0; R1 = @(0, 0); R2 = @(0, 0); R3 = 0; R4 = @(0, 0); R5 = @(0, 0); R6 = @(0, 0); R7 = @(0, 0)
        }

        $map.CACHE = 0
        $map.OUTHASH1 = 0
        $map.PDATA = 0
        $map.MD51 = ((Get-Long $bytesMD5) -bor 1)
        $map.MD52 = ((Get-Long $bytesMD5 4) -bor 1)
        $map.INDEX = Get-ShiftRight ($length - 2) 1
        $map.COUNTER = $map.INDEX + 1

        while ($map.COUNTER) {
            $map.R0 = Convert-Int32 ((Get-Long $bytesBaseInfo $map.PDATA) + ([long]$map.OUTHASH1))
            $map.PDATA = $map.PDATA + 8
            $map.R1[0] = Convert-Int32 ($map.R0 * [long]$map.MD51)
            $map.R1[1] = Convert-Int32 ((0xB1110000L * $map.R1[0]) - (0x30674EEFL * (Get-ShiftRight $map.R1[0] 16)))
            $map.R2[0] = Convert-Int32 ((0x5B9F0000L * $map.R1[1]) - (0x78F7A461L * (Get-ShiftRight $map.R1[1] 16)))
            $map.R2[1] = Convert-Int32 ((0x12CEB96DL * (Get-ShiftRight $map.R2[0] 16)) - (0x46930000L * $map.R2[0]))
            $map.R3 = Convert-Int32 ((0x1D830000L * $map.R2[1]) + (0x257E1D83L * (Get-ShiftRight $map.R2[1] 16)))
            $map.R4[0] = Convert-Int32 ([long]$map.MD52 * ([long]$map.R3 + (Get-Long $bytesBaseInfo ($map.PDATA - 4))))
            $map.R4[1] = Convert-Int32 ((0x16F50000L * $map.R4[0]) - (0x5D8BE90BL * (Get-ShiftRight $map.R4[0] 16)))
            $map.R5[0] = Convert-Int32 ((0x96FF0000L * $map.R4[1]) - (0x2C7C6901L * (Get-ShiftRight $map.R4[1] 16)))
            $map.R5[1] = Convert-Int32 ((0x2B890000L * $map.R5[0]) + (0x7C932B89L * (Get-ShiftRight $map.R5[0] 16)))
            $map.OUTHASH1 = Convert-Int32 ((0x9F690000L * $map.R5[1]) - (0x405B6097L * (Get-ShiftRight ($map.R5[1]) 16)))
            $map.OUTHASH2 = Convert-Int32 ([long]$map.OUTHASH1 + $map.CACHE + $map.R3)
            $map.CACHE = ([long]$map.OUTHASH2)
            $map.COUNTER = $map.COUNTER - 1
        }

        $buffer = [BitConverter]::GetBytes($map.OUTHASH1)
        $buffer.CopyTo($outHash, 8)
        $buffer = [BitConverter]::GetBytes($map.OUTHASH2)
        $buffer.CopyTo($outHash, 12)

        [Byte[]] $outHashBase = @(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00)
        $hashValue1 = ((Get-Long $outHash 8) -bxor (Get-Long $outHash))
        $hashValue2 = ((Get-Long $outHash 12) -bxor (Get-Long $outHash 4))

        $buffer = [BitConverter]::GetBytes($hashValue1)
        $buffer.CopyTo($outHashBase, 0)
        $buffer = [BitConverter]::GetBytes($hashValue2)
        $buffer.CopyTo($outHashBase, 4)
        $base64Hash = [Convert]::ToBase64String($outHashBase)
    }

    Write-Output $base64Hash
}

function Write-RequiredApplicationAssociationToasts {
    param (
        [Parameter( Position = 0, Mandatory = $True )]
        [String]
        $ProgId,
        [Parameter( Position = 1, Mandatory = $True )]
        [String]
        $Extension
    )
    try {
        $keyPath = 'HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\ApplicationAssociationToasts'
        [Microsoft.Win32.Registry]::SetValue($keyPath, $ProgId + '_' + $Extension, 0x0)
    }
    catch {}

    $allApplicationAssociationToasts = Get-ChildItem -Path HKLM:\SOFTWARE\Classes\$Extension\OpenWithList\* -ErrorAction SilentlyContinue |
    ForEach-Object {
        "Applications\$($_.PSChildName)"
    }

    $allApplicationAssociationToasts += @(
        ForEach ($item in (Get-ItemProperty -Path HKLM:\SOFTWARE\Classes\$Extension\OpenWithProgids -ErrorAction SilentlyContinue).PSObject.Properties ) {
            if ([string]::IsNullOrEmpty($item.Value) -and $item -ne '(default)') {
                $item.Name
            }
        })

    $allApplicationAssociationToasts += Get-ChildItem -Path HKLM:SOFTWARE\Clients\StartMenuInternet\* , HKCU:SOFTWARE\Clients\StartMenuInternet\* -ErrorAction SilentlyContinue |
    ForEach-Object {
        (Get-ItemProperty ("$($_.PSPath)\Capabilities\" + (@('URLAssociations', 'FileAssociations') | Select-Object -Index $Extension.Contains('.'))) -ErrorAction SilentlyContinue).$Extension
    }

    $allApplicationAssociationToasts |
    ForEach-Object { if ($_) {
            if (Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\ApplicationAssociationToasts $_"_"$Extension -Value 0 -Type DWord -ErrorAction SilentlyContinue -PassThru) { }
        }
    }
}

function Update-RegistryChanges {
    $code = @'
    [System.Runtime.InteropServices.DllImport("Shell32.dll")]
    private static extern int SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);
    public static void Refresh() {
        SHChangeNotify(0x8000000, 0, IntPtr.Zero, IntPtr.Zero);
    }
'@
    try {
        Add-Type -MemberDefinition $code -Namespace SHChange -Name Notify
    }
    catch {}
    try {
        [SHChange.Notify]::Refresh()
    }
    catch {}
}

function Remove-UserChoiceKey {
    param (
        [Parameter( Position = 0, Mandatory = $True )]
        [String]
        $Key
    )
    $code = @'
    using System;
    using System.Runtime.InteropServices;
    using Microsoft.Win32;

    namespace Registry {
      public class Utils {
        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern int RegOpenKeyEx(UIntPtr hKey, string subKey, int ulOptions, int samDesired, out UIntPtr hkResult);

        [DllImport("advapi32.dll", SetLastError=true, CharSet = CharSet.Unicode)]
        private static extern uint RegDeleteKey(UIntPtr hKey, string subKey);

        public static void DeleteKey(string key) {
          UIntPtr hKey = UIntPtr.Zero;
          RegOpenKeyEx((UIntPtr)0x80000001u, key, 0, 0x20019, out hKey);
          RegDeleteKey((UIntPtr)0x80000001u, key);
        }
      }
    }
'@
    try {
        Add-Type -TypeDefinition $code
    }
    catch {}
    try {
        [Registry.Utils]::DeleteKey($Key)
    }
    catch {}
}

function Set-Association {
    param (
        [Parameter( Position = 0, Mandatory = $True )]
        [String]
        $ProgId,
        [Parameter( Position = 1, Mandatory = $True )]
        [String]
        $ExtOrProtocol
    )
    # Идемпотентность: если ассоциация уже наша — не трогаем (повторное
    # удаление+запись на укреплённых системах может сломать уже рабочее)
    if ($ExtOrProtocol.Contains('.')) {
        $cur = (Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ExtOrProtocol\UserChoice" -ErrorAction SilentlyContinue).ProgId
        $relPath = "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ExtOrProtocol\UserChoice"
        $writePath = "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ExtOrProtocol\UserChoice"
    } else {
        $cur = (Get-ItemProperty "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\$ExtOrProtocol\UserChoice" -ErrorAction SilentlyContinue).ProgId
        $relPath = "Software\Microsoft\Windows\Shell\Associations\UrlAssociations\$ExtOrProtocol\UserChoice"
        $writePath = "HKEY_CURRENT_USER\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\$ExtOrProtocol\UserChoice"
    }
    if ($cur -eq $ProgId) {
        Write-Host ("  {0} -> уже {1} (ок)" -f $ExtOrProtocol, $ProgId)
        return $true
    }

    $userSid = Get-UserSid
    $userExperience = Get-UserExperience
    $userDateTime = Get-HexDateTime
    $baseInfo = "$ExtOrProtocol$userSid$ProgId$userDateTime$userExperience".ToLower()
    $progHash = Get-Hash $baseInfo
    Write-RequiredApplicationAssociationToasts $ProgId $ExtOrProtocol

    # Существующий UserChoice защищён коллбэком (Win11 24H2+/25H2): удаление
    # denied даже для SYSTEM. Пытаемся удалить; если не вышло — не падаем,
    # а просим один клик в Settings (легитимный путь, других физически нет).
    Remove-UserChoiceKey $relPath
    $still = "HKCU:\" + ($relPath -replace '/', '\')
    if (Test-Path $still) {
        Write-Host ("  {0}: UserChoice защищён Windows — нужен один клик в Settings" -f $ExtOrProtocol) -ForegroundColor Yellow
        return $false
    }
    try {
        [Microsoft.Win32.Registry]::SetValue($writePath, 'Hash', $progHash)
        [Microsoft.Win32.Registry]::SetValue($writePath, 'ProgId', $ProgId)
    } catch {
        Write-Host ("  {0}: запись UserChoice отклонена — нужен клик в Settings" -f $ExtOrProtocol) -ForegroundColor Yellow
        return $false
    }
    Write-Host ("  {0} -> {1}" -f $ExtOrProtocol, $ProgId)
    return $true
}

Write-Host 'Ассоциации:'
$needsUI = $false
foreach ($e in '.html', '.htm', '.xhtml', '.shtml') { if (-not (Set-Association 'BladeHTML' $e)) { $needsUI = $true } }
foreach ($p in 'http', 'https') { if (-not (Set-Association 'BladeURL' $p)) { $needsUI = $true } }
Update-RegistryChanges

if ($needsUI) {
    Write-Host ''
    Write-Host 'Остался один шаг, который Windows разрешает только вручную:' -ForegroundColor Yellow
    Write-Host '  Открываю Settings -> Default apps -> выбери Blade -> кнопка "Set default".' -ForegroundColor Yellow
    Start-Process 'ms-settings:defaultapps'
    exit 2
}
Write-Host 'ГОТОВО: Blade — браузер по умолчанию (http/https, .html/.htm/.xhtml/.shtml).'
exit 0
