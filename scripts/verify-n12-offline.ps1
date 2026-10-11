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
$n12Record=[ordered]@{startedAtUtc=[DateTime]::UtcNow.ToString('o');serial=$n12Serial;avd='gamehub-n12-20261012';producer='2afbda179f8924d57e029d5cdddb0ca416729c90';networkCommands=@('svc wifi disable','svc data disable');oldPid=$null;newPid=$null;oldProcessAbsent=$false;actualDefaultNetworkNullAssertedByController=$false;result='PENDING'}
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
    $n12Record.result='PASS'
} catch {
    $n12Record.result='FAIL';$n12Record.failure=$_.Exception.Message
    throw
} finally {
    $n12Record.completedAtUtc=[DateTime]::UtcNow.ToString('o')
    $n12Record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $n12Evidence 'device-offline-run.json') -Encoding utf8
    Assert-N12Emulator
    Invoke-N12Adb -Arguments @('shell','svc','wifi','enable')
    Invoke-N12Adb -Arguments @('shell','svc','data','enable')
}
Get-Content -LiteralPath (Join-Path $n12Evidence 'device-offline.txt')
