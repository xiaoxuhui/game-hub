$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$endpoint='http://127.0.0.1:18427/games.json'
try {
  $config=Get-Content -LiteralPath (Join-Path $root 'games.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  try {$response=Invoke-RestMethod -Uri $endpoint -TimeoutSec 2; $running=($response.app -eq 'game-hub-local-web' -and $response.installationId -eq $config.installationId)}catch{$running=$false}
  if(-not $running){
    $node=(Get-Content -LiteralPath (Join-Path $root 'node-path.txt') -Raw).Trim();if(-not (Test-Path -LiteralPath $node -PathType Leaf)){$node=(Get-Command node.exe -ErrorAction Stop).Source}
    $argument='"'+(Join-Path $root 'server.mjs')+'"'
    $process=Start-Process -FilePath $node -ArgumentList $argument -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root 'server.log') -RedirectStandardError (Join-Path $root 'server-error.log')
    for($i=0;$i -lt 50;$i++){Start-Sleep -Milliseconds 200;try{$response=Invoke-RestMethod -Uri $endpoint -TimeoutSec 1;if($response.app -eq 'game-hub-local-web' -and $response.installationId -eq $config.installationId){$running=$true;break}}catch{};if($process.HasExited){break}}
  }
  if(-not $running){throw 'The local game hub could not start. A required port may already be in use.'}
  Start-Process 'http://127.0.0.1:18427/'
}catch{$_.Exception.Message | Set-Content -LiteralPath (Join-Path $root 'launch-error.log') -Encoding UTF8;Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show($_.Exception.Message,'Game Hub')|Out-Null}
