# Isolated worker: never invoke this helper directly with a real installed profile.
param(
    [Parameter(Mandatory = $true)][string]$Case,
    [Parameter(Mandatory = $true)][string]$WorkRoot,
    [Parameter(Mandatory = $true)][string]$FixtureId,
    [Parameter(Mandatory = $true)][string]$RegistrarPath,
    [string]$LauncherPath = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
Add-Type -Path (Join-Path $PSScriptRoot 'BrowserRegistrationFixture.cs')

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
function Assert-Equal($Actual, $Expected, [string]$Message) {
    if ($Actual -cne $Expected) { throw "$Message`nExpected length: $(([string]$Expected).Length); actual length: $(([string]$Actual).Length)" }
}
function Set-FixtureValue([string]$Path, [string]$Name, $Value, [Microsoft.Win32.RegistryValueKind]$Kind = 'String') {
    $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($Path)
    try { $key.SetValue($Name, $Value, $Kind) } finally { $key.Dispose() }
}
function Get-FixtureValue([string]$Path, [string]$Name = '') {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($Path)
    if ($null -eq $key) { return $null }
    try { return $key.GetValue($Name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) }
    finally { $key.Dispose() }
}
function Get-TreeSnapshot {
    $rows = @()
    foreach ($item in @(Get-ChildItem -LiteralPath $WorkRoot -Recurse -Force | Sort-Object FullName)) {
        $relative = $item.FullName.Substring($WorkRoot.Length)
        if ($item.PSIsContainer) { $rows += "D:$relative" }
        else { $rows += "F:$relative`:$((Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash)" }
    }
    return ($rows -join "`n")
}
function Get-ProtectedSnapshot {
    $paths = @('Software\Microsoft\Windows\Shell\Associations\UrlAssociations',
        'Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts')
    foreach ($name in 'Firefox-Unrelated', 'Thorium', 'MSEdge') {
        $paths += "Software\Clients\StartMenuInternet\$name"
        $paths += "Software\Classes\$name"
    }
    $rows = foreach ($path in $paths) { "$path`n$([BladeRegistryFixture]::SnapshotUser($path))" }
    $rows += "RegisteredUnrelated:$((Get-FixtureValue 'Software\RegisteredApplications' 'Firefox-Unrelated'))"
    $rows += "RegisteredUnrelated:$((Get-FixtureValue 'Software\RegisteredApplications' 'Thorium'))"
    $rows += "RegisteredUnrelated:$((Get-FixtureValue 'Software\RegisteredApplications' 'MSEdge'))"
    return ($rows -join "`n")
}
function Seed-Registrations {
    foreach ($protocol in 'http', 'https') {
        Set-FixtureValue "Software\Classes\$protocol" '' ("URL:$protocol Protocol")
        Set-FixtureValue "Software\Classes\$protocol" 'URL Protocol' ''
    }
    foreach ($association in 'http', 'https', '.html', '.htm', '.xhtml', '.shtml') {
        if ($association.StartsWith('.')) { $base = "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$association" }
        else { $base = "Software\Microsoft\Windows\Shell\Associations\UrlAssociations\$association" }
        foreach ($choice in 'UserChoice', 'UserChoiceLatest', 'UserChoiceLatest\Nested') {
            $path = "$base\$choice"
            Set-FixtureValue $path 'ProgId' "Unrelated-$association"
            Set-FixtureValue $path 'Hash' 'keep+/hash==/UTF16'
            Set-FixtureValue $path 'HashBytes' ([byte[]](0, 255, 17, 128, 4, 0, 12)) 'Binary'
            Set-FixtureValue $path 'Flags' ([int]17) 'DWord'
            Set-FixtureValue $path 'Counter' ([long]1234567890123) 'QWord'
            Set-FixtureValue $path 'Expandable' '%LOCALAPPDATA%\unchanged' 'ExpandString'
            Set-FixtureValue $path 'Multiple' ([string[]]@('one', 'two', 'three')) 'MultiString'
            Set-FixtureValue $path '' 'default-kept'
        }
    }
    foreach ($name in 'Firefox-Unrelated', 'Thorium', 'MSEdge') {
        $client = "Software\Clients\StartMenuInternet\$name"
        Set-FixtureValue $client '' "$name Browser"
        Set-FixtureValue "$client\shell\open\command" '' ('"F:\Nonexistent unrelated browser\' + $name + '.exe" "%1"')
        Set-FixtureValue "$client\Capabilities" 'ApplicationName' $name
        Set-FixtureValue "$client\Capabilities\URLAssociations" 'http' $name
        Set-FixtureValue "Software\Classes\$name\shell\open\command" '' ('"F:\Unrelated\' + $name + '.exe" "%1"')
        Set-FixtureValue "Software\Classes\$name" 'OpaqueBytes' ([byte[]](7, 0, 252)) 'Binary'
        Set-FixtureValue 'Software\RegisteredApplications' $name "$client\Capabilities"
    }
    $legacy = 'Software\Clients\StartMenuInternet\Blade'
    Set-FixtureValue $legacy '' 'Blade'
    Set-FixtureValue "$legacy\shell\open\command" '' '"F:\firefox michael edition\FirefoxPortable\App\Firefox64\firefox.exe" "%1"'
    Set-FixtureValue "$legacy\Capabilities" 'ApplicationName' 'Blade'
    Set-FixtureValue "$legacy\Capabilities\URLAssociations" 'http' 'BladeURL'
    Set-FixtureValue "$legacy\Capabilities\URLAssociations" 'https' 'BladeURL'
    Set-FixtureValue "$legacy\Capabilities\FileAssociations" '.html' 'BladeHTML'
    Set-FixtureValue 'Software\RegisteredApplications' 'Blade' "$legacy\Capabilities"
    foreach ($prog in 'BladeURL', 'BladeHTML') {
        Set-FixtureValue "Software\Classes\$prog\shell\open\command" '' '"F:\firefox michael edition\FirefoxPortable\App\Firefox64\firefox.exe" -profile "F:\old profile" "%1"'
        Set-FixtureValue "Software\Classes\$prog\Application" 'ApplicationName' 'Blade'
    }
}
function Invoke-Registrar([hashtable]$Arguments, [bool]$ExpectSuccess) {
    $caught = $null
    $global:LASTEXITCODE = 0
    try { & $script:InstalledScript @Arguments 2>&1 | ForEach-Object { $script:InvocationLog += $_.ToString() } }
    catch { $caught = $_.Exception.Message; $script:InvocationLog += $caught }
    $code = $global:LASTEXITCODE
    if ($ExpectSuccess) {
        Assert-True ($null -eq $caught -and ($code -eq 0 -or ($Case -eq 'default-settings' -and $code -eq 2))) "Registrar failed: code=$code error=$caught"
    } else {
        Assert-True ($null -ne $caught -or $code -ne 0) 'Registrar accepted invalid installation.'
    }
}
function Assert-Registration {
    $client = 'Software\Clients\StartMenuInternet\BladeBrowser'
    $capability = "$client\Capabilities"
    Assert-Equal (Get-FixtureValue 'Software\RegisteredApplications' 'Blade Browser') $capability 'RegisteredApplications points to wrong client.'
    Assert-Equal (Get-FixtureValue $capability 'ApplicationName') 'Blade Browser' 'Wrong friendly application name.'
    foreach ($protocol in 'http', 'https') {
        Assert-Equal (Get-FixtureValue "$capability\URLAssociations" $protocol) 'BladeBrowserURL' "Wrong ProgID for $protocol."
    }
    foreach ($extension in '.html', '.htm', '.xhtml', '.shtml') {
        Assert-Equal (Get-FixtureValue "$capability\FileAssociations" $extension) 'BladeBrowserHTML' "Wrong ProgID for $extension."
    }
    $shortcutPath = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Blade Browser.lnk'
    Assert-Equal ([BladeBrowserRegistrationShellV2]::GetShortcutIdentity($shortcutPath)) 'BladeBrowser.Desktop' 'Wrong shortcut AppUserModelId.'
    $launcher = Join-Path $script:BladeRoot 'BladeBrowser.exe'
    Assert-True (Test-Path -LiteralPath $launcher -PathType Leaf) 'Installed launcher missing.'
    Assert-Equal (Get-FileHash -LiteralPath $launcher).Hash (Get-FileHash -LiteralPath $LauncherPath).Hash 'Installed launcher differs from newly compiled production source.'
    foreach ($prog in 'BladeBrowserURL', 'BladeBrowserHTML') {
        $command = Get-FixtureValue "Software\Classes\$prog\shell\open\command"
        Assert-True ($null -ne $command -and $command.Contains('"' + $launcher + '"')) "$prog does not use installed launcher."
        Assert-True ($command.Contains('"%1"')) "$prog loses quoted URL/file argument."
        Assert-Equal $command ('"' + $launcher + '" "%1"') "$prog command does not match canonical launcher invocation."
        Assert-True ($command -notmatch 'F:\\old profile|firefox michael edition\\FirefoxPortable') "$prog retains old development path."
        Assert-Equal (Get-FixtureValue "Software\Classes\$prog\Application" 'AppUserModelID') 'BladeBrowser.Desktop' "$prog has wrong Application AppUserModelID."
    }
    # Legacy names may be repaired in place, or removed/hidden from advertised clients.
    $legacyPublished = Get-FixtureValue 'Software\RegisteredApplications' 'Blade'
    foreach ($prog in 'BladeURL', 'BladeHTML') {
        $command = Get-FixtureValue "Software\Classes\$prog\shell\open\command"
        if ($null -ne $command) {
            Assert-True ($command.Contains($launcher)) "$prog still resolves to development browser."
        }
    }
    if ($null -ne $legacyPublished) {
        $legacyCommand = Get-FixtureValue 'Software\Clients\StartMenuInternet\Blade\shell\open\command'
        Assert-True ($null -ne $legacyCommand -and $legacyCommand.Contains($launcher)) 'Published legacy client keeps development command.'
    }
    foreach ($protocol in 'http', 'https') {
        $handlers = @([BladeRegistryFixture]::EnumerateHandlers($protocol))
        $script:HandlerLog += @($handlers | ForEach-Object { [pscustomobject]@{ Protocol = $protocol; Name = $_.Name; UIName = $_.UIName } })
        $bladeHandlers = @($handlers | Where-Object { $_.Name.Trim('"') -ieq $launcher -and $_.UIName -ceq 'Blade Browser' })
        Assert-True ($bladeHandlers.Count -gt 0) "$protocol is absent from SHAssocEnumHandlersForProtocolByApplication with canonical executable and friendly name."
    }
}

function Test-LauncherPure {
    $assembly = [Reflection.Assembly]::LoadFile($LauncherPath)
    $type = $assembly.GetType('BladeBrowserLauncher', $true)
    $flags = [Reflection.BindingFlags]'Static,NonPublic'
    $normalize = $type.GetMethod('NormalizeInput', $flags)
    $quote = $type.GetMethod('Quote', $flags)
    foreach ($input in @('', ' ', '-profile', '/url', 'javascript:alert(1)', 'data:text/html,test', 'relative.html', 'ftp://example.com/test')) {
        Assert-Equal ([BladeRegistryFixture]::InvokeLauncherPure($LauncherPath, 'NormalizeInput', [string]$input)) $null "Unsafe input accepted: $input"
    }
    foreach ($input in @('https://example.com/a?x=1&y=2', 'http://example.com/', 'about:blank', 'file:///C:/folder/test.html')) {
        Assert-Equal ([BladeRegistryFixture]::InvokeLauncherPure($LauncherPath, 'NormalizeInput', [string]$input)) $input "Supported input changed: $input"
    }
    $fileInput = Join-Path $WorkRoot 'local document.html'
    Assert-Equal ([BladeRegistryFixture]::InvokeLauncherPure($LauncherPath, 'NormalizeInput', [string]$fileInput)) ([Uri]$fileInput).AbsoluteUri 'Absolute file path is not converted to file URI.'
    foreach ($input in @('', 'plain', 'space here', 'C:\folder\', 'quote"value', 'C:\slash\"quoted', 'https://example.com/?q="x"&t=1')) {
        $quoted = [BladeRegistryFixture]::InvokeLauncherPure($LauncherPath, 'Quote', [string]$input)
        $decoded = [BladeRegistryFixture]::ParseCommandLine('fixture.exe ' + $quoted)
        Assert-Equal $decoded.Length 2 'Quote introduced another command argument.'
        Assert-Equal $decoded[1] $input 'Windows argument quoting does not round-trip.'
    }
}
function Test-LauncherCapture([string]$EngineName, [switch]$Both) {
    $env:BLADE_TEST_CAPTURE = Join-Path $WorkRoot 'launch.capture'
    $root = Join-Path $WorkRoot 'launcher installed fixture'
    $profile = Join-Path $root 'Data\profile'
    $engine = Join-Path $root ('App\' + $EngineName)
    New-Item -ItemType Directory -Path $profile, $engine -Force | Out-Null
    Copy-Item -LiteralPath $LauncherPath -Destination (Join-Path $root 'BladeBrowser.exe')
    Copy-Item -LiteralPath (Join-Path (Split-Path -Parent $LauncherPath) 'fake-engine.exe') -Destination (Join-Path $engine 'firefox.exe')
    if ($Both) {
        $other = Join-Path $root 'App\Firefox64'
        New-Item -ItemType Directory -Path $other -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $engine 'firefox.exe') -Destination (Join-Path $other 'firefox.exe')
    }
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = Join-Path $root 'BladeBrowser.exe'
    $start.Arguments = '"https://example.com/path?x=1&y=2"'
    $start.UseShellExecute = $false; $start.CreateNoWindow = $true
    $process = [Diagnostics.Process]::Start($start)
    try {
        Assert-True ($process.WaitForExit(10000)) 'Launcher did not exit within 10 seconds.'
        Assert-Equal $process.ExitCode 0 'Launcher failed to dispatch fake engine.'
    } finally { if (-not $process.HasExited) { $process.Kill() }; $process.Dispose() }
    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    while (-not (Test-Path -LiteralPath $env:BLADE_TEST_CAPTURE) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 40 }
    Assert-True (Test-Path -LiteralPath $env:BLADE_TEST_CAPTURE) 'Fake engine did not capture actual launcher invocation.'
    # Fake engine closes file after writing. Retry sharing violations, never launch again.
    $lines = $null
    for ($i = 0; $i -lt 30; $i++) {
        try { $lines = @(Get-Content -LiteralPath $env:BLADE_TEST_CAPTURE); if ($lines.Count -eq 5) { break } }
        catch { }
        Start-Sleep -Milliseconds 40
    }
    Assert-Equal $lines.Count 5 'Fake engine captured wrong argument count.'
    Assert-Equal $lines[0] $engine 'Launcher selected wrong engine or working directory.'
    $decoded = @($lines | Select-Object -Skip 1 | ForEach-Object { [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($_)) })
    Assert-Equal $decoded[0] '-profile' 'Launcher lacks explicit profile switch.'
    Assert-Equal $decoded[1] $profile 'Launcher uses wrong installed profile.'
    Assert-Equal $decoded[2] '-url' 'Launcher lacks URL switch.'
    Assert-Equal $decoded[3] 'https://example.com/path?x=1&y=2' 'Launcher changes URL or splits arguments.'
}
$fixture = $null
$exitCode = 1
$result = [ordered]@{ Case = $Case; Passed = $false; Error = $null; InvocationLog = @(); Handlers = @(); RegistryCleaned = $false }
$script:InvocationLog = @()
$script:HandlerLog = @()
$global:BladeTestLaunchLog = New-Object 'System.Collections.Generic.List[string]'
try {
    $expectedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'artifacts')) + '\'
    $WorkRoot = [IO.Path]::GetFullPath($WorkRoot)
    Assert-True ($WorkRoot.StartsWith($expectedRoot, [StringComparison]::OrdinalIgnoreCase)) 'Filesystem fixture escapes tests/artifacts.'
    Assert-Equal (Get-Content -LiteralPath (Join-Path $WorkRoot '.fixture-owner') -Raw).Trim() $FixtureId 'Filesystem fixture owner mismatch.'
    $fixture = New-Object BladeRegistryFixture($FixtureId)
    foreach ($drive in 'HKCU', 'HKCR') { if (Get-PSDrive -Name $drive -ErrorAction SilentlyContinue) { Remove-PSDrive -Name $drive -Force } }
    New-PSDrive -Name HKCU -PSProvider Registry -Root HKEY_CURRENT_USER | Out-Null
    New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT | Out-Null
    Assert-Equal (Get-ItemProperty -LiteralPath 'HKCU:\' -Name BladeFixtureIsolation).BladeFixtureIsolation $fixture.Token 'PowerShell HKCU provider is not isolated.'
    Assert-Equal (Get-ItemProperty -LiteralPath 'HKCR:\' -Name BladeFixtureIsolation).BladeFixtureIsolation $fixture.Token 'PowerShell HKCR provider is not isolated.'
    New-Item -Path 'HKCU:\ProviderIsolation' -Force | Out-Null
    Set-ItemProperty -LiteralPath 'HKCU:\ProviderIsolation' -Name Token -Value $fixture.Token
    Assert-Equal (Get-FixtureValue 'ProviderIsolation' 'Token') $fixture.Token 'Provider and .NET disagree about HKCU isolation.'
    [Microsoft.Win32.Registry]::ClassesRoot.CreateSubKey('ClassIsolation').Dispose()
    Assert-True ([BladeRegistryFixture]::SnapshotUser('Software\Classes\ClassIsolation') -ne '<absent>') 'HKCR does not map to fixture HKCU/Software/Classes.'

    Add-Type -Path (Join-Path $PSScriptRoot 'BrowserRegistrationShellFixture.cs')
    [BladeBrowserRegistrationShellV2]::FixtureToken = $fixture.Token
    # Catch cmdlet launch attempts without opening Settings or starting any browser.
    function global:Start-Process {
        [CmdletBinding()] param([Parameter(Position = 0)][string]$FilePath, [object[]]$ArgumentList, [switch]$PassThru, [string]$WindowStyle, [switch]$Wait)
        $global:BladeTestLaunchLog.Add($FilePath + ' ' + ($ArgumentList -join ' '))
        if ($FilePath -notlike 'ms-settings:*') { throw "External process launch blocked: $FilePath" }
        if ($PassThru) { return [pscustomobject]@{ ExitCode = 0; HasExited = $true } }
    }
    function global:Invoke-Item {
        [CmdletBinding()] param([Parameter(Position = 0)][string]$Path)
        $global:BladeTestLaunchLog.Add($Path)
        throw "External UI invocation blocked: $Path"
    }
    if ($Case -eq 'isolation-self-test') {
        Seed-Registrations
        Assert-True ([BladeRegistryFixture]::SnapshotUser('Software\Clients\StartMenuInternet\Blade') -ne '<absent>') 'Fixture seed missing.'
        $result.Passed = $true
    } elseif ($Case -eq 'launcher-pure-input') {
        Test-LauncherPure
        $result.Passed = $true
    } elseif ($Case -like 'launcher-*') {
        if ($Case -eq 'launcher-live-firefox64') { Test-LauncherCapture 'Firefox64' }
        elseif ($Case -eq 'launcher-prefers-blade') { Test-LauncherCapture 'Blade' -Both }
        else { Test-LauncherCapture 'Blade' }
        $result.Passed = $true
    } else {
        $env:LOCALAPPDATA = Join-Path $WorkRoot 'LocalAppData fixture'
        $env:APPDATA = Join-Path $WorkRoot 'Roaming fixture'
        $script:BladeRoot = Join-Path $env:LOCALAPPDATA 'Blade'
        $engineName = 'Blade'
        if ($Case -like '*firefox64*') { $engineName = 'Firefox64' }
        $engine = Join-Path $script:BladeRoot "App\$engineName"
        $script:Profile = Join-Path $script:BladeRoot 'Data\profile'
        $resource = Join-Path $script:Profile 'chrome\resources'
        New-Item -ItemType Directory -Path $engine, $resource -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path (Split-Path -Parent $LauncherPath) 'fake-engine.exe') -Destination (Join-Path $engine 'firefox.exe')
        Copy-Item -LiteralPath $LauncherPath -Destination (Join-Path $resource 'BladeBrowser.exe')
        $script:InstalledScript = Join-Path $resource 'set-blade-default.ps1'
        Copy-Item -LiteralPath $RegistrarPath -Destination $script:InstalledScript
        $arguments = @{ RegisterOnly = $true; EnginePath = $script:BladeRoot }
        switch ($Case) {
            'register-engine-firefox64' { $arguments.EnginePath = $engine }
            'register-autodetect' { $arguments.Remove('EnginePath') }
            'default-settings' { $arguments.Remove('RegisterOnly') }
            'validate-only' { $arguments = @{ ValidateOnly = $true; EnginePath = $engine } }
            'validate-after-register' { }
            'reject-test-engine' {
                $testEngine = Join-Path $WorkRoot 'F-development\App\Firefox64'
                New-Item -ItemType Directory -Path $testEngine -Force | Out-Null
                Copy-Item -LiteralPath (Join-Path $engine 'firefox.exe') -Destination (Join-Path $testEngine 'firefox.exe')
                $arguments.EnginePath = $testEngine
            }
            'reject-profile-mismatch' {
                $foreign = Join-Path $WorkRoot 'other profile\chrome\resources'
                New-Item -ItemType Directory -Path $foreign -Force | Out-Null
                Copy-Item -LiteralPath $script:InstalledScript -Destination (Join-Path $foreign 'set-blade-default.ps1')
                $script:InstalledScript = Join-Path $foreign 'set-blade-default.ps1'
            }
            'reject-noninstalled-caller' {
                $foreign = Join-Path $WorkRoot 'repository-copy'
                New-Item -ItemType Directory -Path $foreign -Force | Out-Null
                Copy-Item -LiteralPath $script:InstalledScript -Destination (Join-Path $foreign 'set-blade-default.ps1')
                $script:InstalledScript = Join-Path $foreign 'set-blade-default.ps1'
            }
            'reject-missing-profile' {
                # Keep caller filename but remove installed Data/profile. Registrar cannot fall back.
                $foreign = Join-Path $WorkRoot 'orphaned-resource'
                New-Item -ItemType Directory -Path $foreign -Force | Out-Null
                Copy-Item -LiteralPath $script:InstalledScript -Destination (Join-Path $foreign 'set-blade-default.ps1')
                $script:InstalledScript = Join-Path $foreign 'set-blade-default.ps1'
                Remove-Item -LiteralPath $script:Profile -Recurse -Force
            }
            'reject-missing-launcher' { Remove-Item -LiteralPath (Join-Path $resource 'BladeBrowser.exe') -Force }
        }
        Seed-Registrations
        $protectedBefore = Get-ProtectedSnapshot
        $registryBefore = [BladeRegistryFixture]::SnapshotUser('Software')
        $filesBefore = Get-TreeSnapshot
        $reject = $Case.StartsWith('reject-')
        Invoke-Registrar $arguments (-not $reject)
        Assert-Equal ([Microsoft.Win32.Registry]::CurrentUser.GetValue('BladeFixtureIsolation')) $fixture.Token 'HKCU override lost during registrar invocation.'
        Assert-Equal (Get-ProtectedSnapshot) $protectedBefore 'UserChoice/UserChoiceLatest or unrelated browser registration changed (raw registry bytes).'
        if ($reject -or $Case -eq 'validate-only') {
            Assert-Equal ([BladeRegistryFixture]::SnapshotUser('Software')) $registryBefore 'Rejected/ValidateOnly invocation wrote registry keys or values.'
            Assert-Equal (Get-TreeSnapshot) $filesBefore 'Rejected/ValidateOnly invocation wrote files or directories.'
        } else {
            Assert-Registration
            $registryAfter = [BladeRegistryFixture]::SnapshotUser('Software')
            $filesAfter = Get-TreeSnapshot
            if ($Case -eq 'repeat-idempotent') {
                Invoke-Registrar $arguments $true
                Assert-Equal ([BladeRegistryFixture]::SnapshotUser('Software')) $registryAfter 'Second registration changes registry content.'
                Assert-Equal (Get-TreeSnapshot) $filesAfter 'Second registration changes filesystem content.'
                Assert-Equal ([Microsoft.Win32.Registry]::CurrentUser.GetValue('BladeFixtureIsolation')) $fixture.Token 'HKCU override lost during registrar invocation.'
        Assert-Equal (Get-ProtectedSnapshot) $protectedBefore 'Second registration changes protected associations.'
            }
            if ($Case -eq 'validate-after-register') {
                Invoke-Registrar @{ ValidateOnly = $true; EnginePath = $engine } $true
                Assert-Equal ([BladeRegistryFixture]::SnapshotUser('Software')) $registryAfter 'ValidateOnly after registration writes registry.'
                Assert-Equal (Get-TreeSnapshot) $filesAfter 'ValidateOnly after registration writes filesystem.'
            }
        }
        if ($Case -eq 'default-settings') {
            Assert-Equal $global:BladeTestLaunchLog.Count 1 'Default invocation must request Settings exactly once.'
            Assert-True ($global:BladeTestLaunchLog[0] -like 'ms-settings:defaultapps*') 'Default invocation did not request Default apps Settings.'
            Assert-True ($global:BladeTestLaunchLog[0] -match 'BladeBrowser|Blade%20Browser|Blade Browser') 'Settings request lacks Blade application target.'
        } else { Assert-Equal $global:BladeTestLaunchLog.Count 0 'RegisterOnly/ValidateOnly/rejected invocation starts UI or another process.' }
        $result.Passed = $true
    }
    $exitCode = 0
} catch { $result.Error = $_.ToString() + "`n" + $_.ScriptStackTrace + "`n" + $_.Exception.ToString() }
finally {
    if ($null -ne $fixture) {
        try { $fixture.Dispose(); $result.RegistryCleaned = $true }
        catch { $result.Passed = $false; $exitCode = 1; $result.Error = "Registry cleanup failed: $_" }
    }
    $result.InvocationLog = @($script:InvocationLog)
    $result.Handlers = @($script:HandlerLog)
    $result['Launches'] = @($global:BladeTestLaunchLog.ToArray())
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $WorkRoot 'result.json') -Encoding UTF8
}
exit $exitCode
