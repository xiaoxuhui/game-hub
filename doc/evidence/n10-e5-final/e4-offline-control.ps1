$ErrorActionPreference='Stop'
$taskAdb='D:\soft\game-hub-toolchain\android-sdk\platform-tools\adb.exe'
$taskRoot='D:\soft\.ci-tmp\game-hub-n10\evidence'
$taskLog=Join-Path $taskRoot 'e4-offline-control.log'
$taskName=@(@(& $taskAdb -s emulator-5566 emu avd name) | Where-Object {$_ -match '^gamehub-'})
if($taskName.Count -ne 1 -or $taskName[0].Trim() -ne 'gamehub-n10-20261010'){throw 'Own formal AVD required'}
Set-Content -LiteralPath $taskLog -Value ('Own AVD: '+$taskName[0])
& $taskAdb -s emulator-5566 logcat -c
$taskRunner=Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList @('-NoProfile','-File',(Join-Path $taskRoot 'e4-instrument-offline.ps1')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRoot 'e4-online-to-offline.log') -RedirectStandardError (Join-Path $taskRoot 'e4-online-to-offline-stderr.log')
try {
 $taskEnd=[DateTime]::UtcNow.AddSeconds(220);$taskReady=$false
 do {
  $taskCapture=@(& $taskAdb -s emulator-5566 logcat -d -s System.out:I '*:S')
  if($taskCapture -match 'WAITING_FOR_OWN_DEVICE_DISCONNECT'){$taskReady=$true;break}
  $taskRunner.Refresh();if($taskRunner.HasExited){break}
  Start-Sleep -Milliseconds 500
 }while([DateTime]::UtcNow -lt $taskEnd)
 [IO.File]::WriteAllText((Join-Path $taskRoot 'e4-online-before-disconnect.log'),($taskCapture -join "`n"),[Text.UTF8Encoding]::new($false))
 if(-not $taskReady){throw 'Actual fresh source/history state did not reach disconnect signal; retain failure'}
 Add-Content -LiteralPath $taskLog -Value 'Actual six fresh results and directory offers reached WAITING signal'
 Add-Content -LiteralPath $taskLog -Value 'COMMAND: svc wifi/data disable (own serial only)'
 & $taskAdb -s emulator-5566 shell svc wifi disable
 & $taskAdb -s emulator-5566 shell svc data disable
 Add-Content -LiteralPath $taskLog -Value 'COMMAND: wifi_on and active default network readback'
 & $taskAdb -s emulator-5566 shell settings get global wifi_on | Add-Content -LiteralPath $taskLog
 & $taskAdb -s emulator-5566 shell dumpsys connectivity | Select-String 'Active default network:' | ForEach-Object {$_.Line} | Add-Content -LiteralPath $taskLog
 $taskEnd=[DateTime]::UtcNow.AddSeconds(120)
 do {$taskRunner.Refresh();if($taskRunner.HasExited){break};Start-Sleep -Milliseconds 500}while([DateTime]::UtcNow -lt $taskEnd)
 if(-not $taskRunner.HasExited){throw 'Controller did not complete; inspect'}
 & $taskAdb -s emulator-5566 logcat -d -s System.out:I '*:S' | Set-Content -LiteralPath (Join-Path $taskRoot 'e4-offline-actual-sources.log') -Encoding UTF8
 $taskResult=Get-Content -LiteralPath (Join-Path $taskRoot 'e4-online-to-offline.log') -Raw
 if($taskRunner.ExitCode -ne 0 -or $taskResult -notmatch 'OK \(1 test\)' -or $taskResult -match 'FAILURES!!!|INSTRUMENTATION_FAILED'){throw 'Actual online-to-offline gate failed'}
 Write-Output 'Actual formal online-to-offline gate PASS'
} finally {
 Add-Content -LiteralPath $taskLog -Value 'COMMAND: finally restore wifi/data'
 & $taskAdb -s emulator-5566 shell svc wifi enable
 & $taskAdb -s emulator-5566 shell svc data enable
 & $taskAdb -s emulator-5566 shell settings get global wifi_on | Add-Content -LiteralPath $taskLog
}
