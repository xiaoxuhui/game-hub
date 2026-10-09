param(
    [Parameter(Mandatory=$true)][string]$ExpectedIndexSha256,
    [Parameter(Mandatory=$true)][string]$ExpectedCommit,
    [switch]$Execute
)
$ErrorActionPreference='Stop'
$n9Root='D:\soft\.ci-tmp\game-hub-n9'
$n9Archive='D:\soft\game-hub-archives\n9-20261010'
$n9Main='D:\soft\game-hub'
$n9Index=Join-Path $n9Archive 'cleanup-index.json'
if($ExpectedIndexSha256 -notmatch '^[0-9a-f]{64}$' -or $ExpectedCommit -notmatch '^[0-9a-f]{40}$'){throw 'Exact archive index and pushed commit required'}
function Assert-N9Plain([string]$Path) {
    $item=Get-Item -LiteralPath $Path -Force
    if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Link/reparse path refused'}
    return $item
}
foreach($path in @('D:\','D:\soft','D:\soft\.ci-tmp',$n9Root,'D:\soft\game-hub-archives',$n9Archive,$n9Main)){
    $item=Assert-N9Plain $path
    if(-not $item.PSIsContainer -or [IO.Path]::GetFullPath($item.FullName).TrimEnd('\') -ine [IO.Path]::GetFullPath($path).TrimEnd('\')){throw 'Absolute directory boundary mismatch'}
}
if((Get-FileHash -LiteralPath $n9Index -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedIndexSha256){throw 'Archive index changed'}
$index=Get-Content -LiteralPath $n9Index -Raw | ConvertFrom-Json
if($index.schemaVersion -ne 1 -or $index.taskRoot -cne $n9Root -or $index.archiveRoot -cne $n9Archive){throw 'Wrong archive scope'}
$env:GIT_OPTIONAL_LOCKS='0'
foreach($repo in @($n9Main,(Join-Path $n9Root 'work'))){
    if((git -C $repo rev-parse HEAD).Trim() -cne $ExpectedCommit -or (git -C $repo status --porcelain=v1 --untracked-files=all)){throw 'Exact clean live checkout required'}
}
if((git -C $n9Main remote get-url origin).Trim() -cne 'https://github.com/xiaoxuhui/game-hub.git'){throw 'Wrong main remote'}
$remote=@(git -C $n9Main ls-remote origin refs/heads/main)
if($LASTEXITCODE -ne 0 -or $remote.Count -ne 1 -or ($remote[0] -split '\s+')[0] -cne $ExpectedCommit){throw 'Expected pushed main required'}
git -C $n9Main merge-base --is-ancestor $index.sourceCommit $ExpectedCommit
if($LASTEXITCODE -ne 0){throw 'Archived source is not ancestor of exact live commit'}
foreach($file in $index.artifacts){
    if($file.path -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or ($file.path -split '/') -contains '..'){throw 'Unsafe archive path'}
    $path=[IO.Path]::GetFullPath((Join-Path $n9Archive $file.path))
    if(-not $path.StartsWith($n9Archive+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Archive path escaped'}
    $parent=[IO.Path]::GetDirectoryName($path)
    while($parent -ine $n9Archive){
        $plain=Assert-N9Plain $parent
        if(-not $plain.PSIsContainer -or -not $parent.StartsWith($n9Archive+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Archive ancestor escaped'}
        $parent=[IO.Path]::GetDirectoryName($parent)
    }
    $item=Assert-N9Plain $path
    if($item.PSIsContainer -or $item.Length -ne $file.bytes -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $file.sha256){throw 'Archive artifact differs'}
}
$bundle=Join-Path $n9Archive 'n9-source.bundle'
git -C $n9Main bundle verify $bundle
if($LASTEXITCODE -ne 0){throw 'Source bundle invalid'}
$heads=@(git -C $n9Main bundle list-heads $bundle refs/heads/main)
if($LASTEXITCODE -ne 0 -or $heads.Count -ne 1 -or ($heads[0] -split '\s+')[0] -cne $index.sourceCommit){throw 'Archived source binding differs'}
$stack=New-Object 'System.Collections.Generic.Stack[string]';$stack.Push($n9Root)
$logicalBytes=[long]0;$files=[long]0
while($stack.Count){
    foreach($item in Get-ChildItem -LiteralPath $stack.Pop() -Force){
        if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Recursive target contains link/reparse entry'}
        if(-not $item.FullName.StartsWith($n9Root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Recursive target escaped'}
        if($item.PSIsContainer){$stack.Push($item.FullName)}else{$files++;$logicalBytes+=$item.Length}
    }
}
$evidence=Join-Path $n9Root 'evidence'
$actual=@(Get-ChildItem -LiteralPath $evidence -File -Recurse -Force | ForEach-Object {$_.FullName.Substring($evidence.Length+1).Replace('\','/')} | Sort-Object)
$expected=@($index.evidenceFiles | ForEach-Object {$_.path} | Sort-Object)
if(($actual -join "`n") -cne ($expected -join "`n")){throw 'Evidence file set changed after archive'}
foreach($file in $index.evidenceFiles){
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
$busy=@(Get-CimInstance Win32_Process | Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($n9Root,[StringComparison]::OrdinalIgnoreCase) -ge 0})
if($busy.Count){throw 'Task process still running; stop only owned process and archive after exit'}
$devices=@(& 'D:\soft\game-hub-toolchain\android-sdk\platform-tools\adb.exe' devices)
if($LASTEXITCODE -ne 0 -or ($devices -match '^emulator-5566\s')){throw 'Own emulator still present'}
$result=Join-Path $n9Archive 'cleanup-result.json'
if(Test-Path -LiteralPath $result){throw 'Cleanup outcome exists; inspect instead of repeating'}
"Verified exact N9 target: $files files, $logicalBytes logical bytes; archive index $ExpectedIndexSha256"
if($Execute){
    $before=(Get-PSDrive D).Free
    Remove-Item -LiteralPath $n9Root -Recurse -Force
    if(Test-Path -LiteralPath $n9Root){throw 'Task root remains; inspect partial cleanup'}
    @{taskRoot=$n9Root;removed=$true;files=$files;logicalBytes=$logicalBytes;freeBytesBefore=$before;freeBytesAfter=(Get-PSDrive D).Free;indexSha256=$ExpectedIndexSha256;verifiedCommit=$ExpectedCommit;completedAtUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $result -Encoding utf8
    'N9 temporary root removed; permanent archive retained.'
}
