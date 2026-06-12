param(
  [string]$Remote = "origin",
  [string]$Branch = "main",
  [string]$KeyPath = "C:\Projetos\oci_recuperacao"
)

$ErrorActionPreference = "Stop"

$gitExe = if (Get-Command git -ErrorAction SilentlyContinue) {
  "git"
} elseif (Test-Path "C:\Program Files\Git\cmd\git.exe") {
  "C:\Program Files\Git\cmd\git.exe"
} else {
  throw "Git nao encontrado. Instale o Git ou ajuste o PATH."
}

Write-Host "=== DFeCentral: Push + Deploy ===" -ForegroundColor Cyan

# 1. Push
Write-Host ">> Push para $Remote/$Branch..." -ForegroundColor Yellow
& $gitExe push $Remote $Branch
if ($LASTEXITCODE -ne 0) {
  throw "Push para $Remote/$Branch falhou."
}

# 2. Deploy
Write-Host ">> Iniciando deploy na VM Oracle..." -ForegroundColor Yellow
$deployArgs = @(
  '-ExecutionPolicy', 'Bypass',
  '-File', "$PSScriptRoot/deploy-web-oracle.ps1",
  '-Branch', $Branch,
  '-KeyPath', $KeyPath
)
& powershell @deployArgs
if ($LASTEXITCODE -ne 0) {
  throw "Deploy Oracle falhou."
}

Write-Host ""
Write-Host "=== Deploy concluido ===" -ForegroundColor Green
