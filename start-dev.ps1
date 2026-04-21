$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeBin = "C:\Users\ricw5\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
$nodeExe = Join-Path $nodeBin "node.exe"
$npmCli = Join-Path $projectRoot "tools\npm\package\bin\npm-cli.js"

Set-Location $projectRoot
$env:PATH = "$nodeBin;$env:PATH"

& $nodeExe $npmCli run dev
