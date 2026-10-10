$ErrorActionPreference='Stop'
$taskRoot='D:\soft\.ci-tmp\game-hub-n10'
$taskArchive='D:\soft\game-hub-archives\n10-20261010'
$taskWork=Join-Path $taskRoot 'work'
if(Test-Path -LiteralPath $taskArchive){throw 'Archive exists; reconcile before copying'}
foreach($taskPath in @('D:\','D:\soft','D:\soft\.ci-tmp','D:\soft\game-hub-archives',$taskRoot,$taskWork,(Join-Path $taskRoot 'evidence'))){$taskItem=Get-Item -LiteralPath $taskPath -Force;if(-not $taskItem.PSIsContainer -or ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or [IO.Path]::GetFullPath($taskItem.FullName).TrimEnd('\') -ine [IO.Path]::GetFullPath($taskPath).TrimEnd('\')){throw 'Plain absolute ancestor directories required'}}
$taskPlan=Get-Content -LiteralPath (Join-Path $taskWork 'doc\N10-更新检查修复实施计划.md') -Raw
if(-not $taskPlan.Contains('## N10-D 资源发行与旧大厅验收 [VERIFIED]') -or -not $taskPlan.Contains('## N10-E 修复 APK 发行 [VERIFIED]')){throw 'Actual D/E completion and closed independent reviews required before archive'}
$taskPublished=Get-Content -LiteralPath (Join-Path $taskRoot 'evidence\e4-anonymous-verified.json') -Raw | ConvertFrom-Json
if($taskPublished.tag -ne 'v0.4.1' -or $taskPublished.sha256 -ne '9f57c90af42efea54e4e079d637d964346a78e7e880493eac7887f9aaac323da' -or $taskPublished.bytes -ne 2654159 -or $taskPublished.anonymous -ne $true){throw 'Actual formal anonymous APK acceptance required'}
$taskBusy=@(Get-CimInstance Win32_Process | Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($taskRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0})
if($taskBusy.Count){throw 'Stop only own task processes before freezing evidence'}
$taskSource=(git -C $taskWork rev-parse HEAD).Trim()
if(git -C $taskWork status --porcelain=v1 --untracked-files=all){throw 'Clean source required before final archive'}
$taskArtifacts=@();$taskEvidenceFiles=@()
New-Item -ItemType Directory -Path $taskArchive | Out-Null
function Copy-ArchiveFile([string]$taskInput,[string]$taskRelative){
 if($taskRelative -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or ($taskRelative -split '/') -contains '..'){throw 'Unsafe relative archive path'}
 $taskItem=Get-Item -LiteralPath $taskInput -Force
 if($taskItem.PSIsContainer -or ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Plain source file required'}
 $taskOutput=[IO.Path]::GetFullPath((Join-Path $taskArchive $taskRelative))
 if(-not $taskOutput.StartsWith($taskArchive+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Output escaped archive'}
 $taskParent=[IO.Path]::GetDirectoryName($taskOutput)
 if(-not (Test-Path -LiteralPath $taskParent)){New-Item -ItemType Directory -Path $taskParent -Force | Out-Null}
 Copy-Item -LiteralPath $taskInput -Destination $taskOutput
 $taskHash=(Get-FileHash -LiteralPath $taskInput -Algorithm SHA256).Hash.ToLowerInvariant()
 if((Get-FileHash -LiteralPath $taskOutput -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskHash){throw 'Archive copy changed bytes'}
 return [ordered]@{path=$taskRelative;bytes=$taskItem.Length;sha256=$taskHash}
}
$taskEvidence=Join-Path $taskRoot 'evidence'
foreach($taskItem in Get-ChildItem -LiteralPath $taskEvidence -Recurse -Force){if($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Evidence links refused'}}
foreach($taskFile in Get-ChildItem -LiteralPath $taskEvidence -Recurse -File -Force){
 $taskRelative=$taskFile.FullName.Substring($taskEvidence.Length+1).Replace('\','/')
 $taskRecord=Copy-ArchiveFile $taskFile.FullName ('evidence/'+$taskRelative)
 $taskArtifacts+=$taskRecord
 $taskEvidenceFiles+=[ordered]@{path=$taskRelative;bytes=$taskRecord.bytes;sha256=$taskRecord.sha256}
}
foreach($taskCandidate in @('resource-candidate','dynamic-candidate')){foreach($taskFile in Get-ChildItem -LiteralPath (Join-Path $taskWork ('.build\'+$taskCandidate)) -File){$taskArtifacts+=Copy-ArchiveFile $taskFile.FullName ('candidates/'+$taskCandidate+'/'+$taskFile.Name)}}
$taskBundle=Join-Path $taskArchive 'n10-source.bundle'
git -C $taskWork bundle create $taskBundle --all
if($LASTEXITCODE -ne 0){throw 'Source bundle creation failed'}
git -C $taskWork bundle verify $taskBundle
if($LASTEXITCODE -ne 0){throw 'Source bundle verification failed'}
$taskArtifacts+=[ordered]@{path='n10-source.bundle';bytes=(Get-Item -LiteralPath $taskBundle).Length;sha256=(Get-FileHash -LiteralPath $taskBundle -Algorithm SHA256).Hash.ToLowerInvariant()}
[ordered]@{schemaVersion=1;taskRoot=$taskRoot;archiveRoot=$taskArchive;sourceCommit=$taskSource;artifacts=$taskArtifacts;evidenceFiles=$taskEvidenceFiles} | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath (Join-Path $taskArchive 'cleanup-index.json') -Encoding UTF8
Get-FileHash -LiteralPath (Join-Path $taskArchive 'cleanup-index.json') -Algorithm SHA256
Write-Output ('Verified '+$taskArtifacts.Count+' archive artifacts; freeze evidence now')
