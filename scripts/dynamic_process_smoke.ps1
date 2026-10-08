param(
    [Parameter(Mandatory=$true)][string]$Adb,
    [Parameter(Mandatory=$true)][string]$AppApk,
    [Parameter(Mandatory=$true)][string]$TestApk,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [string]$Serial='emulator-5564',
    [string]$ExpectedAvd='gamehub-upgrade-20261009'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if($Serial -notmatch '^emulator-[0-9]+$'){throw 'Task emulator required'}
$avd=& $Adb -s $Serial emu avd name
if($LASTEXITCODE -ne 0 -or @($avd | Where-Object { $_.Trim() -eq $ExpectedAvd }).Count -ne 1){throw 'Unexpected AVD; no install or process termination performed'}
$package='com.xiaoxuhui.gamehub'
$testClass="$package.DynamicResourceProcessRecoveryTest"
$runner="$package.test/androidx.test.runner.AndroidJUnitRunner"
$remoteRoot="/sdcard/Android/data/$package/files/dynamic-process-verification"
$evidenceRoot=[IO.Path]::GetFullPath($EvidenceDirectory)
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
function Invoke-TaskAdb([string[]]$TaskArguments){
    $output=& $Adb -s $Serial @TaskArguments 2>&1
    if($LASTEXITCODE -ne 0){throw "adb failed: $($TaskArguments -join ' '); $($output -join ' ')"}
    return $output -join "`n"
}
Invoke-TaskAdb @('install','-r',$AppApk) | Set-Content -LiteralPath (Join-Path $evidenceRoot 'install-app.txt') -Encoding utf8
Invoke-TaskAdb @('install','-r','-t',$TestApk) | Set-Content -LiteralPath (Join-Path $evidenceRoot 'install-test.txt') -Encoding utf8
foreach($phase in @('state-before','state-after','retirement-half')){
    $outPath=Join-Path $evidenceRoot "$phase-interrupted.txt"
    $errPath=Join-Path $evidenceRoot "$phase-interrupted-stderr.txt"
    Invoke-TaskAdb @('shell','rm','-f',"$remoteRoot/cutpoint.json") | Out-Null
    $process=Start-Process -FilePath $Adb -ArgumentList @('-s',$Serial,'shell','am','instrument','-w','-e','dynamicPhase',$phase,'-e','class',"$testClass#prepareInterruptedOperation",$runner) -WindowStyle Hidden -PassThru -RedirectStandardOutput $outPath -RedirectStandardError $errPath
    $marker=$null
    try{
        $deadline=[DateTime]::UtcNow.AddSeconds(50)
        while([DateTime]::UtcNow -lt $deadline){
            $raw=& $Adb -s $Serial shell cat "$remoteRoot/cutpoint.json" 2>$null
            if($LASTEXITCODE -eq 0 -and $raw){
                $candidate=($raw -join "`n") | ConvertFrom-Json
                if($candidate.phase -eq $phase){$marker=$candidate;break}
            }
            if($process.HasExited){throw "Preparation exited before $phase; inspect $outPath"}
            Start-Sleep -Milliseconds 250
        }
        if($null -eq $marker){throw "Cutpoint not reached: $phase"}
        $pidText=Invoke-TaskAdb @('shell','pidof',$package)
        if(($pidText.Trim() -split '\s+') -notcontains [string]$marker.pid){throw 'Marker PID differs from running application'}
        $marker | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidenceRoot "$phase-cutpoint.json") -Encoding utf8
        Invoke-TaskAdb @('shell','am','force-stop',$package) | Out-Null
        $process.WaitForExit(10000) | Out-Null
        $remaining=& $Adb -s $Serial shell pidof $package 2>$null
        if($LASTEXITCODE -eq 0 -and $remaining){throw 'Application survived force-stop'}
        $result=Invoke-TaskAdb @('shell','am','instrument','-w','-e','dynamicPhase',$phase,'-e','class',"$testClass#verifyAfterActualProcessRestart",$runner)
        $result | Set-Content -LiteralPath (Join-Path $evidenceRoot "$phase-recovery.txt") -Encoding utf8
        if($result -notmatch 'OK \(1 test\)' -or $result -match 'FAILURES!!!|INSTRUMENTATION_FAILED'){throw "Recovery failed: $phase"}
        $text=Invoke-TaskAdb @('shell','cat',"$remoteRoot/recovered.json")
        $recovered=$text | ConvertFrom-Json
        if($recovered.previousPid -ne $marker.pid -or $recovered.newPid -eq $marker.pid){throw 'Recovery did not use a new process'}
        $text | Set-Content -LiteralPath (Join-Path $evidenceRoot "$phase-recovered.json") -Encoding utf8
        Write-Output "PASS $phase previousPid=$($marker.pid) newPid=$($recovered.newPid) sequence=$($recovered.sequence)"
    }finally{
        if(-not $process.HasExited){Invoke-TaskAdb @('shell','am','force-stop',$package) | Out-Null;$process.WaitForExit(10000) | Out-Null}
        $process.Dispose()
    }
}
Write-Output 'PASS three actual dynamic-resource process terminations and recovery assertions'
