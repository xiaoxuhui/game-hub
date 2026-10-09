param(
    [Parameter(Mandatory=$true)][string]$ReviewedCommit,
    [Parameter(Mandatory=$true)][string]$ExpectedArchiveIndexSha
)
# One-time allowlisted cleanup; archive preparation and independent review precede execution.
$ErrorActionPreference='Stop'
$taskBase='D:\soft'
$taskMain='D:\soft\game-hub'
$taskCi='D:\soft\.ci-tmp'
$taskArchive='D:\soft\game-hub-archives\final-cleanup-20261009'
$taskMaintenance='D:\soft\game-hub-archives\maintenance-20261009'
$taskToolchain='D:\soft\game-hub-toolchain'
$taskSdk='D:\soft\.ci-tmp\game-hub-signing-tools\android-sdk'
$taskAdb=Join-Path $taskSdk 'platform-tools\adb.exe'
$taskTop=@(
    'game-hub-build','game-hub-build-final','game-hub-build-icon-20261003',
    'game-hub-build-p3','game-hub-build-p6','game-hub-build-p7',
    'game-hub-build-resources-20261008','game-hub-build-v2',
    'game-hub-candidate-v0.2.0-153df9a','game-hub-continuous-audit-20261008',
    'game-hub-icon-audit-20261003','game-hub-planning-v0.3.0-20261003',
    'game-hub-release-v0.2.0-74216c3','game-hub-release-v0.2.0-f53a4c1',
    'game-hub-resource-producer-20261009','game-hub-upgrade-20261009','game-hub-verify-v030-20261008'
)
$taskCiNames=@(
    'emulator-evidence','game-hub-avd','game-hub-final-153df9a','game-hub-license-audit',
    'game-hub-light-smoke-c861','game-hub-m3-emulator','game-hub-maintenance',
    'game-hub-p7-candidate','game-hub-p7-emulator','game-hub-p7-license-candidate',
    'game-hub-signing-tools','game-hub-tools','game-hub-upgrade-fixtures-20261009','game-hub-work'
)
function Task-Hash([string]$path){(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Assert-OrdinaryRoot([string]$path,[string]$parent){
    $full=[IO.Path]::GetFullPath($path)
    if($full -cne $path -or [IO.Path]::GetDirectoryName($full) -cne $parent){throw 'Final absolute path outside exact intended parent'}
    $item=Get-Item -LiteralPath $full -Force
    if(-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Ordinary task directory required'}
    $ancestor=$item.Parent
    while($ancestor){
        if($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse point in root ancestry'}
        $ancestor=$ancestor.Parent
    }
    return $full
}
function Tree-Files([string]$root,[switch]$AllowPnpmJunction){
    $stack=[Collections.Generic.Stack[string]]::new();$stack.Push($root)
    while($stack.Count){
        $parent=$stack.Pop()
        foreach($item in Get-ChildItem -LiteralPath $parent -Force){
            if(-not $item.FullName.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Tree escaped intended root'}
            if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){
                $expected='D:\soft\.ci-tmp\game-hub-tools\pnpm-11.19\node_modules\pnpm'
                $expectedTarget='D:\soft\.ci-tmp\game-hub-tools\pnpm-11.19\node_modules\.pnpm\pnpm@11.19.0\node_modules\pnpm'
                if(-not $AllowPnpmJunction -or $item.FullName -cne $expected -or $item.LinkType -ne 'Junction' -or $item.Target -cne $expectedTarget){throw 'Unexpected reparse point; no recursive deletion permitted'}
                # Do not walk the junction. The real package is visited by its ordinary path.
            } elseif($item.PSIsContainer){$stack.Push($item.FullName)} else {$item}
        }
    }
}
function Write-TaskJson([string]$path,$value){
    [IO.File]::WriteAllText($path,(($value|ConvertTo-Json -Depth 12).Replace("`r`n","`n")+"`n"),[Text.UTF8Encoding]::new($false))
}
if($ReviewedCommit -notmatch '^[0-9a-f]{40}$' -or $ExpectedArchiveIndexSha -notmatch '^[0-9a-f]{64}$'){throw 'Exact reviewed commit and archive index SHA required'}
if((git -C $taskMain rev-parse HEAD).Trim() -cne $ReviewedCommit -or (git -C $taskMain status --porcelain=v1 --untracked-files=all)){throw 'Clean reviewed main required'}
$remote=@(git -C $taskMain ls-remote origin refs/heads/main)
if($LASTEXITCODE -ne 0 -or $remote.Count -ne 1 -or ($remote[0] -split '\s+')[0] -cne $ReviewedCommit){throw 'Exact pushed main required'}
$indexPath=Join-Path $taskArchive 'verified-archive-index-after-stop.json'
Assert-OrdinaryRoot $taskArchive 'D:\soft\game-hub-archives' | Out-Null
@(Tree-Files $taskArchive) | Out-Null
if((Task-Hash $indexPath) -cne $ExpectedArchiveIndexSha){throw 'Archive index differs from independently reviewed copy'}
$index=Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
foreach($entry in $index){
    $path=[IO.Path]::GetFullPath((Join-Path $taskArchive $entry.path))
    if(-not $path.StartsWith($taskArchive+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Archive entry escaped root'}
    $file=Get-Item -LiteralPath $path -Force
    if($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $file.Length -ne $entry.bytes -or (Task-Hash $path) -cne $entry.sha256){throw 'Recovery archive bytes differ'}
}
# Reject changed clone statuses/untracked bytes and missing history before deleting anything.
& 'C:\Users\25133\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' (Join-Path $taskMain 'doc\evidence\n8-prepare-archives.py') --authenticated-api --post-stop
if($LASTEXITCODE -ne 0 -or (Task-Hash $indexPath) -cne $ExpectedArchiveIndexSha){throw 'Final archive/source revalidation failed'}
if(Test-Path -LiteralPath $taskToolchain){throw 'Fresh permanent toolchain destination required'}
if(Test-Path -LiteralPath (Join-Path $taskMaintenance 'cleanup-result.json')){throw 'Prior execution exists; inspect its outcome before recovery'}
$roots=@($taskTop|ForEach-Object {Assert-OrdinaryRoot (Join-Path $taskBase $_) $taskBase})
$roots+=@($taskCiNames|ForEach-Object {Assert-OrdinaryRoot (Join-Path $taskCi $_) $taskCi})
foreach($root in $roots){@((Tree-Files $root -AllowPnpmJunction))|Out-Null}

$processEvents=@()
# Recheck exact service identity, never stop a recycled PID by number alone.
$http=Get-CimInstance Win32_Process -Filter 'ProcessId=39312'
if($http){
    $expected='-m http.server 18404 --bind 127.0.0.1 --directory D:\soft\.ci-tmp\game-hub-work\v030-final\.build\dynamic-sources\memory-demo\examples\memory-demo'
    if($http.Name -ne 'python.exe' -or -not $http.CommandLine.EndsWith($expected,[StringComparison]::Ordinal)){throw 'HTTP service PID identity changed'}
    Stop-Process -Id $http.ProcessId
    $processEvents+=@{pid=$http.ProcessId;kind='task-local-http';stopped=$true}
}
foreach($pair in @(@('emulator-5562','gamehub-resource-20261008'),@('emulator-5564','gamehub-upgrade-20261009'))){
    $present=@(& $taskAdb devices | Select-Object -Skip 1 | Where-Object { ($_ -split '\s+')[0] -ceq $pair[0] })
    if($LASTEXITCODE -ne 0){throw 'Could not inspect emulator presence'}
    if(-not $present.Count){
        $processEvents+=@{serial=$pair[0];avd=$pair[1];alreadyAbsent=$true}
        continue
    }
    $name=@(& $taskAdb -s $pair[0] emu avd name)
    if($LASTEXITCODE -ne 0 -or $name[0].Trim() -cne $pair[1]){throw 'Task emulator identity differs'}
    & $taskAdb -s $pair[0] emu kill
    if($LASTEXITCODE -ne 0){throw 'Task emulator stop failed'}
    $processEvents+=@{serial=$pair[0];avd=$pair[1];stopped=$true}
}
Start-Sleep -Seconds 3
$devices=@(& $taskAdb devices | Select-Object -Skip 1 | Where-Object { $_.Trim() })
if($devices.Count){throw 'Other device still connected; shared SDK relocation blocked'}
& $taskAdb kill-server
if($LASTEXITCODE -ne 0){throw 'Task-only adb server stop failed'}
$busy=@()
for($attempt=0;$attempt -lt 10;$attempt++){
    $busy=@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('D:\soft\.ci-tmp\game-hub-signing-tools\') })
    if(-not $busy.Count){break}
    # Emulator exit watchdogs use -sleep 20. Wait at most 30 seconds; never kill unknown consumers.
    Start-Sleep -Seconds 3
}
if($busy.Count){throw 'Toolchain still in use; inspect processes before relocating'}

New-Item -ItemType Directory -Path $taskToolchain | Out-Null
$moved=@()
foreach($name in @('android-sdk','gradle-8.7','jdk-17.0.20.1+1')){
    $source=Join-Path 'D:\soft\.ci-tmp\game-hub-signing-tools' $name
    $source=Assert-OrdinaryRoot $source 'D:\soft\.ci-tmp\game-hub-signing-tools'
    $dest=[IO.Path]::GetFullPath((Join-Path $taskToolchain $name))
    Assert-OrdinaryRoot $taskToolchain $taskBase | Out-Null
    if([IO.Path]::GetDirectoryName($dest) -cne $taskToolchain -or (Test-Path -LiteralPath $dest)){throw 'Move destination differs from fresh permanent toolchain'}
    $before=@(Tree-Files $source | ForEach-Object {@{path=$_.FullName.Substring($source.Length+1);bytes=$_.Length;sha256=(Task-Hash $_.FullName)}})
    # Both resolved absolute endpoints are checked before the recursive directory move.
    Move-Item -LiteralPath $source -Destination $dest
    $after=@(Tree-Files $dest)
    if($before.Count -ne $after.Count){throw 'Moved toolchain file set differs'}
    foreach($entry in $before){$file=Join-Path $dest $entry.path;if((Get-Item -LiteralPath $file).Length -ne $entry.bytes -or (Task-Hash $file) -cne $entry.sha256){throw 'Moved toolchain bytes differ'}}
    Write-TaskJson (Join-Path $taskMaintenance ($name+'-preserved-hashes.json')) $before
    $moved+=@{source=$source;destination=$dest;files=$before.Count;bytes=($before|Measure-Object bytes -Sum).Sum;allHashesEqual=$true}
    "Preserved permanent toolchain: $name"
}
$pnpmSource='D:\soft\.ci-tmp\game-hub-tools\pnpm-11.19\node_modules\.pnpm\pnpm@11.19.0\node_modules\pnpm'
$pnpmSource=Assert-OrdinaryRoot $pnpmSource 'D:\soft\.ci-tmp\game-hub-tools\pnpm-11.19\node_modules\.pnpm\pnpm@11.19.0\node_modules'
$pnpmDest=[IO.Path]::GetFullPath((Join-Path $taskToolchain 'pnpm-11.19'))
if([IO.Path]::GetDirectoryName($pnpmDest) -cne $taskToolchain -or (Test-Path -LiteralPath $pnpmDest)){throw 'Pnpm copy destination unsafe'}
$pnpmFiles=@(Tree-Files $pnpmSource | ForEach-Object {@{path=$_.FullName.Substring($pnpmSource.Length+1);bytes=$_.Length;sha256=(Task-Hash $_.FullName)}})
Copy-Item -LiteralPath $pnpmSource -Destination $pnpmDest -Recurse
foreach($entry in $pnpmFiles){$file=Join-Path $pnpmDest $entry.path;if((Get-Item -LiteralPath $file).Length -ne $entry.bytes -or (Task-Hash $file) -cne $entry.sha256){throw 'Permanent pnpm copy differs'}}
$version=(& node (Join-Path $pnpmDest 'bin\pnpm.mjs') --version).Trim()
if($LASTEXITCODE -ne 0 -or $version -cne '11.19.0'){throw 'Pinned pnpm runtime failed after relocation'}
$moved+=@{source=$pnpmSource;destination=$pnpmDest;files=$pnpmFiles.Count;bytes=($pnpmFiles|Measure-Object bytes -Sum).Sum;allHashesEqual=$true}
& (Join-Path $taskToolchain 'jdk-17.0.20.1+1\bin\java.exe') -version 2>&1 | Set-Content -LiteralPath (Join-Path $taskMaintenance 'preserved-java-version.txt')
if($LASTEXITCODE -ne 0){throw 'Preserved Java runtime failed'}
& (Join-Path $taskToolchain 'android-sdk\platform-tools\adb.exe') version | Set-Content -LiteralPath (Join-Path $taskMaintenance 'preserved-adb-version.txt')
if($LASTEXITCODE -ne 0){throw 'Preserved adb runtime failed'}
[IO.File]::WriteAllText((Join-Path $taskToolchain 'README.txt'),"Permanent game-hub build toolchain, retained for future builds/signing; no signing secrets here.`nJAVA_HOME: $taskToolchain\jdk-17.0.20.1+1`nANDROID_HOME: $taskToolchain\android-sdk`nGradle: $taskToolchain\gradle-8.7\bin\gradle.bat`nPinned pnpm: node $taskToolchain\pnpm-11.19\bin\pnpm.mjs`nOld maintenance scripts preserve historical paths and require adapting before reuse.`n",[Text.UTF8Encoding]::new($false))

$removed=@();$freeBefore=(Get-PSDrive D).Free
foreach($root in $roots){
    $parent=if($taskTop -contains [IO.Path]::GetFileName($root)){$taskBase}else{$taskCi}
    $root=Assert-OrdinaryRoot $root $parent
    $current=@(Tree-Files $root -AllowPnpmJunction)
    $bytes=($current|Measure-Object Length -Sum).Sum
    $links=@(Get-ChildItem -LiteralPath $root -Recurse -Force -Attributes ReparsePoint)
    foreach($link in $links){
        # Tree-Files admitted only the one internal pnpm junction. Delete the alias only.
        if($link.FullName -cne 'D:\soft\.ci-tmp\game-hub-tools\pnpm-11.19\node_modules\pnpm'){throw 'Unexpected link immediately before delete'}
        Remove-Item -LiteralPath $link.FullName -Force -Confirm:$false
    }
    @((Tree-Files $root))|Out-Null
    # Final absolute root and every traversed child are validated immediately above.
    Remove-Item -LiteralPath $root -Recurse -Force -Confirm:$false
    if(Test-Path -LiteralPath $root){throw 'Temporary directory remains'}
    $removed+=@{path=$root;logicalBytes=$bytes;removed=$true}
    Write-TaskJson (Join-Path $taskMaintenance 'cleanup-progress.json') $removed
    "Removed task directory: $root"
}
$result=@{reviewedCommit=$ReviewedCommit;archiveIndexSha256=$ExpectedArchiveIndexSha;removed=$removed;toolchainPreserved=$moved;processes=$processEvents;logicalBytesRemoved=($removed|Measure-Object logicalBytes -Sum).Sum;observedDriveFreeBefore=$freeBefore;observedDriveFreeAfter=(Get-PSDrive D).Free;completedAtUtc=[DateTime]::UtcNow.ToString('o');originalRepositoriesTouched=$false}
Write-TaskJson (Join-Path $taskMaintenance 'cleanup-result.json') $result
'Task cleanup completed; main/original repositories, signing keys, backup and recoverable archives preserved'
