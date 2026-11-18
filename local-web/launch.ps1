$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$endpoint='http://127.0.0.1:18427/games.json'
try {
  $config=Get-Content -LiteralPath (Join-Path $root 'games.json') -Raw | ConvertFrom-Json
  try {$response=Invoke-RestMethod -Uri $endpoint -TimeoutSec 2; $running=($response.app -eq 'game-hub-local-web' -and $response.installationId -eq $config.installationId)}catch{$running=$false}
  if(-not $running){
    $node=(Get-Content -LiteralPath (Join-Path $root 'node-path.txt') -Raw).Trim();if(-not (Test-Path -LiteralPath $node -PathType Leaf)){$node=(Get-Command node.exe -ErrorAction Stop).Source}
    $process=Start-Process -FilePath $node -ArgumentList @('"'+(Join-Path $root 'server.mjs')+'"') -WorkingDirectory $root -WindowStyle Hidden -PassThru
    for($i=0;$i -lt 50;$i++){Start-Sleep -Milliseconds 200;try{$response=Invoke-RestMethod -Uri $endpoint -TimeoutSec 1;if($response.app -eq 'game-hub-local-web' -and $response.installationId -eq $config.installationId){$running=$true;break}}catch{};if($process.HasExited){break}}
  }
  if(-not $running){throw '本地服务未启动，可能有端口被其他程序占用。'}
  Start-Process 'http://127.0.0.1:18427/'
}catch{Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show($_.Exception.Message,'游戏大厅')|Out-Null}
