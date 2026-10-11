$ErrorActionPreference='Stop'
$n12Adb='D:\soft\game-hub-toolchain\android-sdk\platform-tools\adb.exe'
$n12Evidence='D:\soft\.ci-tmp\game-hub-n12\evidence'
$n12Serial='emulator-5566'
$n12Package='com.xiaoxuhui.gamehub'
if(-not (Select-String -LiteralPath (Join-Path $n12Evidence 'device-update-after-reset.txt') -SimpleMatch 'OK (1 test)' -Quiet)){throw 'Actual online update must pass before offline acceptance'}
function Assert-N12Emulator {
    $name=@(& $n12Adb -s $n12Serial emu avd name)
    if($LASTEXITCODE -ne 0 -or $name[0].Trim() -cne 'gamehub-n12-20261012'){throw 'Own AVD identity differs'}
}
function Invoke-N12Adb([string[]]$Arguments) {
    & $n12Adb -s $n12Serial @Arguments
    if($LASTEXITCODE -ne 0){throw 'Owned-device command failed'}
}
Assert-N12Emulator
function Read-N12Network {
    $wifi=((& $n12Adb -s $n12Serial shell settings get global wifi_on) -join '').Trim()
    if($LASTEXITCODE -ne 0 -or $wifi -notmatch '^[01]$'){throw 'Cannot read exact WiFi switch'}
    $data=((& $n12Adb -s $n12Serial shell settings get global mobile_data) -join '').Trim()
    if($LASTEXITCODE -ne 0 -or $data -notmatch '^[01]$'){throw 'Cannot read exact mobile-data switch'}
    $status=((& $n12Adb -s $n12Serial shell cmd wifi status) -join "`n")
    if($LASTEXITCODE -ne 0 -or $status -notmatch '(?m)^Wifi is (enabled|disabled)\s*$'){throw 'Cannot read actual WiFi service state'}
    $service=if($Matches[1] -ceq 'enabled'){'1'}else{'0'}
    if($service -cne $wifi){throw 'WiFi service is transitioning; refusing ambiguous state'}
    return @{wifi=$wifi;data=$data;wifiService=$service}
}
$n12Original=Read-N12Network
$n12Record=[ordered]@{startedAtUtc=[DateTime]::UtcNow.ToString('o');serial=$n12Serial;avd='gamehub-n12-20261012';producer='2afbda179f8924d57e029d5cdddb0ca416729c90';networkCommands=@('svc wifi disable','svc data disable');originalNetwork=$n12Original;restoredNetwork=$null;restorationErrors=@();restorationCompleted=$false;acceptancePassed=$false;oldPid=$null;newPid=$null;oldProcessAbsent=$false;actualDefaultNetworkNullAssertedByController=$false;result='PENDING'}
try {
    Invoke-N12Adb -Arguments @('shell','svc','wifi','disable')
    Invoke-N12Adb -Arguments @('shell','svc','data','disable')
    Start-Sleep -Seconds 3
    Invoke-N12Adb -Arguments @('shell','am','start','-n',($n12Package+'/.MainActivity'))
    Start-Sleep -Seconds 2
    $n12OldPid=((& $n12Adb -s $n12Serial shell pidof $n12Package) -join '').Trim()
    if($n12OldPid -notmatch '^\d+$'){throw 'Old actual app PID missing'}
    $n12Record.oldPid=$n12OldPid
    Invoke-N12Adb -Arguments @('shell','am','force-stop',$n12Package)
    $n12Absent=((& $n12Adb -s $n12Serial shell pidof $n12Package) -join '').Trim()
    if($n12Absent){throw 'Old app still running after force-stop'}
    $n12Record.oldProcessAbsent=$true
    $n12Stdout=Join-Path $n12Evidence 'device-offline.txt'
    $n12Stderr=Join-Path $n12Evidence 'device-offline-stderr.txt'
    if((Test-Path -LiteralPath $n12Stdout) -or (Test-Path -LiteralPath $n12Stderr)){throw 'Offline evidence already exists; inspect instead of overwrite'}
    $n12Run=Start-Process -FilePath $n12Adb -ArgumentList @('-s',$n12Serial,'shell','am','instrument','-w','-e','n12Resources','offline','-e','class','com.xiaoxuhui.gamehub.N12ProductionResourceDeviceTest','com.xiaoxuhui.gamehub.test/androidx.test.runner.AndroidJUnitRunner') -WindowStyle Hidden -RedirectStandardOutput $n12Stdout -RedirectStandardError $n12Stderr -PassThru
    $n12Deadline=[DateTime]::UtcNow.AddSeconds(240)
    while(-not $n12Run.HasExited){
        $n12NewPid=((& $n12Adb -s $n12Serial shell pidof $n12Package) -join '').Trim()
        if($n12NewPid -match '^\d+$' -and $n12NewPid -cne $n12OldPid){$n12Record.newPid=$n12NewPid}
        if([DateTime]::UtcNow -gt $n12Deadline){$n12Run.Kill();throw 'Owned offline instrument exceeded four minutes'}
        Start-Sleep -Milliseconds 300
        $n12Run.Refresh()
    }
    $n12Run.WaitForExit()
    if(-not $n12Record.newPid){throw 'New actual process PID not observed'}
    if($n12Run.ExitCode -ne 0 -or -not (Select-String -LiteralPath $n12Stdout -SimpleMatch 'OK (1 test)' -Quiet)){throw 'Actual offline controller failed; inspect saved raw logs'}
    $n12Record.actualDefaultNetworkNullAssertedByController=$true
    $n12Record.acceptancePassed=$true
} catch {
    $n12Record.result='FAIL';$n12Record.failure=$_.Exception.Message
} finally {
    try {
        Assert-N12Emulator
        foreach($n12Service in @('wifi','data')){
            try {
                $n12Action=if($n12Original[$n12Service] -ceq '1'){'enable'}else{'disable'}
                Invoke-N12Adb -Arguments @('shell','svc',$n12Service,$n12Action)
            } catch {$n12Record.restorationErrors+=($_.Exception.Message+': '+$n12Service)}
        }
        $n12RestoreDeadline=[DateTime]::UtcNow.AddSeconds(20)
        do {
            try {
                $n12Restored=Read-N12Network
                $n12Record.restoredNetwork=$n12Restored
                if($n12Restored.wifi -ceq $n12Original.wifi -and $n12Restored.data -ceq $n12Original.data){$n12Record.restorationCompleted=$true;break}
            } catch {$n12LastRestoreError=$_.Exception.Message}
            Start-Sleep -Milliseconds 300
        } while([DateTime]::UtcNow -lt $n12RestoreDeadline)
        if(-not $n12Record.restorationCompleted){$n12Record.restorationErrors+=('Original network switches not restored: '+$n12LastRestoreError)}
    } catch {$n12Record.restorationErrors+=$_.Exception.Message}
    $n12Record.result=if($n12Record.acceptancePassed -and $n12Record.restorationCompleted -and $n12Record.restorationErrors.Count -eq 0){'PASS'}else{'FAIL'}
    $n12Record.completedAtUtc=[DateTime]::UtcNow.ToString('o')
    $n12Record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $n12Evidence 'device-offline-run.json') -Encoding utf8
}
if($n12Record.result -cne 'PASS'){throw 'Offline acceptance or original network restoration failed; inspect saved evidence'}
Get-Content -LiteralPath (Join-Path $n12Evidence 'device-offline.txt')
