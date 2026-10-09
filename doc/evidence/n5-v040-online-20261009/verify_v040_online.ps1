param([Parameter(Mandatory=$true)][string]$ExpectedApkSha)
$ErrorActionPreference='Stop'
if($ExpectedApkSha -notmatch '^[0-9a-f]{64}$'){throw 'Expected reviewed APK hash required'}
$taskApi='https://api.github.com/repos/xiaoxuhui/game-hub'
$taskCheckout='D:\soft\.ci-tmp\game-hub-work\v030-final'
$taskEvidence='D:\soft\.ci-tmp\game-hub-work\v030-evidence\v040-release'
$taskOnline=Join-Path $taskEvidence ('anonymous-downloads\'+[Guid]::NewGuid().ToString('N'))
$taskHeaders=@{Accept='application/vnd.github+json';'User-Agent'='game-hub-anonymous-verification';'Cache-Control'='no-cache'}
$formal=Invoke-RestMethod -Uri "$taskApi/releases/latest" -Headers $taskHeaders
$v1=Invoke-RestMethod -Uri "$taskApi/releases/tags/game-resources-v1" -Headers $taskHeaders
$v2=Invoke-RestMethod -Uri "$taskApi/releases/tags/game-resources-v2" -Headers $taskHeaders
if($formal.tag_name -cne 'v0.4.0' -or $formal.draft -or $formal.prerelease -or @($formal.assets).Count -ne 1){throw 'Wrong latest formal release'}
if($v1.draft -or -not $v1.prerelease -or @($v1.assets).Count -ne 5){throw 'Unexpected v1 channel'}
if($v2.draft -or -not $v2.prerelease -or @($v2.assets).Count -ne 2){throw 'Unexpected first v2 channel'}
$results=@()
foreach($item in @(@{release=$formal;directory='apk'},@{release=$v1;directory='v1'},@{release=$v2;directory='v2'})){
    $directory=Join-Path $taskOnline $item.directory;New-Item -ItemType Directory -Path $directory -Force | Out-Null
    foreach($asset in $item.release.assets){
        $name=$asset.name
        $allowed=if($item.directory -eq 'apk'){$name -ceq 'game-hub.apk'}elseif($item.directory -eq 'v1'){$name -match '^(catalog\.signed\.json|game-(conway|eml|light|turing)-1-[0-9a-f]{12}\.zip)$'}else{$name -match '^(catalog\.signed\.json|game-memory-demo-1-27f1df3b689e\.zip)$'}
        if(-not $allowed){throw 'Unexpected anonymous asset name'}
        $path=Join-Path $directory $name
        Invoke-WebRequest -Uri $asset.browser_download_url -Headers @{'User-Agent'='game-hub-anonymous-verification'} -OutFile $path
        $sha=(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant();$size=(Get-Item -LiteralPath $path).Length
        if($asset.state -ne 'uploaded' -or $asset.digest -ne "sha256:$sha" -or $asset.size -ne $size){throw 'Anonymous byte identity mismatch'}
        if($item.directory -eq 'apk'){
            if($sha -ne $ExpectedApkSha -or $sha -ne (Get-FileHash -LiteralPath (Join-Path $taskEvidence 'game-hub.apk')).Hash.ToLowerInvariant()){throw 'Public APK differs from reviewed candidate'}
        } elseif($item.directory -eq 'v2'){
            $local=if($name -ceq 'catalog.signed.json'){Join-Path $taskEvidence $name}else{Join-Path "$taskCheckout\.build\dynamic-candidate" $name}
            if($sha -ne (Get-FileHash -LiteralPath $local).Hash.ToLowerInvariant()){throw 'Public v2 differs from reviewed produced bytes'}
        }
        $results+=[pscustomobject]@{channel=$item.directory;name=$name;assetId=$asset.id;bytes=$size;sha256=$sha;anonymous=$true}
    }
}
$taskPublicKey=Join-Path $taskOnline 'apk-resource-public-key.der'
$taskZip=[IO.Compression.ZipFile]::OpenRead((Join-Path $taskOnline 'apk\game-hub.apk'))
try {
    $taskDerMatches=@()
    foreach($taskResourceEntry in $taskZip.Entries){
        if($taskResourceEntry.FullName -notmatch '^res/.+\.der$'){continue}
        $taskStream=$taskResourceEntry.Open();$taskBuffer=[IO.MemoryStream]::new()
        try{$taskStream.CopyTo($taskBuffer);$taskHasher=[Security.Cryptography.SHA256]::Create();try{$taskDigest=[BitConverter]::ToString($taskHasher.ComputeHash($taskBuffer.ToArray())).Replace('-','').ToLowerInvariant()}finally{$taskHasher.Dispose()}}finally{$taskStream.Dispose();$taskBuffer.Dispose()}
        if($taskDigest -eq '649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673'){$taskDerMatches+=$taskResourceEntry}
    }
    if($taskDerMatches.Count -ne 1){throw 'Exactly one production APK trust root required'}
    $entry=$taskDerMatches[0]
    $input=$entry.Open();$output=[IO.File]::Create($taskPublicKey)
    try {$input.CopyTo($output)}finally{$input.Dispose();$output.Dispose()}
} finally {$taskZip.Dispose()}
if((Get-FileHash -LiteralPath $taskPublicKey).Hash.ToLowerInvariant() -ne '649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673'){throw 'APK public trust root changed'}
node "$taskCheckout\scripts\resource-catalog.mjs" verify (Join-Path $taskOnline 'v1\catalog.signed.json') $taskPublicKey resources-20261008
if($LASTEXITCODE -ne 0){throw 'Anonymous v1 signature failed'}
node "$taskCheckout\scripts\dynamic-catalog.mjs" verify (Join-Path $taskOnline 'v2\catalog.signed.json') $taskPublicKey resources-20261008
if($LASTEXITCODE -ne 0){throw 'Anonymous v2 signature failed'}
node 'D:\soft\.ci-tmp\game-hub-maintenance\verify_v040_release_binding.mjs' $taskCheckout $taskOnline
if($LASTEXITCODE -ne 0){throw 'Anonymous complete release/catalog/asset binding failed'}
[pscustomobject]@{latest=$formal.tag_name;formalReleaseId=$formal.id;v1ReleaseId=$v1.id;v2ReleaseId=$v2.id;assets=$results;productionTrustRootFromDownloadedApk=$true;downloadDirectory=$taskOnline}|ConvertTo-Json -Depth 5|Tee-Object -FilePath (Join-Path $taskEvidence 'anonymous-online-verification.json')
Write-Output 'ANONYMOUS_V040_EIGHT_ASSETS_AND_APK_TRUST_ROOT_VERIFIED'
