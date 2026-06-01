param(
  [string]$HostName = $env:CASINO_DEPLOY_HOST,
  [string]$User = $env:CASINO_DEPLOY_USER,
  [string]$Port = $env:CASINO_DEPLOY_PORT,
  [string]$DeployPath = $env:CASINO_DEPLOY_PATH,
  [string]$KeyPath = $env:CASINO_DEPLOY_KEY
)

$ErrorActionPreference = "Stop"

if (-not $HostName) { throw "Missing CASINO_DEPLOY_HOST" }
if (-not $User) { throw "Missing CASINO_DEPLOY_USER" }
if (-not $Port) { $Port = "22" }
if (-not $DeployPath) { $DeployPath = "/var/www/casino-game" }

$repoRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $repoRoot "dist"
$packagePath = Join-Path $env:TEMP ("casino-frontend-dist-{0}.tar.gz" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
$remotePackage = "/tmp/" + [IO.Path]::GetFileName($packagePath)
$remoteDist = ($DeployPath.TrimEnd("/") + "/frontend/dist")
$backupPath = ($DeployPath.TrimEnd("/") + "/_backups/frontend-dist-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$sshTarget = "$User@$HostName"
$sshArgs = @("-p", $Port)

if ($KeyPath) {
  $sshArgs += @("-i", $KeyPath)
}

Push-Location $repoRoot
try {
  npm run build
  if (-not (Test-Path $distPath)) { throw "Build did not create dist directory" }
  if (Test-Path $packagePath) { Remove-Item -LiteralPath $packagePath -Force }
  tar -czf $packagePath -C $distPath .

  & ssh @sshArgs $sshTarget "mkdir -p '$remoteDist' '$backupPath' && if [ -d '$remoteDist' ]; then cp -a '$remoteDist/.' '$backupPath/' 2>/dev/null || true; fi"
  if ($LASTEXITCODE -ne 0) { throw "Remote backup command failed" }

  & scp @sshArgs $packagePath "${sshTarget}:$remotePackage"
  if ($LASTEXITCODE -ne 0) { throw "Upload package failed" }

  & ssh @sshArgs $sshTarget "rm -rf '$remoteDist'/* && tar -xzf '$remotePackage' -C '$remoteDist' && rm -f '$remotePackage'"
  if ($LASTEXITCODE -ne 0) { throw "Remote extract command failed" }

  Write-Host "Deployed frontend dist to $sshTarget:$remoteDist"
  Write-Host "Remote backup: $backupPath"
}
finally {
  Pop-Location
  if (Test-Path $packagePath) { Remove-Item -LiteralPath $packagePath -Force }
}
