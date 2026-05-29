#!/usr/bin/env bash
# ============================================
# DFeCentral - Deploy na VM
# ============================================
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/apps/dfecentral}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/shared/app.env}"
BUILD_DIR="$APP_ROOT/runtime"
NORMALIZED_ENV_FILE="$APP_ROOT/runtime/app.normalized.env"

echo "=== DFeCentral: Deploy ==="

# Verificar arquivo de ambiente
if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de ambiente ausente: $ENV_FILE" >&2
  echo "Use deploy/oracle/app.env.example como referencia." >&2
  exit 1
fi

# Normalizar env file (remover BOM, quotes extras)
sed -i 's/\r$//' "$ENV_FILE"
rm -f "$NORMALIZED_ENV_FILE"

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    "")
      printf '\n' >> "$NORMALIZED_ENV_FILE"
      continue
      ;;
    \#*)
      printf '%s\n' "$line" >> "$NORMALIZED_ENV_FILE"
      continue
      ;;
  esac

  key="${line%%=*}"
  value="${line#*=}"
  if [ "${value#\"}" != "$value" ] && [ "${value%\"}" != "$value" ]; then
    value="${value#\"}"
    value="${value%\"}"
  fi
  printf '%s=%s\n' "$key" "$value" >> "$NORMALIZED_ENV_FILE"
done < "$ENV_FILE"

# Copiar env normalizado para o repo
cp "$NORMALIZED_ENV_FILE" "$REPO_DIR/.env"

# Carregar variaveis
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    "" | \#*)
      continue
      ;;
  esac
  export "$line"
done < "$NORMALIZED_ENV_FILE"

cd "$REPO_DIR"

# === BUILD: Web (Next.js - porta 3003) ===
echo ">>> Building Web (porta 3003)..."
if [ -f package.json ]; then
  npm ci --workspaces 2>/dev/null || npm install --include=dev
fi

# Build web
if [ -d "apps/web" ]; then
  cd apps/web
  npm run build 2>/dev/null || npx next build
  cd ../..

  WEB_BUILD_DIR="$BUILD_DIR/web"
  WEB_LIVE_DIR="$APP_ROOT/web"
  rm -rf "$WEB_BUILD_DIR"
  mkdir -p "$WEB_BUILD_DIR/.next" "$WEB_LIVE_DIR"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete apps/web/.next/standalone/ "$WEB_BUILD_DIR/"
    rsync -a --delete apps/web/.next/static/ "$WEB_BUILD_DIR/.next/static/"
  else
    cp -R apps/web/.next/standalone/. "$WEB_BUILD_DIR/"
    cp -R apps/web/.next/static "$WEB_BUILD_DIR/.next/"
  fi

  if [ -d apps/web/public ]; then
    mkdir -p "$WEB_BUILD_DIR/public"
    cp -R apps/web/public/. "$WEB_BUILD_DIR/public/"
  fi

  rsync -a --delete "$WEB_BUILD_DIR/" "$WEB_LIVE_DIR/"
  echo ">>> Web build concluido"
fi

# === BUILD: Consulta (Next.js - porta 3005) ===
echo ">>> Building Consulta (porta 3005)..."
if [ -d "apps/consulta" ]; then
  cd apps/consulta
  npm run build 2>/dev/null || npx next build
  cd ../..

  CONSULTA_BUILD_DIR="$BUILD_DIR/consulta"
  CONSULTA_LIVE_DIR="$APP_ROOT/consulta"
  rm -rf "$CONSULTA_BUILD_DIR"
  mkdir -p "$CONSULTA_BUILD_DIR/.next" "$CONSULTA_LIVE_DIR"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete apps/consulta/.next/standalone/ "$CONSULTA_BUILD_DIR/"
    rsync -a --delete apps/consulta/.next/static/ "$CONSULTA_BUILD_DIR/.next/static/"
  else
    cp -R apps/consulta/.next/standalone/. "$CONSULTA_BUILD_DIR/"
    cp -R apps/consulta/.next/static "$CONSULTA_BUILD_DIR/.next/"
  fi

  if [ -d apps/consulta/public ]; then
    mkdir -p "$CONSULTA_BUILD_DIR/public"
    cp -R apps/consulta/public/. "$CONSULTA_BUILD_DIR/public/"
  fi

  rsync -a --delete "$CONSULTA_BUILD_DIR/" "$CONSULTA_LIVE_DIR/"
  echo ">>> Consulta build concluido"
fi

# === BUILD: API (Fastify - porta 3004) ===
echo ">>> Building API (porta 3004)..."
if [ -d "apps/api" ]; then
  cd apps/api
  npm run build 2>/dev/null || npx tsc
  cd ../..
  echo ">>> API build concluido"
fi

# === DATABASE MIGRATIONS ===
if [ -n "${DATABASE_URL:-}" ]; then
  echo ">>> Rodando migrations..."
  cd "$REPO_DIR/apps/api"
  DATABASE_URL_PSQL="${DATABASE_URL%%\?*}"
  TABLE_COUNT="$(psql "$DATABASE_URL_PSQL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null || echo "0")"

  if [ "$TABLE_COUNT" = "0" ]; then
    npx drizzle-kit push 2>/dev/null || echo "Migrations puladas (drizzle-kit não configurado)"
  else
    echo "Banco ja possui tabelas, pulando push inicial"
  fi
  cd "$REPO_DIR"
fi

# === RESTART SERVICOS ===
echo ">>> Reiniciando servicos..."
sudo systemctl restart dfecentral-web
sudo systemctl restart dfecentral-api
sudo systemctl restart dfecentral-consulta
sudo systemctl reload caddy >/dev/null 2>&1 || sudo systemctl restart caddy

# === HEALTH CHECK ===
sleep 3
echo ">>> Verificando health..."
WEB_OK=$(curl -fsS "http://127.0.0.1:3003" >/dev/null 2>&1 && echo "OK" || echo "FALHOU")
API_OK=$(curl -fsS "http://127.0.0.1:3004/health" >/dev/null 2>&1 && echo "OK" || echo "FALHOU")
CONSULTA_OK=$(curl -fsS "http://127.0.0.1:3005" >/dev/null 2>&1 && echo "OK" || echo "FALHOU")

echo ""
echo "=== DFeCentral: Deploy concluido ==="
echo "  Web (3003):    $WEB_OK"
echo "  API (3004):    $API_OK"
echo "  Consulta (3005): $CONSULTA_OK"
echo ""
echo "URLs:"
echo "  https://www.dfecentral.com.br"
echo "  https://api.dfecentral.com.br"
echo "  https://consulta.dfecentral.com.br"
