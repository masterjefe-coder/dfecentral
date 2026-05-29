param(
  [string]$ServerHost = "147.15.59.187",
  [string]$User = "ubuntu",
  [string]$KeyPath = "C:\Projetos\oci_recuperacao",
  [string]$RemoteRoot = "/opt/apps/dfecentral",
  [string]$Branch = "main",
  [string]$CertPath = ""
)

$ErrorActionPreference = "Stop"

$gitExe = if (Get-Command git -ErrorAction SilentlyContinue) {
  "git"
} elseif (Test-Path "C:\Program Files\Git\cmd\git.exe") {
  "C:\Program Files\Git\cmd\git.exe"
} else {
  throw "Git nao encontrado. Instale o Git ou ajuste o PATH."
}

if (-not (Test-Path $KeyPath)) {
  throw "Chave SSH nao encontrada em $KeyPath"
}

# Verificar se ha mudancas nao commitadas
$repoStateLines = @(& $gitExe status --porcelain)
$repoState = ($repoStateLines -join "`n").Trim()
if ($repoState) {
  throw "Ha mudancas locais nao commitadas. Faca commit antes do deploy."
}

Write-Host "=== DFeCentral: Deploy Oracle ===" -ForegroundColor Cyan

# 1. Bootstrap remoto (bare repo)
Write-Host ">> Configurando bare repo na VM..." -ForegroundColor Yellow
$remoteGitDir = "$RemoteRoot/repo.git"
$bootstrapCommand = "set -euo pipefail; mkdir -p '$RemoteRoot'; if ! command -v git >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y git; fi; if [ ! -d '$remoteGitDir/refs' ]; then rm -rf '$remoteGitDir'; git init --bare '$remoteGitDir'; fi"
& ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$ServerHost" $bootstrapCommand
if ($LASTEXITCODE -ne 0) {
  throw "Bootstrap remoto do deploy falhou."
}

# 2. Push do codigo
Write-Host ">> Enviando codigo para a VM..." -ForegroundColor Yellow
$previousGitSshCommand = $env:GIT_SSH_COMMAND
$env:GIT_SSH_COMMAND = "ssh -i `"$KeyPath`" -o StrictHostKeyChecking=accept-new"
& $gitExe push --force "ssh://$User@$ServerHost$remoteGitDir" "HEAD:refs/heads/$Branch"
$pushExitCode = $LASTEXITCODE
if ($null -ne $previousGitSshCommand) {
  $env:GIT_SSH_COMMAND = $previousGitSshCommand
} else {
  Remove-Item Env:GIT_SSH_COMMAND -ErrorAction SilentlyContinue
}
if ($pushExitCode -ne 0) {
  throw "Push do codigo para a VM falhou."
}

# 2.5. Sincronizar certificado digital (se fornecido)
if ($CertPath -and (Test-Path $CertPath)) {
  Write-Host ">> Enviando certificado digital para a VM..." -ForegroundColor Yellow
  $remoteCertDir = "$RemoteRoot/shared/certificados"
  & ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$ServerHost" "mkdir -p '$remoteCertDir'"
  & scp -i $KeyPath -o StrictHostKeyChecking=accept-new "$CertPath" "$User@$ServerHost`:$remoteCertDir/"
  & ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$ServerHost" "for f in '$remoteCertDir'/*.pfx; do [ -f \"\$f\" ] && sudo cp -f \"\$f\" '$remoteCertDir/certificado.pfx'; break; done; sudo chown ubuntu:ubuntu '$remoteCertDir/certificado.pfx' 2>/dev/null"
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao enviar certificado para a VM."
  }
}

# 3. Checkout + setup + build + restart
Write-Host ">> Buildando e reiniciando servicos..." -ForegroundColor Yellow
$remoteCommand = @"
set -euo pipefail
APP_ROOT='$RemoteRoot'
REPO_DIR="`$APP_ROOT/repo"
REPO_GIT_DIR='$remoteGitDir'
mkdir -p "`$REPO_DIR"
git --git-dir="`$REPO_GIT_DIR" --work-tree="`$REPO_DIR" checkout -f '$Branch'
git --git-dir="`$REPO_GIT_DIR" --work-tree="`$REPO_DIR" clean -fd
APP_ROOT='$RemoteRoot' REPO_DIR="`$REPO_DIR" REPO_GIT_DIR="`$REPO_GIT_DIR" BRANCH='$Branch' bash "`$REPO_DIR/ops/oracle/setup-git-deploy-vm.sh"
APP_ROOT='$RemoteRoot' REPO_DIR="`$REPO_DIR" bash "`$REPO_DIR/ops/oracle/deploy-web-vm.sh"
"@
& ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$ServerHost" $remoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "Deploy falhou na VM."
}

Write-Host ""
Write-Host "=== DFeCentral: Deploy concluido com sucesso ===" -ForegroundColor Green
Write-Host "  https://www.dfecentral.com.br" -ForegroundColor White
Write-Host "  https://api.dfecentral.com.br" -ForegroundColor White
Write-Host "  https://consulta.dfecentral.com.br" -ForegroundColor White
