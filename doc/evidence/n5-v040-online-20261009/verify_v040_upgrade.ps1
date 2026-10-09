param([Parameter(Mandatory=$true)][string]$ExpectedApkSha)
$ErrorActionPreference='Stop'
$taskAdb='D:\soft\.ci-tmp\game-hub-signing-tools\android-sdk\platform-tools\adb.exe'
$taskSerial='emulator-5562'
$taskEvidence='D:\soft\.ci-tmp\game-hub-work\v030-evidence\v040-release'
$taskApk=Join-Path $taskEvidence 'game-hub.apk'
if($ExpectedApkSha -notmatch '^[0-9a-f]{64}$' -or (Get-FileHash -LiteralPath $taskApk).Hash.ToLowerInvariant() -ne $ExpectedApkSha){throw 'Final candidate hash mismatch'}
$taskAvd=@(& $taskAdb -s $taskSerial emu avd name)
if($LASTEXITCODE -ne 0 -or -not ($taskAvd | Where-Object {$_.Trim() -eq 'gamehub-resource-20261008'})){throw 'Unexpected task AVD'}
$taskPublic=Join-Path $taskEvidence 'upgrade-public-v030.apk'
if(-not (Test-Path -LiteralPath $taskPublic)){
    Invoke-WebRequest -Uri 'https://github.com/xiaoxuhui/game-hub/releases/download/v0.3.0/game-hub.apk' -Headers @{'User-Agent'='game-hub-upgrade-verification'} -OutFile $taskPublic
}
if((Get-FileHash -LiteralPath $taskPublic).Hash.ToLowerInvariant() -ne '61751251fa878523186a879c3c73ae9fef722a163cbf1e00f343c6c17736d73d'){throw 'Public v03 differs from immutable released bytes'}
$taskTest=Join-Path $taskEvidence 'final-release-test.apk'
if((Get-FileHash -LiteralPath $taskTest).Hash.ToLowerInvariant() -ne '06bde7d7ead8d4b53804e971771612da3653492da9b4f94c4f91b7be2a930488'){throw 'Final reviewed instrumentation APK mismatch'}
$env:JAVA_HOME='D:\soft\.ci-tmp\game-hub-signing-tools\jdk-17.0.20.1+1'
$taskCert=@(& 'D:\soft\.ci-tmp\game-hub-signing-tools\android-sdk\build-tools\34.0.0\apksigner.bat' verify --print-certs $taskTest)
if($LASTEXITCODE -ne 0 -or ($taskCert -join "`n") -notmatch 'Signer #1 certificate SHA-256 digest: 44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2'){throw 'Instrumentation signer mismatch'}
$taskWifi=(& $taskAdb -s $taskSerial shell settings get global wifi_on).Trim()
if($LASTEXITCODE -ne 0 -or $taskWifi -notin @('0','1')){throw 'Cannot capture wifi state'}
$taskMobile=(& $taskAdb -s $taskSerial shell settings get global mobile_data).Trim()
if($LASTEXITCODE -ne 0 -or $taskMobile -notin @('0','1')){throw 'Cannot capture mobile state'}
function Invoke-AdbStep([string]$name,[string[]]$arguments,[bool]$test=$false){
    $result=@(& $taskAdb -s $taskSerial @arguments 2>&1);$code=$LASTEXITCODE
    $result | Tee-Object -FilePath (Join-Path $taskEvidence ($name+'.txt'))
    if($code -ne 0){throw "$name adb failed $code"}
    if($test -and ((($result -join "`n") -notmatch 'OK \(1 test\)') -or (($result -join "`n") -match 'FAILURES!!!|INSTRUMENTATION_FAILED|Process crashed'))){throw "$name JUnit failed"}
}
function Get-ServiceNetworkState {
    $wifi=@(& $taskAdb -s $taskSerial shell dumpsys wifi); if($LASTEXITCODE -ne 0){throw 'Wifi service state unavailable'}
    $mobile=@(& $taskAdb -s $taskSerial shell dumpsys telephony.registry); if($LASTEXITCODE -ne 0){throw 'Mobile service state unavailable'}
    $wifiLines=@($wifi | Where-Object {$_ -match '^Wi-Fi is (enabled|disabled)$'})
    $mobileLines=@($mobile | Where-Object {$_ -match '^\s*mUserMobileDataState= (true|false)\s*$'})
    if($wifiLines.Count -ne 1 -or $mobileLines.Count -ne 1){throw 'Ambiguous task AVD service state'}
    [pscustomobject]@{wifi=($wifiLines[0] -match 'enabled$');mobile=($mobileLines[0] -match 'true\s*$')}
}
function Wait-ServiceNetworkState([bool]$wifi,[bool]$mobile,[bool]$offline=$false) {
    for($attempt=0;$attempt -lt 20;$attempt++){
        $state=Get-ServiceNetworkState
        if($state.wifi -eq $wifi -and $state.mobile -eq $mobile){
            if($offline){
                $connection=@(& $taskAdb -s $taskSerial shell dumpsys connectivity);if($LASTEXITCODE -ne 0){throw 'Connectivity readback failed'}
                if(($connection -join "`n") -notmatch '(?m)^Active default network: none\s*$'){Start-Sleep -Milliseconds 500;continue}
                $connection|Set-Content -LiteralPath (Join-Path $taskEvidence 'upgrade-offline-connectivity.txt')
            }
            return $state
        }
        Start-Sleep -Milliseconds 500
    }
    throw 'Task AVD network service state did not settle'
}
$originalServices=Get-ServiceNetworkState
try {
    Invoke-AdbStep 'upgrade-wifi-off' @('shell','svc','wifi','disable')
    Invoke-AdbStep 'upgrade-data-off' @('shell','svc','data','disable')
    $null=Wait-ServiceNetworkState $false $false $true
    Invoke-AdbStep 'upgrade-stop' @('shell','am','force-stop','com.xiaoxuhui.gamehub')
    # Never uninstall or clear the APP: seed and preserve actual same-package five-page saves.
    Invoke-AdbStep 'upgrade-install-public-v030' @('install','-r',$taskPublic)
    Invoke-AdbStep 'upgrade-install-test' @('install','-r',(Join-Path $taskEvidence 'final-release-test.apk'))
    $runner='com.xiaoxuhui.gamehub.test/androidx.test.runner.AndroidJUnitRunner'
    $class='com.xiaoxuhui.gamehub.UpgradeSaveDeviceTest'
    Invoke-AdbStep 'upgrade-seed-v030' @('shell','am','instrument','-w','-e','class',$class,'-e','saveMode','seed','-e','expectedVersion','0.3.0',$runner) $true
    Invoke-AdbStep 'upgrade-stop-after-seed' @('shell','am','force-stop','com.xiaoxuhui.gamehub')
    Invoke-AdbStep 'upgrade-read-v030' @('shell','am','instrument','-w','-e','class',$class,'-e','saveMode','verify','-e','expectedVersion','0.3.0',$runner) $true
    Invoke-AdbStep 'upgrade-install-v040' @('install','-r',$taskApk)
    Invoke-AdbStep 'upgrade-package-v040' @('shell','dumpsys','package','com.xiaoxuhui.gamehub')
    if(-not (Select-String -LiteralPath (Join-Path $taskEvidence 'upgrade-package-v040.txt') -Pattern 'versionCode=4')){throw 'Final package code is not 4'}
    Invoke-AdbStep 'upgrade-stop-before-read' @('shell','am','force-stop','com.xiaoxuhui.gamehub')
    Invoke-AdbStep 'upgrade-read-v040' @('shell','am','instrument','-w','-e','class',$class,'-e','saveMode','verify','-e','expectedVersion','0.4.0',$runner) $true
    Write-Output 'FINAL_V030_TO_V040_SAME_SIGNER_FIVE_PAGE_UPGRADE_OK'
} finally {
    $restoreProblems=@()
    & $taskAdb -s $taskSerial shell svc wifi $(if($originalServices.wifi){'enable'}else{'disable'}) | Out-Null
    if($LASTEXITCODE -ne 0){$restoreProblems+='wifi restore command failed'}
    & $taskAdb -s $taskSerial shell svc data $(if($originalServices.mobile){'enable'}else{'disable'}) | Out-Null
    if($LASTEXITCODE -ne 0){$restoreProblems+='mobile restore command failed'}
    $restoredWifi=(& $taskAdb -s $taskSerial shell settings get global wifi_on).Trim()
    if($LASTEXITCODE -ne 0 -or $restoredWifi -ne $taskWifi){$restoreProblems+='wifi restore readback mismatch'}
    $restoredMobile=(& $taskAdb -s $taskSerial shell settings get global mobile_data).Trim()
    if($LASTEXITCODE -ne 0 -or $restoredMobile -ne $taskMobile){$restoreProblems+='mobile restore readback mismatch'}
    $restoredServices=Wait-ServiceNetworkState $originalServices.wifi $originalServices.mobile
    [pscustomobject]@{beforeServices=$originalServices;afterServices=$restoredServices;beforeWifi=$taskWifi;beforeMobile=$taskMobile;afterWifi=$restoredWifi;afterMobile=$restoredMobile;errors=$restoreProblems}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $taskEvidence 'upgrade-network-restoration.json')
    if($restoreProblems.Count){throw ($restoreProblems -join '; ')}
}
