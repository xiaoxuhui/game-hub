param([ValidateSet('Resources','Apk')][string]$Mode,[Parameter(Mandatory=$true)][string]$Commit,[string]$Apk,[string]$ExpectedApkSha)
$ErrorActionPreference='Stop'
$taskCheckout='D:\soft\.ci-tmp\game-hub-work\v030-final'
$taskEvidence='D:\soft\.ci-tmp\game-hub-work\v030-evidence\v040-release'
$taskApi='https://api.github.com/repos/xiaoxuhui/game-hub'
$taskHeaders=@{Accept='application/vnd.github+json';'User-Agent'='game-hub-publisher';'X-GitHub-Api-Version'='2022-11-28'}
$taskCredentialLines=$null; $taskCredential=$null; $taskEncrypted=$null; $taskDer=$null; $taskPem=$null
if($Commit -notmatch '^[0-9a-f]{40}$') { throw 'Full immutable commit required' }
if((git -C $taskCheckout rev-parse HEAD).Trim() -ne $Commit) { throw 'Publisher checkout commit mismatch' }
if(git -C $taskCheckout status --porcelain=v1 --untracked-files=all) { throw 'Publisher checkout must be clean' }
if((git -C $taskCheckout remote get-url origin).Trim() -ne 'https://github.com/xiaoxuhui/game-hub.git') { throw 'Wrong publisher remote' }
$taskRemote=@(git -C $taskCheckout ls-remote origin refs/heads/main)
if($LASTEXITCODE -ne 0 -or $taskRemote.Count -ne 1 -or ($taskRemote[0] -split '\s+')[0] -ne $Commit) { throw 'Commit does not match pushed main' }
function Assert-Tag([string]$tag,[bool]$required=$false) {
    $refs=@(git -C $taskCheckout ls-remote origin "refs/tags/$tag" "refs/tags/$tag^{}")
    if($LASTEXITCODE -ne 0) { throw 'Tag lookup failed' }
    if(-not $refs.Count) { if($required) { throw 'Expected published tag missing' }; return }
    $peeled=@($refs | Where-Object { $_ -match '\^\{\}$' })
    $target=if($peeled.Count) {($peeled[0] -split '\s+')[0]}else{($refs[0] -split '\s+')[0]}
    if($target -ne $Commit) { throw 'Existing release tag points to another commit; preserving it' }
}
if($Mode -eq 'Apk') {
    if(-not $Apk -or -not (Test-Path -LiteralPath $Apk)) { throw 'Final APK required' }
    if([IO.Path]::GetFullPath($Apk) -ne (Join-Path $taskEvidence 'game-hub.apk') -or $ExpectedApkSha -notmatch '^[0-9a-f]{64}$' -or (Get-FileHash -LiteralPath $Apk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedApkSha) { throw 'APK differs from reviewed final path/hash' }
    Push-Location -LiteralPath $taskCheckout
    try { & 'C:\Users\25133\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/verify_apk.py $Apk $Commit; if($LASTEXITCODE -ne 0) { throw 'APK source binding failed' } } finally { Pop-Location }
    $env:JAVA_HOME='D:\soft\.ci-tmp\game-hub-signing-tools\jdk-17.0.20.1+1'
    $taskTools='D:\soft\.ci-tmp\game-hub-signing-tools\android-sdk\build-tools\34.0.0'
    $taskSignature=@(& "$taskTools\apksigner.bat" verify --print-certs $Apk)
    if($LASTEXITCODE -ne 0 -or -not ($taskSignature -match '^Signer #1 certificate SHA-256 digest: 44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2$')) { throw 'Unexpected final APK signer' }
    $taskBadging=@(& "$taskTools\aapt.exe" dump badging $Apk)
    if($LASTEXITCODE -ne 0 -or -not ($taskBadging -match "^package: name='com\.xiaoxuhui\.gamehub' versionCode='4' versionName='0\.4\.0'")) { throw 'Unexpected APK identity/version' }
}
try {
    $taskCredentialLines=@("protocol=https`nhost=github.com`n`n" | git credential fill)
    if ($LASTEXITCODE -ne 0) { throw 'GitHub credential unavailable' }
    $taskCredential=@{}
    foreach($line in $taskCredentialLines) { $pair=$line -split '=',2; if($pair.Length -eq 2) {$taskCredential[$pair[0]]=$pair[1]} }
    if (-not $taskCredential.password) { throw 'GitHub credential unavailable' }
    $taskHeaders.Authorization='Bearer '+$taskCredential.password
    function Get-Release([string]$tag) {
        try { Invoke-RestMethod -Uri "$taskApi/releases/tags/$tag" -Headers $taskHeaders }
        catch { if ([int]$_.Exception.Response.StatusCode -eq 404) { return $null }; throw }
    }
    function New-Release([string]$tag,[bool]$draft,[bool]$pre,[string]$body) {
        $payload=@{tag_name=$tag;target_commitish=$Commit;name=$tag;body=$body;draft=$draft;prerelease=$pre;make_latest= $(if($pre){'false'}else{'true'})} | ConvertTo-Json
        Invoke-RestMethod -Method Post -Uri "$taskApi/releases" -Headers $taskHeaders -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload))
    }
    function Add-Asset($release,[string]$file,[string]$name) {
        $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant(); $size=(Get-Item -LiteralPath $file).Length
        $matches=@($release.assets | Where-Object name -eq $name)
        if($matches.Count -gt 1) { throw 'Duplicate release asset' }
        if($matches.Count -eq 1) { if($matches[0].digest -ne "sha256:$hash" -or $matches[0].size -ne $size) { throw 'Existing release asset differs; preserving it' }; return $matches[0] }
        $asset=Invoke-RestMethod -Method Post -Uri ("https://uploads.github.com/repos/xiaoxuhui/game-hub/releases/$($release.id)/assets?name="+[Uri]::EscapeDataString($name)) -Headers $taskHeaders -ContentType 'application/octet-stream' -InFile $file
        if($asset.state -ne 'uploaded' -or $asset.digest -ne "sha256:$hash" -or $asset.size -ne $size) { throw 'Uploaded asset hash or size mismatch' }
        return $asset
    }
    if($Mode -eq 'Resources') {
        node "$taskCheckout\scripts\dynamic-resources.mjs" --verify
        if($LASTEXITCODE -ne 0) { throw 'Resource candidate exact file set, source, size or hash verification failed' }
        Assert-Tag 'game-resources-v2'
        $release=Get-Release 'game-resources-v2'
        if(-not $release) { $release=New-Release 'game-resources-v2' $false $true '动态游戏签名资源通道 v2。资源预发布与正式大厅 APK 的 latest 通道分离。新游戏首次安装需用户主动选择；已安装资源遵守更新设置。首份目录提供自有配对示范，完整来源 SHA、许可、存档合同与资源身份已审核。' }
        if($release.draft -ne $false -or $release.prerelease -ne $true) { throw 'Wrong resource release flags' }
        Assert-Tag 'game-resources-v2' $true
        foreach($zip in Get-ChildItem -LiteralPath "$taskCheckout\.build\dynamic-candidate" -Filter '*.zip') { $null=Add-Asset $release $zip.FullName $zip.Name }
        $snapshot=Join-Path $taskEvidence 'resource-release-snapshot.json'
        if(Test-Path -LiteralPath $snapshot) { throw 'Resource signing snapshot already exists; inspect previous outcome' }
        node "$taskCheckout\scripts\dynamic-catalog.mjs" capture $snapshot
        if($LASTEXITCODE -ne 0) { throw 'Public resource snapshot failed' }
        $games=Get-Content -LiteralPath "$taskCheckout\.build\dynamic-candidate\games.unsigned.json" -Raw | ConvertFrom-Json
        $current=Get-Content -LiteralPath $snapshot -Raw | ConvertFrom-Json
        $assets=@($current.assetPages | ForEach-Object { $_.assets })
        foreach($game in $games) { $name="game-$($game.id)-$($game.contentCode)-$($game.archiveSha256.Substring(0,12)).zip"; $asset=@($assets | Where-Object name -eq $name); if($asset.Count -ne 1) { throw 'Resource asset missing' }; $game | Add-Member -NotePropertyName assetId -NotePropertyValue ([long]$asset[0].id) }
        $issued=[DateTime]::UtcNow
        $payload=@{schemaVersion=2;channel='game-hub-resources-v2';releaseId=[long]$release.id;catalogSequence='1';issuedAt=$issued.ToString('yyyy-MM-ddTHH:mm:ss.fffZ');expiresAt=$issued.AddDays(89).ToString('yyyy-MM-ddTHH:mm:ss.fffZ');games=@($games)}
        $payloadPath=Join-Path $taskEvidence 'resource-catalog-payload.json'
        [IO.File]::WriteAllText($payloadPath,($payload | ConvertTo-Json -Depth 15 -Compress),[Text.UTF8Encoding]::new($false))
        $signed=Join-Path $taskEvidence 'catalog.signed.json'
        $taskEncrypted=[IO.File]::ReadAllBytes('D:\aiden\game-hub-resource-signing\resource-private-key.dpapi')
        $taskDer=[Security.Cryptography.ProtectedData]::Unprotect($taskEncrypted,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
        $taskPem="-----BEGIN PRIVATE KEY-----`n"+[Convert]::ToBase64String($taskDer,[Base64FormattingOptions]::InsertLineBreaks)+"`n-----END PRIVATE KEY-----`n"
        $taskPem | node "$taskCheckout\scripts\dynamic-catalog.mjs" sign $payloadPath - resources-20261008 $signed $snapshot
        if($LASTEXITCODE -ne 0) { throw 'Resource signing failed' }
        node "$taskCheckout\scripts\dynamic-catalog.mjs" verify $signed "$taskCheckout\android\app\src\main\res\raw\resource_public_key.der" resources-20261008
        if($LASTEXITCODE -ne 0) { throw 'Resource public verification failed' }
        $release=Get-Release 'game-resources-v2'
        $asset=Add-Asset $release $signed 'catalog.signed.json'
        [pscustomobject]@{releaseId=$release.id;url=$release.html_url;catalogAssetId=$asset.id;catalogDigest=$asset.digest} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskEvidence 'resource-published.json') -Encoding utf8
        Write-Output "Published resource channel $($release.html_url)"
    } else {
        if(-not $Apk -or -not (Test-Path -LiteralPath $Apk)) { throw 'Final APK required' }
        Assert-Tag 'v0.4.0'
        $release=Get-Release 'v0.4.0'
        $body="动态新增游戏与子游戏局部更新。游戏目录提供主动安装，安装后加入首页；兼容游戏更新无需下载整个大厅 APK。已安装游戏按设置自动更新，移除资源保留存档且不会自动重新安装。四旧游戏保留原 origin/桥和存档；新游戏使用独立 origin 与统一文件桥。`n`n源码：$Commit。game-resources-v1、game-resources-v2 均为资源预发布，latest 仅指正式 APK。首个 v2 游戏是自有配对示范，不内置于 APK。`n`n同发行证书覆盖 v0.3.0；模拟器四游戏五页存档与动态目录/文件桥/取消/恢复/大字体横屏已按记录验证。TalkBack 真机、厂商设备由用户发布后验收。APK/资源密钥异机备份恢复尚未验证，用户授权先发行，维护待办保留。`n`nSHA-256：$((Get-FileHash -LiteralPath $Apk -Algorithm SHA256).Hash.ToLowerInvariant())"
        if(-not $release) { $release=New-Release 'v0.4.0' $true $false $body }
        if($release.prerelease) { throw 'Formal APK release must not be prerelease' }
        Assert-Tag 'v0.4.0' $true
        if(-not $release.draft) {
            $existing=@($release.assets | Where-Object name -eq 'game-hub.apk')
            if($release.tag_name -cne 'v0.4.0' -or $release.name -cne 'v0.4.0' -or $release.body -cne $body -or @($release.assets).Count -ne 1 -or $existing.Count -ne 1 -or $existing[0].digest -ne "sha256:$ExpectedApkSha" -or $existing[0].size -ne (Get-Item -LiteralPath $Apk).Length) { throw 'Existing public release metadata or assets differ; preserving it' }
        }
        $asset=Add-Asset $release $Apk 'game-hub.apk'
        if($release.draft) { $release=Invoke-RestMethod -Method Patch -Uri "$taskApi/releases/$($release.id)" -Headers $taskHeaders -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes((@{draft=$false;prerelease=$false;make_latest='true';body=$body}|ConvertTo-Json))) }
        [pscustomobject]@{releaseId=$release.id;url=$release.html_url;assetId=$asset.id;digest=$asset.digest;commit=$Commit} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskEvidence 'apk-published.json') -Encoding utf8
        Write-Output "Published formal APK $($release.html_url)"
    }
} finally {
    $taskHeaders.Remove('Authorization')
    if($taskCredential) { $taskCredential.Clear() }
    $taskCredentialLines=$null; $taskCredential=$null; $taskPem=$null
    if($taskDer) { [Array]::Clear($taskDer,0,$taskDer.Length) }
    if($taskEncrypted) { [Array]::Clear($taskEncrypted,0,$taskEncrypted.Length) }
}
