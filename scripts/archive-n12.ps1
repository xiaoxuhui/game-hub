param([Parameter(Mandatory=$true)][string]$SourceCommit)
$ErrorActionPreference='Stop'
$n12Main='D:\soft\game-hub'
$n12Root='D:\soft\.ci-tmp\game-hub-n12'
$n12Archive='D:\soft\game-hub-archives\n12-20261012'
$n12Evidence=Join-Path $n12Root 'evidence'
if($SourceCommit -notmatch '^[0-9a-f]{40}$' -or (git -C $n12Main rev-parse HEAD).Trim() -cne $SourceCommit -or (git -C $n12Main status --porcelain=v1 --untracked-files=all)){throw 'Exact clean source commit required'}
$n12Index=Join-Path $n12Archive 'cleanup-index.json'
if(Test-Path -LiteralPath $n12Index){throw 'Archive index exists; do not overwrite'}
foreach($n12Directory in @($n12Root,$n12Archive,$n12Evidence)){
    $n12Item=Get-Item -LiteralPath $n12Directory -Force
    if(-not $n12Item.PSIsContainer -or ($n12Item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Plain exact directories required'}
}
$n12Bundle=Join-Path $n12Archive 'n12-source.bundle'
if(Test-Path -LiteralPath $n12Bundle){throw 'Source recovery bundle exists; inspect instead of overwrite'}
git -C $n12Main bundle create $n12Bundle refs/heads/main
if($LASTEXITCODE -ne 0){throw 'Source recovery bundle failed'}
git -C $n12Main bundle verify $n12Bundle
if($LASTEXITCODE -ne 0){throw 'Source recovery bundle verification failed'}
$n12AliasDir=Join-Path $n12Archive 'evidence'
if(Test-Path -LiteralPath $n12AliasDir){throw 'Evidence archive exists; inspect before retry'}
New-Item -ItemType Directory -Path $n12AliasDir | Out-Null
$n12Files=@()
foreach($n12File in Get-ChildItem -LiteralPath $n12Evidence -File -Recurse -Force | Sort-Object FullName){
    if($n12File.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Evidence link refused'}
    $n12Relative=$n12File.FullName.Substring($n12Evidence.Length+1).Replace('\','/')
    $n12Hasher=[Security.Cryptography.SHA256]::Create()
    try {$n12Alias=[BitConverter]::ToString($n12Hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($n12Relative))).Replace('-','').ToLowerInvariant()}finally{$n12Hasher.Dispose()}
    $n12Extension=[IO.Path]::GetExtension($n12Relative)
    if($n12Extension -notmatch '^\.[A-Za-z0-9]{1,12}$'){$n12Extension='.bin'}
    $n12ArchivePath='evidence/'+$n12Alias+$n12Extension
    $n12Destination=Join-Path $n12Archive $n12ArchivePath
    $n12Before=(Get-FileHash -LiteralPath $n12File.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    Copy-Item -LiteralPath $n12File.FullName -Destination $n12Destination
    $n12After=(Get-FileHash -LiteralPath $n12Destination -Algorithm SHA256).Hash.ToLowerInvariant()
    if($n12Before -cne $n12After -or (Get-Item -LiteralPath $n12Destination).Length -ne $n12File.Length -or (Get-FileHash -LiteralPath $n12File.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -cne $n12Before){throw 'Evidence changed during copy'}
    $n12Files+=@{path=$n12Relative;archivePath=$n12ArchivePath;bytes=$n12File.Length;sha256=$n12Before}
}
$n12Artifacts=@()
foreach($n12File in Get-ChildItem -LiteralPath $n12Archive -File -Recurse -Force | Sort-Object FullName){
    if($n12File.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Archive link refused'}
    $n12Artifacts+=@{path=$n12File.FullName.Substring($n12Archive.Length+1).Replace('\','/');bytes=$n12File.Length;sha256=(Get-FileHash -LiteralPath $n12File.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
}
@{schemaVersion=1;taskRoot=$n12Root;archiveRoot=$n12Archive;sourceCommit=$SourceCommit;producerCommit='2afbda179f8924d57e029d5cdddb0ca416729c90';notes=@('evidence/offline-run.ps1 is an unexecuted initial draft. Actual offline acceptance used scripts/verify-n12-offline.ps1 at a8ccc9f690b4941e0967bbb20b2b672ffbfaf7fe.','Producer checkout remains fixed at 2afb. Later source bundle records reviewed test helpers and closure documentation; resources were not rebuilt or republished.');createdAtUtc=[DateTime]::UtcNow.ToString('o');artifacts=$n12Artifacts;evidenceFiles=$n12Files} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $n12Index -Encoding utf8
'N12 archive index SHA256: '+(Get-FileHash -LiteralPath $n12Index -Algorithm SHA256).Hash.ToLowerInvariant()
