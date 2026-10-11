param(
    [Parameter(Mandatory=$true)][string]$ExpectedIndexSha256,
    [Parameter(Mandatory=$true)][string]$ExpectedCommit,
    [switch]$Execute
)
$ErrorActionPreference='Stop'
$n12Root='D:\soft\.ci-tmp\game-hub-n12'
$n12Archive='D:\soft\game-hub-archives\n12-20261012'
$n12Main='D:\soft\game-hub'
$n12Index=Join-Path $n12Archive 'cleanup-index.json'
if($ExpectedIndexSha256 -notmatch '^[0-9a-f]{64}$' -or $ExpectedCommit -notmatch '^[0-9a-f]{40}$'){throw 'Exact archive index and pushed commit required'}
function Assert-N12Plain([string]$Path) {
    $item=Get-Item -LiteralPath $Path -Force
    if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Link/reparse path refused'}
    return $item
}
foreach($path in @('D:\','D:\soft','D:\soft\.ci-tmp',$n12Root,'D:\soft\game-hub-archives',$n12Archive,$n12Main)){
    $item=Assert-N12Plain $path
    if(-not $item.PSIsContainer -or [IO.Path]::GetFullPath($item.FullName).TrimEnd('\') -ine [IO.Path]::GetFullPath($path).TrimEnd('\')){throw 'Absolute directory boundary mismatch'}
}
if((Get-FileHash -LiteralPath $n12Index -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedIndexSha256){throw 'Archive index changed'}
$index=Get-Content -LiteralPath $n12Index -Raw | ConvertFrom-Json
if($index.schemaVersion -ne 1 -or $index.taskRoot -cne $n12Root -or $index.archiveRoot -cne $n12Archive){throw 'Wrong archive scope'}
$env:GIT_OPTIONAL_LOCKS='0'
$baselines=Get-Content -LiteralPath (Join-Path $n12Main 'doc\evidence\n12-originals-cleanup-baselines.json') -Raw | ConvertFrom-Json
if(@($baselines).Count -ne 7){throw 'Exactly seven original baseline records required'}
foreach($baseline in $baselines){
    if($baseline.repository -notmatch '^[A-Za-z0-9_-]+$' -or $baseline.sha -notmatch '^[0-9a-f]{40}$'){throw 'Invalid original baseline identity'}
    $original=Join-Path 'D:\soft' $baseline.repository
    $head=(git -C $original rev-parse HEAD).Trim()
    $status=@(git -C $original status --porcelain=v1 --untracked-files=all)
    if($LASTEXITCODE -ne 0 -or $head -cne $baseline.sha -or ($status -join "`n") -cne (@($baseline.status) -join "`n")){throw 'Original SHA/full worktree state changed; no cleanup'}
}
$n12Producer='2afbda179f8924d57e029d5cdddb0ca416729c90'
if($index.producerCommit -cne $n12Producer){throw 'Immutable producer identity differs'}
foreach($repo in @($n12Main,(Join-Path $n12Root 'work'))){
    $n12Required=if($repo -ceq $n12Main){$ExpectedCommit}else{$n12Producer}
    if((git -C $repo rev-parse HEAD).Trim() -cne $n12Required -or (git -C $repo status --porcelain=v1 --untracked-files=all)){throw 'Exact clean main and immutable producer required'}
}
if((git -C $n12Main remote get-url origin).Trim() -cne 'https://github.com/xiaoxuhui/game-hub.git'){throw 'Wrong main remote'}
$remote=@(git -C $n12Main ls-remote origin refs/heads/main)
if($LASTEXITCODE -ne 0 -or $remote.Count -ne 1 -or ($remote[0] -split '\s+')[0] -cne $ExpectedCommit){throw 'Expected pushed main required'}
git -C $n12Main merge-base --is-ancestor $index.sourceCommit $ExpectedCommit
if($LASTEXITCODE -ne 0){throw 'Archived source is not ancestor of exact live commit'}
foreach($file in $index.artifacts){
    if($file.path -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or ($file.path -split '/') -contains '..'){throw 'Unsafe archive path'}
    $path=[IO.Path]::GetFullPath((Join-Path $n12Archive $file.path))
    if(-not $path.StartsWith($n12Archive+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Archive path escaped'}
    $parent=[IO.Path]::GetDirectoryName($path)
    while($parent -ine $n12Archive){
        $plain=Assert-N12Plain $parent
        if(-not $plain.PSIsContainer -or -not $parent.StartsWith($n12Archive+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Archive ancestor escaped'}
        $parent=[IO.Path]::GetDirectoryName($parent)
    }
    $item=Assert-N12Plain $path
    if($item.PSIsContainer -or $item.Length -ne $file.bytes -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $file.sha256){throw 'Archive artifact differs'}
}
$bundle=Join-Path $n12Archive 'n12-source.bundle'
git -C $n12Main bundle verify $bundle
if($LASTEXITCODE -ne 0){throw 'Source bundle invalid'}
$heads=@(git -C $n12Main bundle list-heads $bundle refs/heads/main)
if($LASTEXITCODE -ne 0 -or $heads.Count -ne 1 -or ($heads[0] -split '\s+')[0] -cne $index.sourceCommit){throw 'Archived source binding differs'}
$producerBundle=Join-Path $n12Archive 'n12-producer-2afb.bundle'
git -C $n12Main bundle verify $producerBundle
if($LASTEXITCODE -ne 0){throw 'Immutable producer bundle invalid'}
$producerHeads=@(git -C $n12Main bundle list-heads $producerBundle refs/heads/main)
if($LASTEXITCODE -ne 0 -or $producerHeads.Count -ne 1 -or ($producerHeads[0] -split '\s+')[0] -cne $n12Producer){throw 'Producer bundle identity differs'}
& (Join-Path $PSScriptRoot 'verify-n12-recovery.ps1') -Index $index
$stack=New-Object 'System.Collections.Generic.Stack[string]';$stack.Push($n12Root)
$logicalBytes=[long]0;$files=[long]0
while($stack.Count){
    foreach($item in Get-ChildItem -LiteralPath $stack.Pop() -Force){
        if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Recursive target contains link/reparse entry'}
        if(-not $item.FullName.StartsWith($n12Root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Recursive target escaped'}
        if($item.PSIsContainer){$stack.Push($item.FullName)}else{$files++;$logicalBytes+=$item.Length}
    }
}
$evidence=Join-Path $n12Root 'evidence'
$actual=@(Get-ChildItem -LiteralPath $evidence -File -Recurse -Force | ForEach-Object {$_.FullName.Substring($evidence.Length+1).Replace('\','/')} | Sort-Object)
$expected=@($index.evidenceFiles | ForEach-Object {$_.path} | Sort-Object)
if(($actual -join "`n") -cne ($expected -join "`n")){throw 'Evidence file set changed after archive'}
foreach($file in $index.evidenceFiles){
    if([IO.Path]::IsPathRooted($file.path) -or ($file.path -split '/') -contains '..' -or ($file.path -split '/') -contains '.' -or ($file.path -split '/') -contains ''){throw 'Unsafe original evidence path'}
    $pathHasher=[Security.Cryptography.SHA256]::Create()
    try {$pathHash=[BitConverter]::ToString($pathHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($file.path))).Replace('-','').ToLowerInvariant()}finally{$pathHasher.Dispose()}
    $extension=[IO.Path]::GetExtension($file.path);if($extension -notmatch '^\.[A-Za-z0-9]{1,12}$'){$extension='.bin'}
    if($file.archivePath -cne ('evidence/'+$pathHash+$extension)){throw 'Evidence archive alias differs from original path'}
    $binding=@($index.artifacts | Where-Object path -CEQ $file.archivePath)
    if($binding.Count -ne 1 -or $binding[0].bytes -ne $file.bytes -or $binding[0].sha256 -cne $file.sha256){throw 'Evidence archive bytes binding missing or differs'}
    $path=[IO.Path]::GetFullPath((Join-Path $evidence $file.path))
    if(-not $path.StartsWith($evidence+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Evidence path escaped'}
    $item=Get-Item -LiteralPath $path
    if($item.Length -ne $file.bytes -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $file.sha256){throw 'Evidence bytes changed after archive'}
}
foreach($protected in @('D:\soft\game-hub-toolchain','D:\soft\game-hub-signing-backup','D:\aiden\game-hub-release-signing','D:\aiden\game-hub-resource-signing')){
    if(-not (Test-Path -LiteralPath $protected -PathType Container)){throw 'Protected permanent directory absent'}
}
$apk='D:\soft\game-hub-archives\final-cleanup-20261009\formal-assets\v0.4.0--game-hub.apk'
if((Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39'){throw 'Original formal APK changed'}
$busy=@(Get-CimInstance Win32_Process | Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($n12Root,[StringComparison]::OrdinalIgnoreCase) -ge 0})
if($busy.Count){throw 'Task process still running; stop only owned process and archive after exit'}
$ownAvd=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -match '^(emulator|qemu-system[^.]*)\.exe$' -and $_.CommandLine -match '(?:^|\s)-avd\s+"?gamehub-n12-20261012"?(?:\s|$)'})
if($ownAvd.Count){throw 'Own emulator/qemu AVD process still running, including disconnected instance'}
$devices=@(& 'D:\soft\game-hub-toolchain\android-sdk\platform-tools\adb.exe' devices)
if($LASTEXITCODE -ne 0 -or ($devices -match '^emulator-5566\s')){throw 'Own emulator still present'}
$result=Join-Path $n12Archive 'cleanup-result.json'
if(Test-Path -LiteralPath $result){throw 'Cleanup outcome exists; inspect instead of repeating'}
"Verified exact N12 target: $files files, $logicalBytes logical bytes; archive index $ExpectedIndexSha256"
if($Execute){
    $before=(Get-PSDrive D).Free
    Remove-Item -LiteralPath $n12Root -Recurse -Force
    if(Test-Path -LiteralPath $n12Root){throw 'Task root remains; inspect partial cleanup'}
    @{taskRoot=$n12Root;removed=$true;files=$files;logicalBytes=$logicalBytes;freeBytesBefore=$before;freeBytesAfter=(Get-PSDrive D).Free;indexSha256=$ExpectedIndexSha256;verifiedCommit=$ExpectedCommit;completedAtUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $result -Encoding utf8
    'N12 temporary root removed; permanent archive retained.'
}
