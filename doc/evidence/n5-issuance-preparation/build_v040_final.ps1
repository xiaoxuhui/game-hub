param([Parameter(Mandatory=$true)][string]$Commit)
$ErrorActionPreference = 'Stop'
$taskRoot = 'D:\soft\.ci-tmp\game-hub-work\v030-final'
$taskSha = $Commit
if ($taskSha -notmatch '^[0-9a-f]{40}$') { throw 'Full immutable commit required' }
$taskEvidence = 'D:\soft\.ci-tmp\game-hub-work\v030-evidence\v040-release'
$env:PATH = 'D:\soft\.ci-tmp\game-hub-tools\pnpm-11.19\node_modules\.bin;' + $env:PATH
$env:JAVA_HOME = 'D:\soft\.ci-tmp\game-hub-signing-tools\jdk-17.0.20.1+1'
$env:ANDROID_HOME = 'D:\soft\.ci-tmp\game-hub-signing-tools\android-sdk'
Remove-Item Env:GAME_HUB_LOCAL_SOURCES -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $taskEvidence -Force | Out-Null
if (-not (Test-Path -LiteralPath $taskRoot)) {
    git clone --no-checkout 'https://github.com/xiaoxuhui/game-hub.git' $taskRoot
    if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
    git -C $taskRoot checkout --detach $taskSha
    if ($LASTEXITCODE -ne 0) { throw 'Checkout failed' }
}
Set-Location -LiteralPath $taskRoot
if (git status --porcelain=v1 --untracked-files=all) { throw 'Final checkout must be clean' }
if ((git rev-parse HEAD).Trim() -ne $taskSha) {
    git fetch origin main
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed' }
    git checkout --detach $taskSha
    if ($LASTEXITCODE -ne 0) { throw 'Checkout failed' }
}
if ((git rev-parse HEAD).Trim() -ne $taskSha) { throw 'Unexpected checkout SHA' }
node --version
pnpm --version
function Invoke-Step([string]$name, [scriptblock]$action) {
    & $action 2>&1 | Tee-Object -FilePath (Join-Path $taskEvidence ($name + '.txt'))
    if ($LASTEXITCODE -ne 0) { throw "$name failed: $LASTEXITCODE" }
}
Invoke-Step 'node-check' { pnpm run check }
Invoke-Step 'bundle' { pnpm run bundle }
Invoke-Step 'verify-bundle' { pnpm run verify:bundle }
Invoke-Step 'storage' { pnpm run audit:storage }
Invoke-Step 'resource-build' { pnpm run prepare:resources }
Invoke-Step 'dynamic-build' { pnpm run prepare:dynamic }
Invoke-Step 'dynamic-verify' { pnpm run verify:dynamic }
Invoke-Step 'dynamic-device-fixture' { node scripts/prepare-dynamic-device-fixture.mjs }
Invoke-Step 'resource-verify' { pnpm run verify:resources }
$taskBefore = @(Get-ChildItem -LiteralPath '.build\resource-candidate' -Filter '*.zip' | ForEach-Object { [pscustomobject]@{name=$_.Name; sha=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
Invoke-Step 'resource-repeat' { node --input-type=module -e "import {buildResources} from './scripts/resource-bundle.mjs'; buildResources(process.cwd(),{independent:true});" }
$taskAfter = @(Get-ChildItem -LiteralPath '.build\resource-candidate' -Filter '*.zip' | ForEach-Object { [pscustomobject]@{name=$_.Name; sha=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
if (($taskBefore | ConvertTo-Json -Compress) -ne ($taskAfter | ConvertTo-Json -Compress)) { throw 'Resource ZIPs not reproducible' }
$taskAfter | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskEvidence 'resource-repeat-hashes.json') -Encoding utf8
Invoke-Step 'android-unit-release-lint' { & 'D:\soft\.ci-tmp\game-hub-signing-tools\gradle-8.7\bin\gradle.bat' -p android testReleaseUnitTest assembleRelease lintRelease --no-daemon --rerun-tasks }
Invoke-Step 'android-release-instrument' { & 'D:\soft\.ci-tmp\game-hub-signing-tools\gradle-8.7\bin\gradle.bat' -p android assembleReleaseAndroidTest -PgameHubTestBuildType=release --no-daemon }
Invoke-Step 'apk-assets' { & 'C:\Users\25133\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/verify_apk.py android/app/build/outputs/apk/release/app-release-unsigned.apk $taskSha }
$taskXml = @(Get-ChildItem -LiteralPath 'android\app\build\test-results\testReleaseUnitTest' -Filter '*.xml' | ForEach-Object { [xml]$doc = Get-Content -LiteralPath $_.FullName -Raw; $doc.testsuite })
$taskCounts = [pscustomobject]@{tests=($taskXml | Measure-Object tests -Sum).Sum; failures=($taskXml | Measure-Object failures -Sum).Sum; errors=($taskXml | Measure-Object errors -Sum).Sum}
$taskCounts | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskEvidence 'jvm-counts.json') -Encoding utf8
if ($taskCounts.failures -ne 0 -or $taskCounts.errors -ne 0) { throw 'Unit tests failed' }
if (git status --porcelain=v1 --untracked-files=all) { throw 'Build dirtied tracked checkout' }
Write-Output "FINAL_CANDIDATE_BUILD_OK $taskSha"
