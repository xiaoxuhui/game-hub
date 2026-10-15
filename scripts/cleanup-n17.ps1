param(
    [Parameter(Mandatory=$true)][string]$ExpectedIndexSha256,
    [Parameter(Mandatory=$true)][string]$ExpectedCommit,
    [switch]$Execute
)
$ErrorActionPreference='Stop'
$taskRoot='D:\soft\.ci-tmp\game-hub-n17'
$archive='D:\soft\game-hub-archives\n17-20261016'
$main='D:\soft\game-hub'
if($ExpectedIndexSha256 -notmatch '^[0-9a-f]{64}$' -or $ExpectedCommit -notmatch '^[0-9a-f]{40}$'){throw 'Exact index and commit required'}
function Assert-Plain([string]$path) {
    $item=Get-Item -LiteralPath $path -Force
    if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Link/reparse path refused'}
    return $item
}
foreach($path in @('D:\','D:\soft','D:\soft\.ci-tmp',$taskRoot,'D:\soft\game-hub-archives',$archive,$main)){
    $item=Assert-Plain $path
    if(-not $item.PSIsContainer -or [IO.Path]::GetFullPath($item.FullName).TrimEnd('\') -ine [IO.Path]::GetFullPath($path).TrimEnd('\')){throw 'Absolute boundary differs'}
}
$indexPath=Join-Path $archive 'cleanup-index.json'
if((Get-FileHash -LiteralPath $indexPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedIndexSha256){throw 'Index differs'}
$index=Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
if($index.schemaVersion -ne 1 -or $index.taskRoot -cne $taskRoot -or $index.archiveRoot -cne $archive){throw 'Wrong archive scope'}
foreach($artifact in $index.artifacts){
    if($artifact.path -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or ($artifact.path -split '/') -contains '..'){throw 'Unsafe archive path'}
    $path=[IO.Path]::GetFullPath((Join-Path $archive $artifact.path))
    if(-not $path.StartsWith($archive+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Archive path escaped'}
    $parent=Split-Path $path
    while($parent -ine $archive){$null=Assert-Plain $parent;$parent=Split-Path $parent}
    $item=Assert-Plain $path
    if($item.PSIsContainer -or $item.Length -ne $artifact.bytes -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $artifact.sha256){throw 'Archived bytes differ'}
}
$baselines=Get-Content -LiteralPath (Join-Path $archive 'evidence\baselines-private.json') -Raw | ConvertFrom-Json
if(@($baselines).Count -ne 9){throw 'Nine originals required'}
foreach($baseline in $baselines){
    if($baseline.path -ceq $main){continue}
    if((git -C $baseline.path rev-parse HEAD).Trim() -cne $baseline.head){throw 'Original HEAD differs'}
    $status=@(git -C $baseline.path status --porcelain --untracked-files=all)
    if($LASTEXITCODE -ne 0 -or ($status -join "`n") -cne (@($baseline.status) -join "`n")){throw 'Original worktree differs'}
}
foreach($repo in @($main,(Join-Path $taskRoot 'work'))){
    if((git -C $repo rev-parse HEAD).Trim() -cne $ExpectedCommit -or (git -C $repo status --porcelain --untracked-files=all)){throw 'Exact clean checkouts required'}
}
if((git -C $main remote get-url origin).Trim() -cne 'https://github.com/xiaoxuhui/game-hub.git'){throw 'Wrong remote'}
$env:GIT_TERMINAL_PROMPT='0'
$remote=@(git -C $main -c credential.helper= -c credential.helper=wincred ls-remote origin refs/heads/main)
if($LASTEXITCODE -ne 0 -or $remote.Count -ne 1 -or ($remote[0] -split '\s+')[0] -cne $ExpectedCommit){throw 'Pushed commit differs'}
git -C $main merge-base --is-ancestor $index.sourceCommit $ExpectedCommit
if($LASTEXITCODE -ne 0){throw 'Archive source is not ancestor'}
git -C $main bundle verify (Join-Path $archive 'source.bundle')
if($LASTEXITCODE -ne 0){throw 'Recovery bundle invalid'}
if(-not $index.recoveryProbe.success -or $index.recoveryProbe.commit -cne $index.sourceCommit){throw 'Actual restore probe required'}
$stack=[Collections.Generic.Stack[string]]::new()
$stack.Push($taskRoot)
$files=[long]0
$bytes=[long]0
while($stack.Count){
    foreach($item in Get-ChildItem -LiteralPath $stack.Pop() -Force){
        if($item.Attributes -band [IO.FileAttributes]::ReparsePoint -or -not $item.FullName.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Recursive boundary/link refused'}
        if($item.PSIsContainer){$stack.Push($item.FullName)}else{$files++;$bytes+=$item.Length}
    }
}
if(Test-Path -LiteralPath (Join-Path $taskRoot 'work\.git\objects\info\alternates')){throw 'Shared Git object store refused'}
$evidence=Join-Path $taskRoot 'evidence'
$actual=@(Get-ChildItem -LiteralPath $evidence -File -Recurse -Force | ForEach-Object {$_.FullName.Substring($evidence.Length+1).Replace('\','/')} | Sort-Object)
$expected=@($index.evidenceFiles | ForEach-Object {$_.path} | Sort-Object)
if(($actual -join "`n") -cne ($expected -join "`n")){throw 'Evidence file set changed'}
foreach($file in $index.evidenceFiles){
    if($file.path -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or ($file.path -split '/') -contains '..'){throw 'Unsafe evidence path'}
    $path=[IO.Path]::GetFullPath((Join-Path $evidence $file.path))
    if(-not $path.StartsWith($evidence+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Evidence path escaped'}
    $binding=@($index.artifacts | Where-Object path -CEQ ('evidence/'+$file.path))
    if($binding.Count -ne 1 -or $binding[0].sha256 -cne $file.sha256 -or $binding[0].bytes -ne $file.bytes){throw 'Archive binding differs'}
    if((Get-Item -LiteralPath $path).Length -ne $file.bytes -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $file.sha256){throw 'Original evidence bytes differ'}
}
foreach($protected in @('D:\soft\game-hub-toolchain','D:\soft\game-hub-signing-backup','D:\aiden\game-hub-release-signing','D:\aiden\game-hub-resource-signing')){
    if(-not (Test-Path -LiteralPath $protected -PathType Container)){throw 'Permanent directory absent'}
}
$baselineApk='D:\soft\game-hub-archives\n10-20261010\evidence\d7fb241b5ecfac606296f14f3351a825d50f7afede92326965f964c7e8659a20.apk'
if((Get-FileHash -LiteralPath $baselineApk -Algorithm SHA256).Hash.ToLowerInvariant() -cne '9f57c90af42efea54e4e079d637d964346a78e7e880493eac7887f9aaac323da'){throw 'Formal baseline APK differs'}
$busy=@(Get-CimInstance Win32_Process | Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($taskRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0})
if($busy.Count){throw 'Task process still active'}
$owner=Get-Content -LiteralPath (Join-Path $archive 'evidence\emulator-owner.json') -Raw | ConvertFrom-Json
$stopped=Get-Content -LiteralPath (Join-Path $archive 'evidence\emulator-stopped.json') -Raw | ConvertFrom-Json
if($owner.serial -cne 'emulator-5580' -or $owner.avdRoot -cne (Join-Path $taskRoot 'avd') -or $stopped.ownerPid -ne $owner.pid -or $stopped.serial -cne $owner.serial -or $stopped.avdName -cne 'game-hub-n17' -or -not $stopped.confirmedAbsent -or @($stopped.processes).Count -lt 1){throw 'Trusted owned-emulator stop identity required'}
if(@($stopped.processes | Where-Object pid -eq $owner.pid).Count -ne 1){throw 'Owner process proof absent'}
$live=@(Get-CimInstance Win32_Process)
foreach($process in $stopped.processes){
    if($process.pid -lt 1 -or $process.creationTimeUtc -notmatch '^2026-' -or $process.commandLineSha256 -notmatch '^[0-9a-f]{64}$' -or -not $process.executable.StartsWith('D:\soft\game-hub-toolchain\android-sdk\emulator\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid owned process proof'}
    if(@($live | Where-Object ProcessId -eq $process.pid).Count){throw 'Recorded emulator PID still exists; also refuse PID reuse'}
}
if(@($live | Where-Object {$_.Name -match 'emulator|qemu' -and $_.CommandLine -and ($_.CommandLine -match 'game-hub-n17|(?:-port\s+5580\b)' -or $_.CommandLine.IndexOf($owner.avdRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0)}).Count){throw 'Owned AVD process still exists independently of adb'}
$devices=& 'D:\soft\game-hub-toolchain\android-sdk\platform-tools\adb.exe' devices
if($LASTEXITCODE -ne 0){throw 'adb device-state query failed'}
if($devices -match '^emulator-5580\s'){throw 'Owned emulator still active'}
if(Test-Path -LiteralPath (Join-Path $archive 'cleanup-result.json')){throw 'Cleanup result already exists'}
$result=[ordered]@{checkedAt=[DateTimeOffset]::UtcNow.ToString('o');commit=$ExpectedCommit;indexSha256=$ExpectedIndexSha256;target=$taskRoot;files=$files;logicalBytes=$bytes;execute=[bool]$Execute;removed=$false}
if($Execute){
    Remove-Item -LiteralPath $taskRoot -Recurse -Force
    if(Test-Path -LiteralPath $taskRoot){throw 'Task root remains'}
    $result.removed=$true
    $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $archive 'cleanup-result.json') -Encoding utf8
}else{
    $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $archive 'cleanup-preflight.json') -Encoding utf8
}
$result | ConvertTo-Json
