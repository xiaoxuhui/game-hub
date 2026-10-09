param(
    [Parameter(Mandatory=$true)][string]$Commit,
    [Parameter(Mandatory=$true)][string]$ExpectedPreviousSha,
    [Parameter(Mandatory=$true)][string]$NextSequence,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [ValidateSet('legacy','n9')][string]$TaskScope='legacy'
)
$ErrorActionPreference='Stop'
$taskCheckout='D:\soft\.ci-tmp\game-hub-work\v030-final'
$taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-work\v030-evidence\v040-resource-update'
if($TaskScope -ieq 'n9'){
    $taskCheckout='D:\soft\.ci-tmp\game-hub-n9\work'
    $taskEvidenceRoot='D:\soft\.ci-tmp\game-hub-n9\evidence\publication'
}
$taskApi='https://api.github.com/repos/xiaoxuhui/game-hub'
$taskHeaders=@{Accept='application/vnd.github+json';'User-Agent'='game-hub-resource-successor';'X-GitHub-Api-Version'='2022-11-28'}
$taskCredentialLines=$null; $taskCredential=$null; $taskEncrypted=$null; $taskDer=$null; $taskPem=$null
if($Commit -notmatch '^[0-9a-f]{40}$' -or $ExpectedPreviousSha -notmatch '^[0-9a-f]{64}$' -or $NextSequence -notmatch '^[1-9][0-9]{0,18}$'){throw 'Explicit exact commit, previous SHA and sequence required'}
$taskDirectory=[IO.Path]::GetFullPath($EvidenceDirectory)
if(-not $taskDirectory.StartsWith($taskEvidenceRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskDirectory)){throw 'Fresh task evidence subdirectory required; inspect any previous outcome before retry'}
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
New-Item -ItemType Directory -Path $taskDirectory | Out-Null
Push-Location -LiteralPath $taskCheckout
try {
    node scripts/resource-successor.mjs preflight $taskDirectory $ExpectedPreviousSha $NextSequence
    if($LASTEXITCODE -ne 0){throw 'Anonymous history/candidate admission failed before credentials'}
    $taskBefore=Get-Content -LiteralPath (Join-Path $taskDirectory 'before-snapshot.json') -Raw | ConvertFrom-Json
    $taskAssets=@($taskBefore.assetPages | ForEach-Object {$_.assets})
    $taskOld=@($taskAssets | Where-Object name -CEQ 'catalog.signed.json')
    if($taskOld.Count -ne 1){throw 'Current catalog identity missing'}
    $taskOldId=[long]$taskOld[0].id
    $taskCredentialLines=@("protocol=https`nhost=github.com`n`n" | git credential fill)
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
    $games=Get-Content -LiteralPath '.build\dynamic-candidate\games.unsigned.json' -Raw | ConvertFrom-Json
    $uploads=@()
    foreach($game in $games){
        $name="game-$($game.id)-$($game.contentCode)-$($game.archiveSha256.Substring(0,12)).zip"
        $uploads+=Upload-Asset (Join-Path "$taskCheckout\.build\dynamic-candidate" $name) $name
    }
    $uploads | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $taskDirectory 'uploaded-resources.json') -Encoding utf8
    node scripts/resource-successor.mjs payload $taskDirectory $ExpectedPreviousSha $NextSequence
    if($LASTEXITCODE -ne 0){throw 'Fresh complete asset-bound payload failed'}
    $taskEncrypted=[IO.File]::ReadAllBytes('D:\aiden\game-hub-resource-signing\resource-private-key.dpapi')
    $taskDer=[Security.Cryptography.ProtectedData]::Unprotect($taskEncrypted,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $taskPem="-----BEGIN PRIVATE KEY-----`n"+[Convert]::ToBase64String($taskDer,[Base64FormattingOptions]::InsertLineBreaks)+"`n-----END PRIVATE KEY-----`n"
    $signed=Join-Path $taskDirectory 'catalog.signed.json'
    $taskPem | node scripts/dynamic-catalog.mjs sign (Join-Path $taskDirectory 'payload.json') - resources-20261008 $signed (Join-Path $taskDirectory 'signing-snapshot.json') (Join-Path $taskDirectory 'previous.signed.json')
    if($LASTEXITCODE -ne 0){throw 'History-aware signing failed; old catalog remains current'}
    node scripts/dynamic-catalog.mjs verify $signed android/app/src/main/res/raw/resource_public_key.der resources-20261008
    if($LASTEXITCODE -ne 0){throw 'Production public verification failed'}
    Assert-FixedTags
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
    node scripts/resource-successor.mjs online $taskDirectory $ExpectedPreviousSha $NextSequence
    if($LASTEXITCODE -ne 0){throw 'Publication completed but anonymous final verification failed; inspect outcome'}
} finally {
    if($taskDer){[Array]::Clear($taskDer,0,$taskDer.Length)}
    $taskPem=$null;$taskDer=$null;$taskEncrypted=$null;$taskCredentialLines=$null;$taskCredential=$null
    $taskHeaders.Remove('Authorization');Pop-Location
}
