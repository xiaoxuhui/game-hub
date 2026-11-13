param(
    [Parameter(Mandatory=$true)][string]$Commit,
    [Parameter(Mandatory=$true)][string]$ExpectedPreviousSha,
    [Parameter(Mandatory=$true)][string]$NextSequence,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [ValidateSet('legacy','n9','n10','n12','n13','n14','n15','n16','n18','n19','n20','n21','n22','n23','n24','n28','t1','two20261101','lambda-motion')][string]$TaskScope='legacy',
    [switch]$ResumeAfterUploads,
    [switch]$OnlyNewHex,
    [switch]$OnlyNewAnt,
    [switch]$OnlyTwoNew
)
$ErrorActionPreference='Stop'
$taskCheckout='D:\soft\.ci-tmp\game-hub-work\v030-final'
$taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-work\v030-evidence\v040-resource-update'
if($TaskScope -ieq 'lambda-motion'){
    $taskCheckout=Split-Path -Parent $PSScriptRoot
    $taskEvidenceRoot='D:\soft\.ci-tmp\lambda-motion-evidence-20261114'
    $env:GAME_HUB_DYNAMIC_GAME='lambda-diagram-game'
}
if($TaskScope -ieq 'n9'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n9\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n9\evidence\publication'
}
if($TaskScope -ieq 'n10'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n10\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n10\evidence\publication'
}
if($TaskScope -ieq 'n12'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n12\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n12\evidence\publication'
}
if($TaskScope -ieq 'n13'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n13\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n13\evidence\publication'
}
if($TaskScope -ieq 'n14'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n14\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n14\evidence\publication'
}
if($TaskScope -ieq 'n15'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n15\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n15\evidence\publication'
}
if($TaskScope -ieq 'n16'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n16\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n16\evidence\publication'
}
if($TaskScope -ieq 'n18'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n18\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n18\evidence\publication'
}
if($TaskScope -ieq 'n19'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n19\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n19\evidence\publication'
}
if($TaskScope -ieq 'n20'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n20\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n20\evidence\publication'
}
if($TaskScope -ieq 'n21'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n21\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n21\evidence\publication'
}
if($TaskScope -ieq 'n22'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n22\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n22\evidence\publication'
}
if($TaskScope -ieq 'n23'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n23\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n23\evidence\publication'
}
if($TaskScope -ieq 'n24'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n24\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n24\evidence\publication'
}
$taskApi='https://api.github.com/repos/xiaoxuhui/game-hub'
if($TaskScope -ieq 'n28'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n28\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n28\evidence\publication'
}
if($TaskScope -ieq 't1'){
    $taskCheckout='D:\soft\.ci-tmp\turbowarp-hall-20261026\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\turbowarp-hall-20261026\evidence\publication'
}
if($TaskScope -ieq 'two20261101'){
    $taskCheckout='D:\aiden\game-hub-publisher-20261101'
    $taskEvidenceRoot='D:\aiden\game-hub-publisher-evidence-20261101'
}
$taskHeaders=@{Accept='application/vnd.github+json';'User-Agent'='game-hub-resource-successor';'X-GitHub-Api-Version'='2022-11-28'}
$taskCredentialLines=$null; $taskCredential=$null; $taskEncrypted=$null; $taskDer=$null; $taskPem=$null
$taskSelectionArgs=@()
if(@($OnlyNewHex,$OnlyNewAnt,$OnlyTwoNew | Where-Object {$_}).Count -gt 1){throw 'New-game selection flags are mutually exclusive'}
$taskSelectedId=if($OnlyNewHex){'hex-cell-lab'}elseif($OnlyNewAnt){'langtons-ant'}elseif($OnlyTwoNew){'two-new-games'}else{$null}
if($TaskScope -ieq 'two20261101' -and -not $OnlyTwoNew){throw 'Two-game scope requires exact selection'}
if($taskSelectedId){if(($taskSelectedId -eq 'two-new-games' -and $TaskScope -ine 'two20261101') -or ($taskSelectedId -ne 'two-new-games' -and $TaskScope -ine 'n28')){throw 'Selected publication has wrong reviewed scope'};$taskSelectionArgs=@($taskSelectedId)}
if($Commit -notmatch '^[0-9a-f]{40}$' -or $ExpectedPreviousSha -notmatch '^[0-9a-f]{64}$' -or $NextSequence -notmatch '^[1-9][0-9]{0,18}$'){throw 'Explicit exact commit, previous SHA and sequence required'}
$taskDirectory=[IO.Path]::GetFullPath($EvidenceDirectory)
if(-not $taskDirectory.StartsWith($taskEvidenceRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Exact task evidence subdirectory required'}
if($ResumeAfterUploads){
    if($TaskScope -notin @('n10','n12','n13','n14','n15','n16','n18','n19','n20','n21','n22','n23','n24','n28','t1','two20261101')){throw 'Resume is restricted to reviewed task scopes'}
    foreach($taskRequired in @('before-snapshot.json','previous.signed.json','uploaded-resources.json')){
        if(-not (Test-Path -LiteralPath (Join-Path $taskDirectory $taskRequired) -PathType Leaf)){throw 'Verified post-upload records required for resume'}
    }
    foreach($taskForbidden in @('signing-snapshot.json','payload.json','catalog.signed.json','activation-intent.json','published.json','resume-snapshot.json')){
        if(Test-Path -LiteralPath (Join-Path $taskDirectory $taskForbidden)){throw 'Resume only before signing/payload; inspect later outcome read-only'}
    }
}elseif(Test-Path -LiteralPath $taskDirectory){throw 'Fresh task evidence required; inspect any previous outcome'}
if((git -C $taskCheckout rev-parse HEAD).Trim() -ne $Commit -or (git -C $taskCheckout status --porcelain=v1 --untracked-files=all)){throw 'Clean exact producer checkout required'}
if((git -C $taskCheckout remote get-url origin).Trim() -ne 'https://github.com/xiaoxuhui/game-hub.git'){throw 'Wrong producer remote'}
$taskRemote=@(git -C $taskCheckout ls-remote origin refs/heads/main)
if($LASTEXITCODE -ne 0 -or $taskRemote.Count -ne 1 -or ($taskRemote[0] -split '\s+')[0] -ne $Commit){throw 'Exact pushed main required'}
function Assert-FixedTags {
    foreach($tag in @('v0.4.0','game-resources-v2')){
        $refs=@(git -C $taskCheckout ls-remote origin "refs/tags/$tag^{}")
        if($LASTEXITCODE -ne 0 -or $refs.Count -ne 1 -or ($refs[0] -split '\s+')[0] -ne '4aacb1f81b7fc381d2ca7fd725fd93dd109e390e'){throw 'Published tag moved or missing; no write permitted'}
    }
}
Assert-FixedTags
. (Join-Path $PSScriptRoot 'resource-publication-lock.ps1')
$publicationLock=Enter-ResourcePublicationLock
$publicationMutationStarted=$false;$publicationVerified=$false
try {
if(-not $ResumeAfterUploads){New-Item -ItemType Directory -Path $taskDirectory | Out-Null}
Push-Location -LiteralPath $taskCheckout
try {
    $taskAdmissionMode=if($ResumeAfterUploads){'resume'}else{'preflight'}
    node scripts/resource-successor.mjs $taskAdmissionMode $taskDirectory $ExpectedPreviousSha $NextSequence @taskSelectionArgs
    if($LASTEXITCODE -ne 0){throw 'Anonymous history/candidate admission failed before credentials'}
    $taskUploadGames=@(Get-Content -LiteralPath '.build\dynamic-candidate\games.unsigned.json' -Raw | ConvertFrom-Json)
    if($taskSelectedId){
        $taskSelection=Get-Content -LiteralPath (Join-Path $taskDirectory 'publication-selection.json') -Raw | ConvertFrom-Json
        if($taskSelectedId -eq 'two-new-games'){
            $taskIds=@('lights-out-matrix','learning-machine')
            $taskUploadGames=@($taskUploadGames | Where-Object { $_.id -cin $taskIds })
            if($taskSelection.schemaVersion -ne 1 -or $taskSelection.selector -cne $taskSelectedId -or $taskSelection.producerCommit -cne $Commit -or $taskSelection.previousSha -cne $ExpectedPreviousSha -or $taskSelection.nextSequence -cne $NextSequence -or @($taskSelection.selected).Count -ne 2 -or $taskUploadGames.Count -ne 2){throw 'Exact two-game preflight selection required'}
            foreach($id in $taskIds){
                $selected=@($taskUploadGames | Where-Object id -CEQ $id); $chosen=@($taskSelection.selected | Where-Object id -CEQ $id)
                if($selected.Count -ne 1 -or $chosen.Count -ne 1){throw 'Selected game missing or duplicated'}
                $item=$selected[0]; $record=$chosen[0]; $name="game-$id-$($item.contentCode)-$($item.archiveSha256.Substring(0,12)).zip"
                if($record.contentCode -ne 1 -or $item.contentCode -ne 1 -or $record.archiveBytes -ne $item.archiveBytes -or $record.archiveSha256 -cne $item.archiveSha256 -or $record.assetName -cne $name){throw 'Upload differs from exact immutable selected ZIP'}
            }
        }else{
        $taskUploadGames=@($taskUploadGames | Where-Object id -CEQ $taskSelectedId)
        if($taskSelection.schemaVersion -ne 1 -or $taskSelection.selector -cne $taskSelectedId -or $taskSelection.producerCommit -cne $Commit -or $taskSelection.previousSha -cne $ExpectedPreviousSha -or $taskSelection.nextSequence -cne $NextSequence -or @($taskSelection.selected).Count -ne 1 -or $taskUploadGames.Count -ne 1){throw 'Exact preflight selection required before credentials or uploads'}
        $taskChosen=$taskSelection.selected[0];$taskSelected=$taskUploadGames[0]
        $taskSelectedAsset="game-$taskSelectedId-$($taskSelected.contentCode)-$($taskSelected.archiveSha256.Substring(0,12)).zip"
        if($taskChosen.id -cne $taskSelectedId -or $taskChosen.contentCode -ne 1 -or $taskSelected.contentCode -ne 1 -or $taskChosen.archiveBytes -ne $taskSelected.archiveBytes -or $taskChosen.archiveSha256 -cne $taskSelected.archiveSha256 -or $taskChosen.assetName -cne $taskSelectedAsset){throw 'Upload differs from exact immutable selected ZIP'}
        }
    }else{
        $taskSelection=Get-Content -LiteralPath (Join-Path $taskDirectory 'legacy-default-selection.json') -Raw | ConvertFrom-Json
        if($taskSelection.schemaVersion -ne 1 -or $taskSelection.producerCommit -cne $Commit -or $taskSelection.previousSha -cne $ExpectedPreviousSha -or $taskSelection.nextSequence -cne $NextSequence){throw 'Legacy selection context changed'}
        $taskIds=@($taskSelection.selected | ForEach-Object { $_.id })
        $taskUploadGames=@($taskUploadGames | Where-Object { $_.id -cin $taskIds })
        if($taskUploadGames.Count -ne $taskIds.Count -or $taskIds.Count -gt 16){throw 'Legacy upload selection differs from admission'}
        foreach($item in $taskUploadGames){
            $chosen=@($taskSelection.selected | Where-Object id -CEQ $item.id)
            $name="game-$($item.id)-$($item.contentCode)-$($item.archiveSha256.Substring(0,12)).zip"
            if($chosen.Count -ne 1 -or $chosen[0].contentCode -ne $item.contentCode -or $chosen[0].archiveBytes -ne $item.archiveBytes -or $chosen[0].archiveSha256 -cne $item.archiveSha256 -or $chosen[0].assetName -cne $name){throw 'Legacy upload differs from admitted ZIP'}
        }
        Write-Host "Legacy catalog omits $(@($taskSelection.omitted).Count) candidate(s): $($taskSelection.omitted -join ', ')"
    }
    node scripts/resource-successor.mjs upload-preflight $taskDirectory $ExpectedPreviousSha $NextSequence @taskSelectionArgs
    if($LASTEXITCODE -ne 0){throw 'Full selected descriptor/previous games proof failed before credentials or uploads'}
    $taskSnapshotName=if($ResumeAfterUploads){'resume-snapshot.json'}else{'before-snapshot.json'}
    $taskBefore=Get-Content -LiteralPath (Join-Path $taskDirectory $taskSnapshotName) -Raw | ConvertFrom-Json
    $taskAssets=@($taskBefore.assetPages | ForEach-Object {$_.assets})
    $taskOld=@($taskAssets | Where-Object name -CEQ 'catalog.signed.json')
    if($taskOld.Count -ne 1){throw 'Current catalog identity missing'}
    $taskOldId=[long]$taskOld[0].id
    $env:GIT_TERMINAL_PROMPT='0'
    $taskCredentialLines=@("protocol=https`nhost=github.com`n`n" | git -c credential.helper= -c credential.helper=wincred credential fill)
    if($LASTEXITCODE -ne 0){throw 'GitHub credential unavailable'}
    $taskCredential=@{}
    foreach($line in $taskCredentialLines){$pair=$line -split '=',2;if($pair.Length -eq 2){$taskCredential[$pair[0]]=$pair[1]}}
    if(-not $taskCredential.password){throw 'GitHub credential unavailable'}
    $taskHeaders.Authorization='Bearer '+$taskCredential.password
    function Upload-Asset([string]$file,[string]$name){
        $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant();$size=(Get-Item -LiteralPath $file).Length
        $matches=@($taskAssets | Where-Object name -CEQ $name)
        if($matches.Count -gt 1){throw 'Duplicate asset name'}
        if($matches.Count -eq 1){
            if($matches[0].state -ne 'uploaded' -or $matches[0].digest -ne "sha256:$hash" -or $matches[0].size -ne $size){throw 'Existing immutable asset differs; inspect outcome'}
            return $matches[0]
        }
        $asset=Invoke-RestMethod -Method Post -Uri ("https://uploads.github.com/repos/xiaoxuhui/game-hub/releases/407394942/assets?name="+[Uri]::EscapeDataString($name)) -Headers $taskHeaders -ContentType 'application/octet-stream' -InFile $file
        if($asset.state -ne 'uploaded' -or $asset.digest -ne "sha256:$hash" -or $asset.size -ne $size){throw 'Upload outcome unverified; inspect before retry'}
        return $asset
    }
    $publicationMutationStarted=$true
    if(-not $ResumeAfterUploads){
        $games=$taskUploadGames
        $uploads=@()
        foreach($game in $games){
            $name="game-$($game.id)-$($game.contentCode)-$($game.archiveSha256.Substring(0,12)).zip"
            $uploads+=Upload-Asset (Join-Path "$taskCheckout\.build\dynamic-candidate" $name) $name
        }
        ConvertTo-Json -InputObject @($uploads) -Depth 10 | Set-Content -LiteralPath (Join-Path $taskDirectory 'uploaded-resources.json') -Encoding utf8
    }
    node scripts/resource-successor.mjs payload $taskDirectory $ExpectedPreviousSha $NextSequence @taskSelectionArgs
    if($LASTEXITCODE -ne 0){throw 'Fresh complete asset-bound payload failed'}
    $taskEncrypted=[IO.File]::ReadAllBytes('D:\aiden\game-hub-resource-signing\resource-private-key.dpapi')
    $taskDer=[Security.Cryptography.ProtectedData]::Unprotect($taskEncrypted,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $taskPem="-----BEGIN PRIVATE KEY-----`n"+[Convert]::ToBase64String($taskDer,[Base64FormattingOptions]::InsertLineBreaks)+"`n-----END PRIVATE KEY-----`n"
    $signed=Join-Path $taskDirectory 'catalog.signed.json'
    $taskPem | node scripts/dynamic-catalog.mjs sign (Join-Path $taskDirectory 'payload.json') - resources-20261008 $signed (Join-Path $taskDirectory 'signing-snapshot.json') (Join-Path $taskDirectory 'previous.signed.json') (Join-Path $taskDirectory 'expanded-signing.signed.json')
    if($LASTEXITCODE -ne 0){throw 'History-aware signing failed; old catalog remains current'}
    node scripts/dynamic-catalog.mjs verify $signed android/app/src/main/res/raw/resource_public_key.der resources-20261008
    if($LASTEXITCODE -ne 0){throw 'Production public verification failed'}
    Assert-FixedTags
    # Guard against an expanded-channel change after the last signed snapshot.
    $expandedGuard=Get-Content -LiteralPath (Join-Path $taskDirectory 'expanded-signing-guard.json') -Raw | ConvertFrom-Json
    if($expandedGuard.assetId -le 0 -or $expandedGuard.expandedSha256 -notmatch '^[0-9a-f]{64}$'){throw 'Missing expanded signing guard'}
    $expandedCurrent=Invoke-RestMethod -Uri "$taskApi/releases/assets/$($expandedGuard.assetId)" -Headers $taskHeaders
    if($expandedCurrent.name -cne 'catalog-expanded.signed.json' -or $expandedCurrent.digest -cne "sha256:$($expandedGuard.expandedSha256)" -or $expandedCurrent.state -cne 'uploaded'){throw 'Expanded channel moved before legacy activation; inspect'}
    $current=Invoke-RestMethod -Uri "$taskApi/releases/assets/$taskOldId" -Headers $taskHeaders
    if($current.name -cne 'catalog.signed.json' -or $current.digest -ne "sha256:$ExpectedPreviousSha" -or $current.state -ne 'uploaded'){throw 'Old current asset moved before activation; inspect'}
    $oldPayload=Get-Content -LiteralPath (Join-Path $taskDirectory 'payload.json') -Raw | ConvertFrom-Json
    $oldSequence=([System.Numerics.BigInteger]::Parse($oldPayload.catalogSequence)-[System.Numerics.BigInteger]::One).ToString()
    $historyName="catalog-seq$oldSequence-$($ExpectedPreviousSha.Substring(0,12)).signed.json"
    if(@($taskAssets | Where-Object name -CEQ $historyName).Count){throw 'History name already present; inspect previous issuance'}
    @{oldCatalogAssetId=$taskOldId;oldSha256=$ExpectedPreviousSha;historyName=$historyName;newSha256=(Get-FileHash $signed -Algorithm SHA256).Hash.ToLowerInvariant()} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskDirectory 'activation-intent.json') -Encoding utf8
    $renamed=Invoke-RestMethod -Method Patch -Uri "$taskApi/releases/assets/$taskOldId" -Headers $taskHeaders -ContentType 'application/json' -Body (@{name=$historyName}|ConvertTo-Json -Compress)
    if($renamed.name -cne $historyName -or $renamed.digest -ne "sha256:$ExpectedPreviousSha"){throw 'History rename outcome unknown; inspect, never delete or re-sign'}
    $taskAssets=@($taskAssets | Where-Object id -NE $taskOldId)
    $catalog=Upload-Asset $signed 'catalog.signed.json'
    @{releaseId=407394942;sequence=$NextSequence;catalogAssetId=$catalog.id;catalogDigest=$catalog.digest;historyAssetId=$taskOldId;historyName=$historyName} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskDirectory 'published.json') -Encoding utf8
    node scripts/resource-successor.mjs online $taskDirectory $ExpectedPreviousSha $NextSequence @taskSelectionArgs
    if($LASTEXITCODE -ne 0){throw 'Publication completed but anonymous final verification failed; inspect outcome'}
    $publicationVerified=$true
} finally {
    if($taskDer){[Array]::Clear($taskDer,0,$taskDer.Length)}
    $taskPem=$null;$taskDer=$null;$taskEncrypted=$null;$taskCredentialLines=$null;$taskCredential=$null
    $taskHeaders.Remove('Authorization');Pop-Location
}

} finally {
    Complete-ResourcePublicationLock $publicationLock $publicationMutationStarted $publicationVerified
}
