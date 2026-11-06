$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path -LiteralPath $edge)) { throw "Microsoft Edge was not found at $edge" }

foreach ($name in @('irontrack-main', 'irontrack-routine', 'irontrack-workout', 'irontrack-progress')) {
  $svg = Join-Path $root "$name.svg"
  $png = Join-Path $root "$name.png"
  Remove-Item -LiteralPath $png -ErrorAction SilentlyContinue
  $fileUrl = 'file:///' + $svg.Replace('\', '/')
  & $edge '--headless=new' '--disable-gpu' '--hide-scrollbars' '--no-first-run' '--force-device-scale-factor=1' '--window-size=1920,1080' "--screenshot=$png" $fileUrl 2>$null | Out-Null
  for ($attempt = 0; $attempt -lt 40 -and -not (Test-Path -LiteralPath $png); $attempt++) {
    Start-Sleep -Milliseconds 250
  }
  if (-not (Test-Path -LiteralPath $png)) { throw "Could not render $svg to PNG." }
  Write-Output (Get-Item -LiteralPath $png | Select-Object Name,Length)
}
