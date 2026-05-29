#!/usr/bin/env bash
# ============================================
# DFeCentral - Setup Git Deploy na VM
# ============================================
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/apps/dfecentral}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
REPO_GIT_DIR="${REPO_GIT_DIR:-$APP_ROOT/repo.git}"
BRANCH="${BRANCH:-main}"

echo "=== DFeCentral: Setup Git Deploy ==="
echo "APP_ROOT: $APP_ROOT"

# Criar estrutura de pastas
mkdir -p "$APP_ROOT/shared/bin" "$APP_ROOT/backups" "$APP_ROOT/runtime"
mkdir -p "$APP_ROOT/web" "$APP_ROOT/api" "$APP_ROOT/consulta"

# Verificar git
if ! command -v git >/dev/null 2>&1; then
  echo "git nao encontrado. Instalando..."
  sudo apt-get update && sudo apt-get install -y git
fi

# Verificar Caddy
if [ ! -f /etc/caddy/Caddyfile ]; then
  echo "Caddyfile principal nao encontrado em /etc/caddy/Caddyfile" >&2
  exit 1
fi

# Inicializar bare repo se nao existir
if [ ! -d "$REPO_GIT_DIR/refs" ]; then
  echo "Criando bare repo em $REPO_GIT_DIR"
  rm -rf "$REPO_GIT_DIR"
  git init --bare "$REPO_GIT_DIR"
fi

# Preparar diretorio de trabalho
mkdir -p "$REPO_DIR"
git config --global --add safe.directory "$REPO_DIR" >/dev/null 2>&1 || true

if [ -d "$REPO_DIR/.git" ]; then
  echo "Sincronizando checkout local com o bare repo..."
  git -C "$REPO_DIR" fetch "$REPO_GIT_DIR" "$BRANCH"
  git -C "$REPO_DIR" reset --hard FETCH_HEAD
  git -C "$REPO_DIR" clean -fd
fi

# Checkout do codigo
if git --git-dir="$REPO_GIT_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Fazendo checkout da branch $BRANCH"
  git --git-dir="$REPO_GIT_DIR" --work-tree="$REPO_DIR" checkout -f "$BRANCH"
  git --git-dir="$REPO_GIT_DIR" --work-tree="$REPO_DIR" clean -fd
fi

# Habilitar corepack se disponivel
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

# Configurar Caddy (import sites-enabled)
sudo mkdir -p /etc/caddy/sites-enabled
if ! sudo grep -qF "import /etc/caddy/sites-enabled/*" /etc/caddy/Caddyfile; then
  echo "Adicionando import ao Caddyfile principal"
  tmpfile="$(mktemp)"
  {
    echo "import /etc/caddy/sites-enabled/*"
    echo
    sudo cat /etc/caddy/Caddyfile
  } > "$tmpfile"
  sudo cp "$tmpfile" /etc/caddy/Caddyfile
  rm -f "$tmpfile"
fi

# Copiar configs para os locais corretos
echo "Instalando systemd services..."
sudo cp "$REPO_DIR/ops/oracle/dfecentral-web.service" /etc/systemd/system/dfecentral-web.service
sudo cp "$REPO_DIR/ops/oracle/dfecentral-api.service" /etc/systemd/system/dfecentral-api.service
sudo cp "$REPO_DIR/ops/oracle/dfecentral-consulta.service" /etc/systemd/system/dfecentral-consulta.service
sudo cp "$REPO_DIR/ops/oracle/dfecentral-scraper.service" /etc/systemd/system/dfecentral-scraper.service

echo "Instalando Caddyfile..."
sudo cp "$REPO_DIR/ops/oracle/dfecentral.Caddyfile" /etc/caddy/sites-enabled/dfecentral.Caddyfile

# Reload systemd e caddy
sudo systemctl daemon-reload
sudo systemctl enable dfecentral-web >/dev/null 2>&1 || true
sudo systemctl enable dfecentral-api >/dev/null 2>&1 || true
sudo systemctl enable dfecentral-consulta >/dev/null 2>&1 || true
sudo systemctl enable dfecentral-scraper >/dev/null 2>&1 || true
sudo systemctl reload caddy >/dev/null 2>&1 || sudo systemctl restart caddy

echo "=== DFeCentral: Setup Git Deploy concluido ==="
