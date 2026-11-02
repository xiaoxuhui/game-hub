param(
    [Parameter(Mandatory=$true)][string]$Commit,
    [Parameter(Mandatory=$true)][string]$ExpectedLegacySha,
    [Parameter(Mandatory=$true)][string]$ExpectedExpandedSha,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [switch]$Resume
)
$ErrorActionPreference='Stop'
$checkout='D:\aiden\game-hub-expanded-publisher-20261101'
$evidenceRoot='D:\aiden\game-hub-expanded-evidence-20261101'
if($Commit -notmatch '^[0-9a-f]{40}$' -or $ExpectedLegacySha -notmatch '^[0-9a-f]{64}$' -or $ExpectedExpandedSha -notmatch '^[0-9a-f]{64}$'){throw 'Exact commit and channel digests required'}
$dir=[IO.Path]::GetFullPath($EvidenceDirectory)
if(-not $dir.StartsWith($evidenceRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Task evidence subdirectory required'}
if($Resume){
    foreach($name in @('expanded-plan.json','legacy.signed.json','previous-expanded.signed.json','expanded-signing-snapshot.json','expanded.signed.json','expanded-activation-intent.json')){if(-not(Test-Path -LiteralPath (Join-Path $dir $name) -PathType Leaf)){throw 'Exact signed recovery evidence required'}}
    if(Test-Path -LiteralPath (Join-Path $dir 'expanded-online-verified.json')){throw 'Already verified; no resume required'}
}elseif(Test-Path -LiteralPath $dir){throw 'Fresh evidence subdirectory required'}
if((git -C $checkout rev-parse HEAD).Trim() -ne $Commit -or (git -C $checkout status --porcelain=v1 --untracked-files=all)){throw 'Clean exact independent producer required'}
if((git -C $checkout remote get-url origin).Trim() -ne 'https://github.com/xiaoxuhui/game-hub.git'){throw 'Producer remote mismatch'}
$env:GIT_TERMINAL_PROMPT='0'
if($Resume){
    git -C $checkout fetch --no-tags origin main
    if($LASTEXITCODE -ne 0){throw 'Cannot fetch current main for recovery'}
    $fetched=(git -C $checkout rev-parse FETCH_HEAD).Trim()
}
$main=@(git -C $checkout ls-remote origin refs/heads/main)
if($LASTEXITCODE -ne 0 -or $main.Count -ne 1){throw 'Cannot verify remote main'}
$mainTip=($main[0] -split '\s+')[0]
if($Resume -and $mainTip -cne $fetched){throw 'Remote main moved during recovery audit'}
. (Join-Path $PSScriptRoot 'resource-publication-main.ps1')
Assert-ResourcePublicationMain ([bool]$Resume) $Commit $mainTip $checkout
foreach($tag in @('v0.4.0','game-resources-v2')){$refs=@(git -C $checkout ls-remote origin "refs/tags/$tag^{}");if($LASTEXITCODE -ne 0 -or $refs.Count -ne 1 -or ($refs[0] -split '\s+')[0] -ne '4aacb1f81b7fc381d2ca7fd725fd93dd109e390e'){throw 'Existing tag moved'}}
. (Join-Path $PSScriptRoot 'resource-publication-lock.ps1')
$lock=Enter-ResourcePublicationLock
$mutationStarted=[bool]$Resume;$verified=$false;$headers=@{Accept='application/vnd.github+json';'User-Agent'='game-hub-expanded-successor';'X-GitHub-Api-Version'='2022-11-28'};$credential=$null;$credentialLines=$null;$der=$null;$pem=$null
try{
    if(-not $Resume){New-Item -ItemType Directory -Path $dir | Out-Null}
    Push-Location -LiteralPath $checkout
    try{
        if(-not $Resume){
            node scripts/expanded-successor.mjs preflight $dir $ExpectedLegacySha $ExpectedExpandedSha
            if($LASTEXITCODE -ne 0){throw 'Expanded anonymous preflight failed before credentials'}
            $plan=Get-Content -LiteralPath (Join-Path $dir 'expanded-plan.json') -Raw | ConvertFrom-Json
            $games=@(Get-Content -LiteralPath '.build\dynamic-candidate\games.unsigned.json' -Raw | ConvertFrom-Json)
            if($plan.producerCommit -cne $Commit -or $plan.legacySha -cne $ExpectedLegacySha -or $plan.expandedSha -cne $ExpectedExpandedSha -or @($plan.games).Count -ne $games.Count){throw 'Candidate plan does not match exact production identity'}
            foreach($game in $games){$match=@($plan.games | Where-Object id -CEQ $game.id);$name="game-$($game.id)-$($game.contentCode)-$($game.archiveSha256.Substring(0,12)).zip";if($match.Count -ne 1 -or $match[0].assetName -cne $name -or $match[0].archiveSha256 -cne $game.archiveSha256 -or $match[0].archiveBytes -ne $game.archiveBytes){throw 'Candidate plan changed'}}
        }
        if($Resume){$plan=Get-Content -LiteralPath (Join-Path $dir 'expanded-plan.json') -Raw | ConvertFrom-Json;if($plan.producerCommit -cne $Commit -or $plan.legacySha -cne $ExpectedLegacySha -or $plan.expandedSha -cne $ExpectedExpandedSha){throw 'Recovery plan does not match exact producer and channel digests'}}
        $env:GIT_TERMINAL_PROMPT='0';$credentialLines=@("protocol=https`nhost=github.com`n`n" | git -c credential.helper= -c credential.helper=wincred credential fill)
        if($LASTEXITCODE -ne 0){throw 'GitHub credential unavailable'}
        $credential=@{};foreach($line in $credentialLines){$pair=$line -split '=',2;if($pair.Length -eq 2){$credential[$pair[0]]=$pair[1]}}
        if(-not $credential.password){throw 'GitHub credential unavailable'};$headers.Authorization='Bearer '+$credential.password
        if(-not $Resume){
            $snapshot=Get-Content -LiteralPath (Join-Path $dir 'expanded-preflight-snapshot.json') -Raw | ConvertFrom-Json;$assets=@($snapshot.assetPages | ForEach-Object {$_.assets});$uploads=@()
            foreach($game in $games){
                $name="game-$($game.id)-$($game.contentCode)-$($game.archiveSha256.Substring(0,12)).zip";$file=Join-Path $checkout ".build\dynamic-candidate\$name";$hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant();$size=(Get-Item -LiteralPath $file).Length
                if($hash -cne $game.archiveSha256 -or $size -ne $game.archiveBytes){throw 'Candidate ZIP changed after preflight'}
                $matches=@($assets | Where-Object name -CEQ $name);if($matches.Count -gt 1){throw 'Duplicate asset name'}
                if($matches.Count -eq 1){if($matches[0].state -cne 'uploaded' -or $matches[0].digest -cne "sha256:$hash" -or $matches[0].size -ne $size){throw 'Existing ZIP identity differs'};$uploads+=$matches[0];continue}
                $mutationStarted=$true;$asset=Invoke-RestMethod -Method Post -Uri ("https://uploads.github.com/repos/xiaoxuhui/game-hub/releases/407394942/assets?name="+[Uri]::EscapeDataString($name)) -Headers $headers -ContentType 'application/octet-stream' -InFile $file
                if($asset.name -cne $name -or $asset.state -cne 'uploaded' -or $asset.digest -cne "sha256:$hash" -or $asset.size -ne $size){throw 'ZIP upload outcome uncertain; inspect before retry'};$uploads+=$asset
            }
            ConvertTo-Json -InputObject @($uploads) -Depth 10 | Set-Content -LiteralPath (Join-Path $dir 'expanded-uploaded-resources.json') -Encoding utf8
            node scripts/expanded-successor.mjs payload $dir $ExpectedLegacySha $ExpectedExpandedSha
            if($LASTEXITCODE -ne 0){throw 'Fresh asset-bound expanded payload failed'}
            $encrypted=[IO.File]::ReadAllBytes('D:\aiden\game-hub-resource-signing\resource-private-key.dpapi');$der=[Security.Cryptography.ProtectedData]::Unprotect($encrypted,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
            $pem="-----BEGIN PRIVATE KEY-----`n"+[Convert]::ToBase64String($der,[Base64FormattingOptions]::InsertLineBreaks)+"`n-----END PRIVATE KEY-----`n"
            $pem | node scripts/expanded-signer.mjs sign (Join-Path $dir 'expanded-payload.json') - (Join-Path $dir 'expanded.signed.json') (Join-Path $dir 'expanded-signing-snapshot.json') (Join-Path $dir 'legacy.signed.json') (Join-Path $dir 'previous-expanded.signed.json')
            if($LASTEXITCODE -ne 0){throw 'Expanded signing failed; current catalog unchanged'}
            node scripts/expanded-activation-intent.mjs $dir
            if($LASTEXITCODE -ne 0){throw 'Expanded signed intent validation failed'}
        }
        function Read-ActivationState {
            $name='activation-check-'+[Guid]::NewGuid().ToString('N')+'.json'
            $checkOutput=@(node scripts/expanded-activation-check.mjs $dir $name)
            if($LASTEXITCODE -ne 0){throw 'Expanded activation state unknown; inspect without retrying blindly'}
            return Get-Content -LiteralPath (Join-Path $dir $name) -Raw | ConvertFrom-Json
        }
        $intent=Get-Content -LiteralPath (Join-Path $dir 'expanded-activation-intent.json') -Raw | ConvertFrom-Json
        if($intent.legacySha -cne $ExpectedLegacySha -or $intent.previousSha -cne $ExpectedExpandedSha){throw 'Recovery evidence does not match explicit channel digests'}
        $state=Read-ActivationState
        if($state.phase -eq 'prepared'){
            $mutationStarted=$true;$renamed=Invoke-RestMethod -Method Patch -Uri "https://api.github.com/repos/xiaoxuhui/game-hub/releases/assets/$($intent.previousId)" -Headers $headers -ContentType 'application/json' -Body (@{name=$intent.historyName}|ConvertTo-Json -Compress)
            if($renamed.id -ne $intent.previousId -or $renamed.name -cne $intent.historyName -or $renamed.digest -cne "sha256:$ExpectedExpandedSha"){throw 'Expanded history rename uncertain; inspect'}
            $state=Read-ActivationState
        }
        if($state.phase -eq 'renamed'){
            $file=Join-Path $dir 'expanded.signed.json';$hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant();$size=(Get-Item -LiteralPath $file).Length
            if($hash -cne $intent.newSha -or $size -ne $intent.newSize){throw 'Exact signed recovery bytes changed'}
            $mutationStarted=$true;$upload=Invoke-RestMethod -Method Post -Uri 'https://uploads.github.com/repos/xiaoxuhui/game-hub/releases/407394942/assets?name=catalog-expanded.signed.json' -Headers $headers -ContentType 'application/octet-stream' -InFile $file
            if($upload.name -cne 'catalog-expanded.signed.json' -or $upload.digest -cne "sha256:$hash" -or $upload.size -ne $size -or $upload.state -cne 'uploaded'){throw 'Expanded catalog upload uncertain; inspect'}
            $state=Read-ActivationState
        }
        if($state.phase -ne 'published'){throw 'Expanded activation incomplete; inspect'}
        node scripts/expanded-successor.mjs online $dir $ExpectedLegacySha $ExpectedExpandedSha
        if($LASTEXITCODE -ne 0){throw 'Expanded catalog published but online verification failed; inspect'}
        $verified=$true;Write-Output "Expanded catalog online verification completed; asset $($state.assetId)"
    }finally{Pop-Location}
}finally{
    if($der){[Array]::Clear($der,0,$der.Length)};$pem=$null;$credentialLines=$null;$credential=$null;$headers.Remove('Authorization')
    Complete-ResourcePublicationLock $lock $mutationStarted $verified
}
