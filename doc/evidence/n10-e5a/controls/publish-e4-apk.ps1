param([Parameter(Mandatory=$true)][string]$ReviewedCommit)
$ErrorActionPreference='Stop'
$taskCheckout='D:\soft\.ci-tmp\game-hub-n10\work'
$taskEvidence='D:\soft\.ci-tmp\game-hub-n10\evidence'
$taskSource='fc9da9be6a238018d86f2085facd5b8085e68cf8'
$taskApk=Join-Path $taskEvidence 'game-hub-v0.4.1.apk'
$taskSha='9f57c90af42efea54e4e079d637d964346a78e7e880493eac7887f9aaac323da'
$taskApi='https://api.github.com/repos/xiaoxuhui/game-hub'
$taskReleaseName='游戏大厅 v0.4.1'
$taskHeaders=@{Accept='application/vnd.github+json';'User-Agent'='game-hub-n10-release';'X-GitHub-Api-Version'='2022-11-28'}
$taskCredentialLines=$null;$taskCredential=$null
if($ReviewedCommit -notmatch '^[0-9a-f]{40}$'){throw 'Exact independently reviewed acceptance commit required'}
if((git -C $taskCheckout remote get-url origin).Trim() -ne 'https://github.com/xiaoxuhui/game-hub.git'){throw 'Exact authorized Hall origin required before credentials or release intent'}
if((git -C $taskCheckout rev-parse HEAD).Trim() -ne $ReviewedCommit -or (git -C $taskCheckout status --porcelain=v1 --untracked-files=all)){throw 'Clean reviewed acceptance HEAD required'}
$taskRemote=@(git -C $taskCheckout ls-remote origin refs/heads/main)
if($LASTEXITCODE -ne 0 -or $taskRemote.Count -ne 1 -or ($taskRemote[0] -split '\s+')[0] -ne $ReviewedCommit){throw 'Exact pushed acceptance commit required'}
git -C $taskCheckout merge-base --is-ancestor $taskSource $ReviewedCommit
if($LASTEXITCODE -ne 0){throw 'Built source must be reviewed ancestor'}
$taskReady=Get-Content -LiteralPath (Join-Path $taskEvidence 'e4-release-ready.json') -Raw | ConvertFrom-Json
if($taskReady.sourceCommit -ne $taskSource -or $taskReady.reviewedCommit -ne $ReviewedCommit -or $taskReady.independentReview -ne 'CLOSED' -or $taskReady.deviceAcceptance -ne 'PASS' -or $taskReady.upgradeSaves -ne 'PASS' -or $taskReady.ci -ne 'success'){throw 'Actual closed acceptance required'}
$taskCi=Get-Content -LiteralPath (Join-Path $taskEvidence 'e4-final-ci.json') -Raw | ConvertFrom-Json
if($taskCi.head_sha -ne $taskSource -or $taskCi.conclusion -ne 'success' -or $taskCi.status -ne 'completed'){throw 'Exact built source CI required'}
if((Get-Item -LiteralPath $taskApk).Length -ne 2654159 -or (Get-FileHash -LiteralPath $taskApk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskSha){throw 'Reviewed APK bytes changed'}
if(Test-Path -LiteralPath (Join-Path $taskEvidence 'e4-release-intent.json')){throw 'Prior release attempt exists; reconcile read-only instead of repeating'}
$taskTag=@(git -C $taskCheckout ls-remote origin refs/tags/v0.4.1 'refs/tags/v0.4.1^{}' )
if($LASTEXITCODE -ne 0 -or $taskTag.Count -ne 0){throw 'New immutable tag required; inspect existing state'}
try {
 $env:GIT_TERMINAL_PROMPT='0'
 $taskCredentialLines=@("protocol=https`nhost=github.com`n`n" | git -c credential.helper= -c credential.helper=wincred credential fill)
 if($LASTEXITCODE -ne 0){throw 'Existing credential unavailable'}
 $taskCredential=@{}
 foreach($line in $taskCredentialLines){$pair=$line -split '=',2;if($pair.Length -eq 2){$taskCredential[$pair[0]]=$pair[1]}}
 if(-not $taskCredential.password){throw 'Existing credential unavailable'}
 $taskHeaders.Authorization='Bearer '+$taskCredential.password
 try {Invoke-RestMethod -Uri "$taskApi/releases/tags/v0.4.1" -Headers $taskHeaders | Out-Null; throw 'Release already exists; reconcile'}
 catch {if(-not $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404){throw}}
 @{sourceCommit=$taskSource;reviewedCommit=$ReviewedCommit;apkSha256=$taskSha;tag='v0.4.1'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskEvidence 'e4-release-intent.json') -Encoding UTF8
 git -C $taskCheckout tag -a v0.4.1 $taskSource -m 'Game Hub v0.4.1: verified update queries and compatible resource updates'
 if($LASTEXITCODE -ne 0){throw 'Tag creation failed; inspect'}
 git -C $taskCheckout push origin refs/tags/v0.4.1
 if($LASTEXITCODE -ne 0){throw 'Tag push outcome unknown; inspect'}
 $taskTag=@(git -C $taskCheckout ls-remote origin 'refs/tags/v0.4.1^{}')
 if($LASTEXITCODE -ne 0 -or $taskTag.Count -ne 1 -or ($taskTag[0] -split '\s+')[0] -ne $taskSource){throw 'Published immutable source tag differs'}
 $taskBody=@"
## 更新
- 打开大厅和手动检查时实际查询六个子游戏仓库的正式发布。
- 明确区分已核对、查询失败、离线历史和资源包待制作；无正式发布不会显示最新版。
- 光学游戏 1.2.1、图灵机 0.5.1、Lambda 0.3.1 已发布兼容资源，可在旧大厅局部更新并保留存档。

Android versionCode: 5。使用原发行证书，可覆盖安装 0.4.0。
源码：$taskSource
APK SHA-256：$taskSha
自动设备验收与独立审阅已完成，用户真机安装验证安排在发布后。
"@
 function Notes-Match([string]$actual,[string]$expected){return $actual.Replace("`r`n","`n") -ceq $expected.Replace("`r`n","`n")}
 @{name=$taskReleaseName;body=$taskBody;tag='v0.4.1';sourceCommit=$taskSource} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskEvidence 'e4-release-expected.json') -Encoding UTF8
 $taskRelease=Invoke-RestMethod -Method Post -Uri "$taskApi/releases" -Headers $taskHeaders -ContentType 'application/json; charset=utf-8' -Body (@{tag_name='v0.4.1';target_commitish=$taskSource;name=$taskReleaseName;body=$taskBody;draft=$true;prerelease=$false}|ConvertTo-Json -Compress)
 if($taskRelease.tag_name -ne 'v0.4.1' -or -not $taskRelease.draft -or $taskRelease.name -cne $taskReleaseName -or $taskRelease.target_commitish -ne $taskSource -or -not (Notes-Match $taskRelease.body $taskBody)){throw 'Unexpected draft identity or reviewed release text'}
 @{id=$taskRelease.id;tag=$taskRelease.tag_name;draft=$taskRelease.draft} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskEvidence 'e4-release-draft.json') -Encoding UTF8
 $taskAsset=Invoke-RestMethod -Method Post -Uri ("https://uploads.github.com/repos/xiaoxuhui/game-hub/releases/"+$taskRelease.id+'/assets?name=game-hub.apk') -Headers $taskHeaders -ContentType 'application/vnd.android.package-archive' -InFile $taskApk
 if($taskAsset.name -ne 'game-hub.apk' -or $taskAsset.state -ne 'uploaded' -or $taskAsset.size -ne 2654159 -or $taskAsset.digest -ne ('sha256:'+$taskSha)){throw 'Uploaded asset identity mismatch; keep draft and reconcile'}
 $taskAsset | Select-Object id,name,size,digest,state,browser_download_url | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskEvidence 'e4-release-asset.json') -Encoding UTF8
 $taskDraft=Invoke-RestMethod -Uri ("$taskApi/releases/"+$taskRelease.id) -Headers $taskHeaders
 if($taskDraft.id -ne $taskRelease.id -or $taskDraft.tag_name -ne 'v0.4.1' -or -not $taskDraft.draft -or $taskDraft.prerelease -or @($taskDraft.assets).Count -ne 1 -or $taskDraft.name -cne $taskReleaseName -or $taskDraft.target_commitish -ne $taskSource -or -not (Notes-Match $taskDraft.body $taskBody)){throw 'Draft changed text or gained unreviewed assets; keep draft and reconcile'}
 $taskDraftAsset=@($taskDraft.assets)[0]
 if($taskDraftAsset.id -ne $taskAsset.id -or $taskDraftAsset.name -ne 'game-hub.apk' -or $taskDraftAsset.state -ne 'uploaded' -or $taskDraftAsset.size -ne 2654159 -or $taskDraftAsset.digest -ne ('sha256:'+$taskSha)){throw 'Draft APK binding differs; keep draft and reconcile'}
 $taskDraft | Select-Object id,tag_name,name,body,target_commitish,draft,prerelease,assets | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskEvidence 'e4-release-prepublication.json') -Encoding UTF8
 $taskPublished=Invoke-RestMethod -Method Patch -Uri ("$taskApi/releases/"+$taskRelease.id) -Headers $taskHeaders -ContentType 'application/json' -Body (@{draft=$false;prerelease=$false;make_latest='true'}|ConvertTo-Json -Compress)
 if($taskPublished.draft -or $taskPublished.prerelease -or $taskPublished.tag_name -ne 'v0.4.1'){throw 'Publish outcome unexpected; inspect read-only'}
 $taskPublished | Select-Object id,tag_name,draft,prerelease,published_at,html_url,assets | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskEvidence 'e4-release-published.json') -Encoding UTF8
 Write-Output ('Published '+$taskPublished.html_url+' APK '+$taskSha)
} finally {$taskHeaders.Remove('Authorization');$taskCredential=$null;$taskCredentialLines=$null}
