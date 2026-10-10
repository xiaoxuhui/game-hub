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
$taskEvidenceInputs=New-Object 'System.Collections.Generic.List[System.IO.FileInfo]'
$taskStack=New-Object 'System.Collections.Generic.Stack[string]';$taskStack.Push($taskEvidence)
while($taskStack.Count){
 foreach($taskItem in Get-ChildItem -LiteralPath $taskStack.Pop() -Force){
  if(($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $taskItem.FullName.StartsWith($taskEvidence+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Evidence traversal link or boundary refused before descent'}
  if($taskItem.PSIsContainer){$taskStack.Push($taskItem.FullName)}else{$taskEvidenceInputs.Add($taskItem)}
 }
}
$taskManifest=Get-Content -LiteralPath (Join-Path $taskWork 'doc\evidence\n10-d-complete\candidate-hashes.json') -Raw | ConvertFrom-Json
if($taskManifest.producer -ne 'fc9da9be6a238018d86f2085facd5b8085e68cf8' -or @($taskManifest.files).Count -ne 12){throw 'Reviewed 12-file candidate manifest required'}
foreach($taskPath in @((Join-Path $taskWork '.build'),(Join-Path $taskWork '.build\resource-candidate'),(Join-Path $taskWork '.build\dynamic-candidate'))){
 $taskItem=Get-Item -LiteralPath $taskPath -Force
 if(-not $taskItem.PSIsContainer -or ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or [IO.Path]::GetFullPath($taskItem.FullName).TrimEnd('\') -ine [IO.Path]::GetFullPath($taskPath).TrimEnd('\')){throw 'Plain canonical candidate ancestor required'}
}
$taskCandidateInputs=@()
foreach($taskCandidate in @('resource-candidate','dynamic-candidate')){
 $taskExpected=@($taskManifest.files | Where-Object candidate -CEQ $taskCandidate)
 if($taskExpected.Count -ne 6 -or @($taskExpected.file | Select-Object -Unique).Count -ne 6){throw 'Exact six unique candidate files required'}
 $taskDirectory=Join-Path $taskWork ('.build\'+$taskCandidate)
 $taskActual=@(Get-ChildItem -LiteralPath $taskDirectory -Force)
 if((($taskActual.Name | Sort-Object) -join "`n") -cne (($taskExpected.file | Sort-Object) -join "`n")){throw 'Candidate file set differs from reviewed manifest'}
 foreach($taskSpec in $taskExpected){
  if($taskSpec.file -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$' -or $taskSpec.sha256 -notmatch '^[0-9a-f]{64}$'){throw 'Unsafe candidate manifest entry'}
  $taskInput=Join-Path $taskDirectory $taskSpec.file;$taskItem=Get-Item -LiteralPath $taskInput -Force
  if($taskItem.PSIsContainer -or ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $taskItem.Length -ne $taskSpec.bytes -or (Get-FileHash -LiteralPath $taskInput -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskSpec.sha256){throw 'Candidate bytes differ from reviewed manifest'}
  $taskCandidateInputs+=[ordered]@{input=$taskInput;relative=('candidates/'+$taskCandidate+'/'+$taskSpec.file)}
 }
}
New-Item -ItemType Directory -Path $taskArchive | Out-Null
foreach($taskFile in $taskEvidenceInputs){
 $taskRelative=$taskFile.FullName.Substring($taskEvidence.Length+1).Replace('\','/')
 $taskRecord=Copy-ArchiveFile $taskFile.FullName ('evidence/'+$taskRelative)
 $taskArtifacts+=$taskRecord
 $taskEvidenceFiles+=[ordered]@{path=$taskRelative;bytes=$taskRecord.bytes;sha256=$taskRecord.sha256}
}
foreach($taskInput in $taskCandidateInputs){$taskArtifacts+=Copy-ArchiveFile $taskInput.input $taskInput.relative}
$taskBundle=Join-Path $taskArchive 'n10-source.bundle'
git -C $taskWork bundle create $taskBundle --all
if($LASTEXITCODE -ne 0){throw 'Source bundle creation failed'}
git -C $taskWork bundle verify $taskBundle
if($LASTEXITCODE -ne 0){throw 'Source bundle verification failed'}
$taskArtifacts+=[ordered]@{path='n10-source.bundle';bytes=(Get-Item -LiteralPath $taskBundle).Length;sha256=(Get-FileHash -LiteralPath $taskBundle -Algorithm SHA256).Hash.ToLowerInvariant()}
[ordered]@{schemaVersion=1;taskRoot=$taskRoot;archiveRoot=$taskArchive;sourceCommit=$taskSource;artifacts=$taskArtifacts;evidenceFiles=$taskEvidenceFiles} | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath (Join-Path $taskArchive 'cleanup-index.json') -Encoding UTF8
Get-FileHash -LiteralPath (Join-Path $taskArchive 'cleanup-index.json') -Algorithm SHA256
Write-Output ('Verified '+$taskArtifacts.Count+' archive artifacts; freeze evidence now')
