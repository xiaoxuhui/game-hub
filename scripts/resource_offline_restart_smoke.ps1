param(
    [Parameter(Mandatory=$true)][string]$Adb,
    [Parameter(Mandatory=$true)][string]$TestApk,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [string]$Serial = 'emulator-5564'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($Serial -notmatch '^emulator-[0-9]+$') { throw 'Only an explicitly task-owned emulator may be used' }
$package = 'com.xiaoxuhui.gamehub'
$testClass = "$package.ResourceOfflineRestartDeviceTest"
$runner = "$package.test/androidx.test.runner.AndroidJUnitRunner"
$runId = [Guid]::NewGuid().ToString('N')
$root = [IO.Path]::GetFullPath($EvidenceDirectory)
New-Item -ItemType Directory -Path $root -Force | Out-Null
function Invoke-TaskAdb([string[]]$TaskArguments) {
    $output = & $Adb -s $Serial @TaskArguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "adb failed: $($TaskArguments -join ' ')" }
    return $output -join "`n"
}
function Read-TaskMarker([string]$Kind) {
    $needle = "$Kind $runId "
    $lines = Invoke-TaskAdb @('logcat','-d','-s','System.out:I','*:S')
    foreach ($line in ($lines -split '\r?\n')) {
        $position = $line.IndexOf($needle, [StringComparison]::Ordinal)
        if ($position -ge 0) { return $line.Substring($position + $needle.Length) | ConvertFrom-Json }
    }
    return $null
}
$wifi = (Invoke-TaskAdb @('shell','settings','get','global','wifi_on')).Trim()
$mobile = (Invoke-TaskAdb @('shell','settings','get','global','mobile_data')).Trim()
$process = $null
try {
    Invoke-TaskAdb @('shell','svc','wifi','disable') | Out-Null
    Invoke-TaskAdb @('shell','svc','data','disable') | Out-Null
    $packageInfo = Invoke-TaskAdb @('shell','dumpsys','package',$package)
    if ($packageInfo -notmatch 'versionCode=3\s') { throw 'Install the intended v0.3.0 task candidate first' }
    Invoke-TaskAdb @('install','-r','-t',$TestApk) | Set-Content -LiteralPath (Join-Path $root 'install-test.txt') -Encoding utf8
    $process = Start-Process -FilePath $Adb -ArgumentList @('-s',$Serial,'shell','am','instrument','-w','-e','offlineRun',$runId,'-e','class',"$testClass#prepareFourDownloadedOfflineSessionsAndPause",$runner) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root 'before-kill.txt') -RedirectStandardError (Join-Path $root 'before-kill-stderr.txt')
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    $marker = $null
    while ([DateTime]::UtcNow -lt $deadline) {
        $marker = Read-TaskMarker 'OFFLINE_FOUR_CUTPOINT'
        if ($null -ne $marker) { break }
        if ($process.HasExited) { throw 'Preparation exited before the actual process cutpoint' }
        Start-Sleep -Milliseconds 250
    }
    if ($null -eq $marker) { throw 'Four downloaded sessions did not reach the cutpoint' }
    $beforePid = (Invoke-TaskAdb @('shell','pidof',$package)).Trim() -split '\s+'
    if ($beforePid -notcontains [string]$marker.previousPid) { throw 'Cutpoint PID does not match the actual application' }
    $marker | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'cutpoint.json') -Encoding utf8
    Invoke-TaskAdb @('shell','am','force-stop',$package) | Out-Null
    $process.WaitForExit(10000) | Out-Null
    $remaining = & $Adb -s $Serial shell pidof $package 2>$null
    if ($LASTEXITCODE -eq 0 -and $remaining) { throw 'Application survived force-stop' }
    'Actual old application PID absent after force-stop' | Set-Content -LiteralPath (Join-Path $root 'force-stop.txt') -Encoding utf8
    $result = Invoke-TaskAdb @('shell','am','instrument','-w','-e','offlineRun',$runId,'-e','class',"$testClass#readFourDownloadedGamesAndActualSavesAfterProcessRestart",$runner)
    $result | Set-Content -LiteralPath (Join-Path $root 'after-restart.txt') -Encoding utf8
    if ($result -notmatch 'OK \(1 test\)' -or $result -match 'FAILURES!!!|INSTRUMENTATION_FAILED') { throw 'Actual offline restart assertions failed' }
    $recovered = Read-TaskMarker 'OFFLINE_FOUR_RECOVERED'
    if ($null -eq $recovered -or $recovered.previousPid -ne $marker.previousPid -or $recovered.newPid -eq $marker.previousPid -or $recovered.verifiedDownloadedGames -ne 4 -or $recovered.actualSavePages -ne 5) { throw 'Recovered process evidence incomplete' }
    $recovered | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'recovered.json') -Encoding utf8
    Write-Output "PASS offline four downloaded games, five actual save pages, previousPid=$($marker.previousPid), newPid=$($recovered.newPid), runId=$runId"
} finally {
    if ($null -ne $process) {
        if (-not $process.HasExited) {
            Invoke-TaskAdb @('shell','am','force-stop',$package) | Out-Null
            $process.WaitForExit(10000) | Out-Null
        }
        $process.Dispose()
    }
    Invoke-TaskAdb @('shell','svc','wifi',$(if ($wifi -eq '1') { 'enable' } else { 'disable' })) | Out-Null
    Invoke-TaskAdb @('shell','svc','data',$(if ($mobile -eq '1') { 'enable' } else { 'disable' })) | Out-Null
}
