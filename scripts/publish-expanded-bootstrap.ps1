param(
    [Parameter(Mandatory=$true)][string]$Commit,
    [Parameter(Mandatory=$true)][string]$ExpectedLegacySha,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory
)
$ErrorActionPreference='Stop'
$taskCheckout='D:\aiden\game-hub-expanded-publisher-20261101'
$evidenceRoot='D:\aiden\game-hub-expanded-evidence-20261101'
if($Commit -notmatch '^[0-9a-f]{40}$' -or $ExpectedLegacySha -notmatch '^[0-9a-f]{64}$'){throw 'Exact commit and legacy digest required'}
$dir=[IO.Path]::GetFullPath($EvidenceDirectory)
if(-not $dir.StartsWith($evidenceRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $dir)){throw 'Fresh task evidence subdirectory required'}
if((git -C $taskCheckout rev-parse HEAD).Trim() -ne $Commit -or (git -C $taskCheckout status --porcelain=v1 --untracked-files=all)){throw 'Clean exact independent producer required'}
if((git -C $taskCheckout remote get-url origin).Trim() -ne 'https://github.com/xiaoxuhui/game-hub.git'){throw 'Producer remote mismatch'}
$main=@(git -C $taskCheckout ls-remote origin refs/heads/main)
if($LASTEXITCODE -ne 0 -or $main.Count -ne 1 -or ($main[0] -split '\s+')[0] -ne $Commit){throw 'Exact pushed main required'}
foreach($tag in @('v0.4.0','game-resources-v2')){
    $refs=@(git -C $taskCheckout ls-remote origin "refs/tags/$tag^{}")
    if($LASTEXITCODE -ne 0 -or $refs.Count -ne 1 -or ($refs[0] -split '\s+')[0] -ne '4aacb1f81b7fc381d2ca7fd725fd93dd109e390e'){throw 'Existing tag moved; no write permitted'}
}
. (Join-Path $PSScriptRoot 'resource-publication-lock.ps1')
$publicationLock=Enter-ResourcePublicationLock
$publicationMutationStarted=$false;$publicationVerified=$false
try {
New-Item -ItemType Directory -Path $dir | Out-Null
$first=Join-Path $dir 'preflight';$second=Join-Path $dir 'before-upload';$online=Join-Path $dir 'online'
New-Item -ItemType Directory -Path $first,$second,$online | Out-Null
$credentialLines=$null;$credential=$null;$headers=@{Accept='application/vnd.github+json';'User-Agent'='game-hub-expanded-bootstrap';'X-GitHub-Api-Version'='2022-11-28'}
Push-Location -LiteralPath $taskCheckout
try{
    node scripts/expanded-bootstrap-check.mjs preflight $first $ExpectedLegacySha
    if($LASTEXITCODE -ne 0){throw 'Anonymous preflight failed before credentials'}
    node scripts/expanded-bootstrap-check.mjs preflight $second $ExpectedLegacySha
    if($LASTEXITCODE -ne 0){throw 'Fresh pre-upload snapshot failed before credentials'}
    $a=Get-Content -LiteralPath (Join-Path $first 'bootstrap-preflight-result.json') -Raw | ConvertFrom-Json
    $b=Get-Content -LiteralPath (Join-Path $second 'bootstrap-preflight-result.json') -Raw | ConvertFrom-Json
    if($a.legacyId -ne $b.legacyId -or $a.catalogSha256 -cne $b.catalogSha256 -or $a.sequence -cne $b.sequence -or $a.payloadSha256 -cne $b.payloadSha256){throw 'Legacy current changed between preflights'}
    $env:GIT_TERMINAL_PROMPT='0'
    $credentialLines=@("protocol=https`nhost=github.com`n`n" | git -c credential.helper= -c credential.helper=wincred credential fill)
    if($LASTEXITCODE -ne 0){throw 'GitHub credential unavailable'}
    $credential=@{};foreach($line in $credentialLines){$pair=$line -split '=',2;if($pair.Length -eq 2){$credential[$pair[0]]=$pair[1]}}
    if(-not $credential.password){throw 'GitHub credential unavailable'}
    $headers.Authorization='Bearer '+$credential.password
    $legacy=Invoke-RestMethod -Uri "https://api.github.com/repos/xiaoxuhui/game-hub/releases/assets/$($b.legacyId)" -Headers $headers
    if($legacy.name -cne 'catalog.signed.json' -or $legacy.digest -cne "sha256:$ExpectedLegacySha" -or $legacy.state -cne 'uploaded'){throw 'Legacy current moved before upload'}
    $file=Join-Path $second 'legacy-for-expanded.signed.json';$size=(Get-Item -LiteralPath $file).Length
    $record=@{legacyAssetId=$b.legacyId;legacySha256=$ExpectedLegacySha;sequence=$b.sequence;expandedName='catalog-expanded.signed.json';bytes=$size;producerCommit=$Commit}
    $record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dir 'bootstrap-intent.json') -Encoding utf8
    $publicationMutationStarted=$true
    $upload=Invoke-RestMethod -Method Post -Uri 'https://uploads.github.com/repos/xiaoxuhui/game-hub/releases/407394942/assets?name=catalog-expanded.signed.json' -Headers $headers -ContentType 'application/octet-stream' -InFile $file
    if($upload.name -cne 'catalog-expanded.signed.json' -or $upload.state -cne 'uploaded' -or $upload.size -ne $size -or $upload.digest -cne "sha256:$ExpectedLegacySha"){throw 'Upload outcome uncertain; inspect before retry'}
    @{assetId=$upload.id;sha256=$ExpectedLegacySha;size=$size;sequence=$b.sequence} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dir 'bootstrap-published.json') -Encoding utf8
    node scripts/expanded-bootstrap-check.mjs online $online $ExpectedLegacySha
    if($LASTEXITCODE -ne 0){throw 'Uploaded asset exists but anonymous verification failed; inspect before any retry'}
    $verified=Get-Content -LiteralPath (Join-Path $online 'bootstrap-online-result.json') -Raw | ConvertFrom-Json
    if($verified.expandedId -ne $upload.id -or $verified.legacyId -ne $b.legacyId -or $verified.catalogSha256 -cne $ExpectedLegacySha){throw 'Online identities changed; inspect'}
    $publicationVerified=$true
    Write-Output "Expanded bootstrap online verified: sequence $($b.sequence), asset $($upload.id)"
}finally{
    $credentialLines=$null;$credential=$null;$headers.Remove('Authorization');Pop-Location
}

} finally {
    Complete-ResourcePublicationLock $publicationLock $publicationMutationStarted $publicationVerified
}
