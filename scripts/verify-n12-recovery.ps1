param([object]$Index=$null)
$ErrorActionPreference='Stop'
$n12Main='D:\soft\game-hub'
$n12Root='D:\soft\.ci-tmp\game-hub-n12'
$n12Archive='D:\soft\game-hub-archives\n12-20261012'
$n12Required=@()
$n12Candidates=@(Get-Content -LiteralPath (Join-Path $n12Main 'doc\evidence\n12-c3\producer-2afb-double-build.json') -Raw | ConvertFrom-Json)
if($n12Candidates.Count -ne 12){throw 'Exactly twelve reviewed candidate identities required'}
foreach($n12Kind in @('resource-candidate','dynamic-candidate')){
    $n12Rows=@($n12Candidates | Where-Object kind -CEQ $n12Kind)
    if($n12Rows.Count -ne 6 -or @($n12Rows.name | Select-Object -Unique).Count -ne 6){throw 'Exactly six unique candidates per channel required'}
    $n12ArchiveDir=Join-Path $n12Archive ('candidates\'+$n12Kind)
    $n12SourceDir=Join-Path $n12Root ('work\.build\'+$n12Kind)
    foreach($n12Dir in @($n12ArchiveDir,$n12SourceDir)){
        $n12Actual=@(Get-ChildItem -LiteralPath $n12Dir -File -Recurse -Force | ForEach-Object {$_.FullName.Substring($n12Dir.Length+1)} | Sort-Object)
        if(($n12Actual -join "`n") -cne (($n12Rows.name | Sort-Object) -join "`n")){throw 'Mandatory candidate file set differs'}
    }
    foreach($n12Row in $n12Rows){
        if($n12Row.name -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]+$' -or $n12Row.sha256 -notmatch '^[0-9a-f]{64}$'){throw 'Unsafe reviewed candidate identity'}
        foreach($n12Dir in @($n12ArchiveDir,$n12SourceDir)){
            $n12Path=Join-Path $n12Dir $n12Row.name
            $n12Item=Get-Item -LiteralPath $n12Path -Force
            if(($n12Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $n12Item.Length -ne $n12Row.bytes -or (Get-FileHash -LiteralPath $n12Path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $n12Row.sha256){throw 'Mandatory candidate bytes differ from immutable producer evidence'}
        }
        $n12Required+='candidates/'+$n12Kind+'/'+$n12Row.name
    }
}
$n12Bundles=@(Get-Content -LiteralPath (Join-Path $n12Main 'doc\evidence\n12-c5\upstream-archive-bundles.json') -Raw | ConvertFrom-Json)
$n12Names=@('abelian-sandpile','conway','eml','lambda-diagram-game')
if($n12Bundles.Count -ne 4 -or (($n12Bundles.repository | Sort-Object) -join "`n") -cne ($n12Names -join "`n")){throw 'Exactly four reviewed upstream bundles required'}
if(((Get-ChildItem -LiteralPath $n12Archive -File -Filter 'upstream-*.bundle' | ForEach-Object Name | Sort-Object) -join "`n") -cne (($n12Bundles.bundle | Sort-Object) -join "`n")){throw 'Mandatory upstream bundle set differs'}
foreach($n12Row in $n12Bundles){
    if($n12Row.bundle -cne ('upstream-'+$n12Row.repository+'.bundle') -or $n12Row.sourceRevision -notmatch '^[0-9a-f]{40}$'){throw 'Unsafe upstream bundle identity'}
    $n12Path=Join-Path $n12Archive $n12Row.bundle
    $n12Item=Get-Item -LiteralPath $n12Path -Force
    if(($n12Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $n12Item.Length -ne $n12Row.bytes -or (Get-FileHash -LiteralPath $n12Path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $n12Row.sha256){throw 'Mandatory upstream bundle bytes differ'}
    git -C (Join-Path $n12Root ('upstreams\'+$n12Row.repository)) bundle verify $n12Path
    if($LASTEXITCODE -ne 0){throw 'Mandatory upstream bundle invalid'}
    $n12Heads=@(git -C $n12Main bundle list-heads $n12Path HEAD)
    if($LASTEXITCODE -ne 0 -or $n12Heads.Count -ne 1 -or ($n12Heads[0] -split '\s+')[0] -cne $n12Row.sourceRevision){throw 'Mandatory upstream bundle full source differs'}
    $n12Required+=$n12Row.bundle
}
$n12ProducerPath=Join-Path $n12Archive 'n12-producer-2afb.bundle'
git -C $n12Main bundle verify $n12ProducerPath
if($LASTEXITCODE -ne 0){throw 'Mandatory producer bundle invalid'}
$n12Heads=@(git -C $n12Main bundle list-heads $n12ProducerPath refs/heads/main)
if($LASTEXITCODE -ne 0 -or $n12Heads.Count -ne 1 -or ($n12Heads[0] -split '\s+')[0] -cne '2afbda179f8924d57e029d5cdddb0ca416729c90'){throw 'Immutable producer bundle differs'}
$n12Required+='n12-producer-2afb.bundle'
if($Index){
    foreach($n12Path in $n12Required){if(@($Index.artifacts | Where-Object path -CEQ $n12Path).Count -ne 1){throw 'Mandatory recovery artifact missing from reviewed index'}}
    foreach($n12Kind in @('resource-candidate','dynamic-candidate')){
        $n12Indexed=@($Index.artifacts | Where-Object {$_.path.StartsWith('candidates/'+$n12Kind+'/',[StringComparison]::Ordinal)})
        if($n12Indexed.Count -ne 6){throw 'Indexed mandatory candidate set differs'}
    }
}
'Twelve exact producer candidates, four exact upstream bundles and immutable producer bundle verified.'
