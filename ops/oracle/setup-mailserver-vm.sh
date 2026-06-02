#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/apps/dfecentral}"
MAIL_ROOT="${MAIL_ROOT:-$APP_ROOT/mailserver}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"

echo "=== DFeCentral: Setup Mailserver ==="

if ! command -v docker >/dev/null 2>&1; then
  echo ">>> Instalando Docker..."
  curl -fsSL https://get.docker.com | sudo sh
fi

if ! docker compose version >/dev/null 2>&1; then
  echo ">>> Instalando Docker Compose plugin..."
  sudo apt-get update
  sudo apt-get install -y docker-compose-plugin
fi

open_port() {
  local port="$1"
  if ! sudo iptables -C INPUT -p tcp -m tcp --dport "$port" -j ACCEPT >/dev/null 2>&1; then
    sudo iptables -I INPUT 4 -p tcp -m tcp --dport "$port" -j ACCEPT
  fi
}

echo ">>> Liberando portas do mailserver no firewall local..."
open_port 25
open_port 465
open_port 587
open_port 993

sudo mkdir -p "$MAIL_ROOT/docker-data/dms"/mail-{data,state,logs} "$MAIL_ROOT/docker-data/dms"/{config,ssl}

if [ ! -f "$MAIL_ROOT/mailserver.env" ]; then
  if [ -f "$REPO_DIR/ops/mailserver/mailserver.env.example" ]; then
    sudo cp "$REPO_DIR/ops/mailserver/mailserver.env.example" "$MAIL_ROOT/mailserver.env"
    echo ">>> Arquivo $MAIL_ROOT/mailserver.env criado a partir do exemplo"
  else
    echo "Template de mailserver nao encontrado." >&2
    exit 1
  fi
fi

sudo cp "$REPO_DIR/ops/mailserver/docker-compose.yml" "$MAIL_ROOT/docker-compose.yml"

echo "=== DFeCentral: Mailserver pronto ==="
echo "Diretorio: $MAIL_ROOT"
echo "Ajuste $MAIL_ROOT/mailserver.env antes de subir o compose."
