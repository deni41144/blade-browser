<#
Windows PowerShell 5.1: powershell.exe -NoProfile -ExecutionPolicy Bypass -File Patches\tests\Test-BrowserRegistration.ps1
Each case uses a separate STA process. HKCU/HKCR redirected before registrar invocation.
All files stay in tests/artifacts; real user browser keys are fingerprinted read-only.
#>
[CmdletBinding()]
param([string]$RegistrarPath = '', [string]$LauncherSourcePath = '', [string[]]$Case = @(), [switch]$HarnessSelfTest, [int]$TimeoutSeconds = 90)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
if ($env:OS -ne 'Windows_NT') { throw 'Windows registry/Shell required. No mock fallback.' }
if (-not $RegistrarPath) { $RegistrarPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'template\set-blade-default.ps1' }
if (-not $LauncherSourcePath) { $LauncherSourcePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'template\BladeBrowserLauncher.cs' }
$RegistrarPath = [IO.Path]::GetFullPath($RegistrarPath)
$LauncherSourcePath = [IO.Path]::GetFullPath($LauncherSourcePath)
$windowsPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$csc = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
foreach ($file in @($windowsPowerShell, $csc, $RegistrarPath)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required file missing: $file" }
}
if (-not $HarnessSelfTest -and -not (Test-Path -LiteralPath $LauncherSourcePath -PathType Leaf)) { throw "Production launcher source missing: $LauncherSourcePath" }
$registrarText = Get-Content -LiteralPath $RegistrarPath -Raw
if ($registrarText -match '(?i)Diagnostics\.Process|ShellExecute|CreateProcess|Microsoft\.PowerShell\.Management\\Start-Process') {
    throw 'Registrar uses process APIs that bypass safe Settings/process interception.'
}
Add-Type -Path (Join-Path $PSScriptRoot 'BrowserRegistrationFixture.cs')
function Get-RealRegistrationSnapshot {
    $paths = @('Software\Clients\StartMenuInternet', 'Software\RegisteredApplications',
        'Software\Microsoft\Windows\Shell\Associations\UrlAssociations',
        'Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts',
        'Software\Blade\BrowserRegistration', 'Software\Microsoft\Windows\CurrentVersion\App Paths\BladeBrowser.exe')
    $classes = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Classes')
    if ($null -ne $classes) {
        try { foreach ($name in $classes.GetSubKeyNames()) { if ($name -match '(?i)Blade|Firefox|Thorium|MSEdge') { $paths += "Software\Classes\$name" } } }
        finally { $classes.Dispose() }
    }
    $paths += 'Software\Classes\Applications\BladeBrowser.exe', 'Software\Classes\AppUserModelId\BladeBrowser.Desktop'
    $lines = foreach ($path in $paths | Sort-Object -Unique) { "$path`n$([BladeRegistryFixture]::SnapshotUser($path))" }
    return ($lines -join "`n")
}
function Invoke-HiddenProcess([string]$FileName, [string]$Arguments, [int]$Timeout) {
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $FileName; $start.Arguments = $Arguments
    $start.UseShellExecute = $false; $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    try {
        $null = $process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync(); $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($Timeout * 1000)) { $process.Kill(); throw "Child timeout after $Timeout seconds. Owned fixture retained." }
        return [pscustomobject]@{ ExitCode = $process.ExitCode; Stdout = $stdout.Result; Stderr = $stderr.Result }
    } finally { $process.Dispose() }
}
function Quote-Argument([string]$Text) {
    if ($Text.Contains('"') -or $Text.EndsWith('\')) { throw "Unsupported command argument: $Text" }
    return '"' + $Text + '"'
}
$artifactsRoot = Join-Path $PSScriptRoot 'artifacts'
if (Test-Path -LiteralPath $artifactsRoot) {
    if ((Get-Item -LiteralPath $artifactsRoot -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Artifacts root must not be a link.' }
}
New-Item -ItemType Directory -Path $artifactsRoot -Force | Out-Null
$runId = [guid]::NewGuid().ToString('D')
$runRoot = Join-Path $artifactsRoot $runId
New-Item -ItemType Directory -Path $runRoot | Out-Null
$runId | Set-Content -LiteralPath (Join-Path $runRoot '.fixture-owner') -Encoding ASCII
$launcher = Join-Path $runRoot 'BladeBrowser.exe'
$fakeSource = Join-Path $runRoot 'FakeEngine.cs'
@"
using System;
using System.IO;
using System.Text;
internal static class FakeEngine {
    private static int Main(string[] args) {
        string output = Environment.GetEnvironmentVariable("BLADE_TEST_CAPTURE");
        if (String.IsNullOrEmpty(output)) return 91;
        using (var writer = new StreamWriter(output, false, Encoding.UTF8)) {
            writer.WriteLine(Environment.CurrentDirectory);
            foreach (string arg in args) writer.WriteLine(Convert.ToBase64String(Encoding.Unicode.GetBytes(arg)));
        }
        return 0;
    }
}
"@ | Set-Content -LiteralPath $fakeSource -Encoding ASCII
$build = Invoke-HiddenProcess $csc ('/nologo /target:exe /out:' + (Quote-Argument (Join-Path $runRoot 'fake-engine.exe')) + ' ' + (Quote-Argument $fakeSource)) $TimeoutSeconds
if ($build.ExitCode -ne 0) { throw "Fake engine compile failed: $($build.Stdout) $($build.Stderr)" }
if (-not $HarnessSelfTest) {
    $build = Invoke-HiddenProcess $csc ('/nologo /target:winexe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /out:' + (Quote-Argument $launcher) + ' ' + (Quote-Argument $LauncherSourcePath)) $TimeoutSeconds
    if ($build.ExitCode -ne 0) { throw "Production launcher compile failed: $($build.Stdout) $($build.Stderr)" }
}
$availableCases = @('isolation-self-test', 'register-root-blade', 'register-engine-firefox64', 'register-autodetect',
    'repeat-idempotent', 'default-settings', 'validate-only', 'validate-after-register',
    'reject-test-engine', 'reject-profile-mismatch', 'reject-noninstalled-caller', 'reject-missing-profile',
    'reject-missing-launcher', 'launcher-pure-input', 'launcher-live-blade', 'launcher-live-firefox64', 'launcher-prefers-blade')
if ($HarnessSelfTest) { $Case = @('isolation-self-test') }
elseif ($Case.Count -eq 0) { $Case = $availableCases }
foreach ($name in $Case) { if ($availableCases -notcontains $name) { throw "Unknown test case: $name" } }
$realBefore = Get-RealRegistrationSnapshot
$realBefore | Set-Content -LiteralPath (Join-Path $runRoot 'real-before.txt') -Encoding UTF8
$results = @()
$reportPath = Join-Path $runRoot 'results.json'
try {
    foreach ($name in $Case) {
        $id = [guid]::NewGuid().ToString('D')
        $work = Join-Path $runRoot $name
        New-Item -ItemType Directory -Path $work | Out-Null
        $id | Set-Content -LiteralPath (Join-Path $work '.fixture-owner') -Encoding ASCII
        $args = '-NoLogo -NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -File ' +
            (Quote-Argument (Join-Path $PSScriptRoot 'Invoke-BrowserRegistrationCase.ps1')) +
            ' -Case ' + (Quote-Argument $name) + ' -WorkRoot ' + (Quote-Argument $work) +
            ' -FixtureId ' + (Quote-Argument $id) + ' -RegistrarPath ' + (Quote-Argument $RegistrarPath)
        if (-not $HarnessSelfTest) { $args += ' -LauncherPath ' + (Quote-Argument $launcher) }
        try {
            $run = Invoke-HiddenProcess $windowsPowerShell $args $TimeoutSeconds
            $run.Stdout | Set-Content -LiteralPath (Join-Path $work 'stdout.txt') -Encoding UTF8
            $run.Stderr | Set-Content -LiteralPath (Join-Path $work 'stderr.txt') -Encoding UTF8
            $resultFile = Join-Path $work 'result.json'
            if (Test-Path -LiteralPath $resultFile) { $result = Get-Content -LiteralPath $resultFile -Raw | ConvertFrom-Json }
            else { $result = [pscustomobject]@{ Case = $name; Passed = $false; Error = "No child result. Exit $($run.ExitCode): $($run.Stderr)"; RegistryCleaned = $false } }
            if ($run.ExitCode -ne 0) { $result.Passed = $false }
        } catch { $result = [pscustomobject]@{ Case = $name; Passed = $false; Error = $_.ToString(); RegistryCleaned = $false } }
        $results += $result
        if ($result.Passed) { Write-Output "PASS $name" } else { Write-Output "FAIL $name : $($result.Error)" }
    }
} finally {
    $realAfter = Get-RealRegistrationSnapshot
    $realAfter | Set-Content -LiteralPath (Join-Path $runRoot 'real-after.txt') -Encoding UTF8
    $realUnchanged = $realAfter -ceq $realBefore
    $report = [ordered]@{ RunId = $runId; RegistrarPath = $RegistrarPath
        RegistrarSHA256 = (Get-FileHash -LiteralPath $RegistrarPath -Algorithm SHA256).Hash
        LauncherSourcePath = $LauncherSourcePath; WindowsPowerShell = $windowsPowerShell
        RealUserRegistrationsUnchanged = $realUnchanged
        Passed = @($results | Where-Object { $_.Passed }).Count
        Failed = @($results | Where-Object { -not $_.Passed }).Count
        Cases = $results }
    $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    Write-Output "Report: $reportPath"
    if (-not $realUnchanged) { throw 'SAFETY FAILURE: real user browser registration fingerprint changed.' }
}
if (@($results | Where-Object { -not $_.Passed }).Count -gt 0) { exit 1 }
exit 0
