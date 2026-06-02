#!/usr/bin/env bash
set -euo pipefail

MAIL_ROOT="${MAIL_ROOT:-/opt/apps/dfecentral/mailserver}"
MAILBOX="${MAILBOX:-contato@dfecentral.com.br}"
PASSWORD="${PASSWORD:-}"

echo "=== DFeCentral: Criar mailbox ==="

if [ -z "$PASSWORD" ]; then
  read -r -s -p "Senha para $MAILBOX: " PASSWORD
  echo
fi

if [ ! -f "$MAIL_ROOT/docker-compose.yml" ]; then
  echo "docker-compose.yml nao encontrado em $MAIL_ROOT" >&2
  exit 1
fi

cd "$MAIL_ROOT"

sudo docker compose exec -T mailserver setup email add "$MAILBOX" "$PASSWORD"

echo "=== Mailbox criada: $MAILBOX ==="
