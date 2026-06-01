#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/apps/dfecentral}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
REPO_GIT_DIR="${REPO_GIT_DIR:-$APP_ROOT/repo.git}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/shared/app.env}"
NORMALIZED_ENV_FILE="$APP_ROOT/runtime/app.normalized.env"

echo "=== DFeCentral: Deploy ==="

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de ambiente ausente: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$APP_ROOT/runtime" "$APP_ROOT/shared/certificados"

sed -i 's/\r$//' "$ENV_FILE"
rm -f "$NORMALIZED_ENV_FILE"

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    "") printf '\n' >> "$NORMALIZED_ENV_FILE"; continue ;;
    \#*) printf '%s\n' "$line" >> "$NORMALIZED_ENV_FILE"; continue ;;
  esac
  key="${line%%=*}"
  value="${line#*=}"
  if [ "${value#\"}" != "$value" ] && [ "${value%\"}" != "$value" ]; then
    value="${value#\"}"; value="${value%\"}"
  fi
  if [ "$key" = "DATABASE_URL" ] && [[ "$value" == *"?schema="* ]]; then
    value="${value%%\?schema=*}"
  fi
  printf '%s=%s\n' "$key" "$value" >> "$NORMALIZED_ENV_FILE"
done < "$ENV_FILE"

cp "$NORMALIZED_ENV_FILE" "$ENV_FILE"
cp "$NORMALIZED_ENV_FILE" "$REPO_DIR/.env"

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    "" | \#*) continue ;;
  esac
  export "$line"
done < "$NORMALIZED_ENV_FILE"

cd "$REPO_DIR"

echo ">>> Sincronizando checkout com o bare repo..."
git fetch "$REPO_GIT_DIR" "$BRANCH" 2>/dev/null || git fetch "$REPO_GIT_DIR" main 2>/dev/null || true
git reset --hard FETCH_HEAD
git clean -fd

echo ">>> Instalando dependencias..."
npm install --include=dev 2>&1 | tail -2

echo ">>> Building Web..."
cd apps/web
npx next build 2>&1 | tail -3
mkdir -p .next/standalone/apps/web/.next
cp -R .next/static .next/standalone/apps/web/.next/
if [ -d public ]; then cp -R public .next/standalone/apps/web/; fi
cd "$REPO_DIR"

echo ">>> Building Consulta..."
cd apps/consulta
npx next build 2>&1 | tail -3
mkdir -p .next/standalone/apps/consulta/.next
cp -R .next/static .next/standalone/apps/consulta/.next/
if [ -d public ]; then cp -R public .next/standalone/apps/consulta/; fi
cd "$REPO_DIR"

echo ">>> Building API (tsc)..."
cd apps/api
npm install 2>&1 | tail -2
npm run build 2>&1 | tail -20
cd "$REPO_DIR"

echo ">>> Instalando Playwright (scraper)..."
cd apps/scraper
npm install 2>&1 | tail -2
npx playwright install chromium 2>&1 | tail -2
echo ">>> Building Scraper (tsc)..."
npm run build 2>&1 | tail -20
cd "$REPO_DIR"

if [ -n "${DATABASE_URL:-}" ]; then
  echo ">>> Rodando migrations..."
  cd "$REPO_DIR/apps/api"
  npx drizzle-kit push 2>/dev/null || echo "Migrations puladas"
  cd "$REPO_DIR"
fi

echo ">>> Reiniciando servicos..."
sudo systemctl restart dfecentral-web
sudo systemctl restart dfecentral-api
sudo systemctl restart dfecentral-consulta
sudo systemctl restart dfecentral-scraper || echo "Scraper pode estar iniciando pela 1a vez"
sudo systemctl reload caddy >/dev/null 2>&1 || sudo systemctl restart caddy

sleep 5

echo ">>> Verificando health..."
WEB_OK=$(curl -fsS "http://127.0.0.1:3003" >/dev/null 2>&1 && echo "OK" || echo "FALHOU")
API_OK=$(curl -fsS "http://127.0.0.1:3004/api/v1/health" >/dev/null 2>&1 && echo "OK" || echo "FALHOU")
CONSULTA_OK=$(curl -fsS "http://127.0.0.1:3005" >/dev/null 2>&1 && echo "OK" || echo "FALHOU")

echo ""
echo "=== DFeCentral: Deploy concluido ==="
SCRAPER_OK=$(curl -fsS "http://127.0.0.1:3100/health" >/dev/null 2>&1 && echo "OK" || echo "FALHOU")

echo "  Web (3003):      $WEB_OK"
echo "  API (3004):      $API_OK"
echo "  Consulta (3005): $CONSULTA_OK"
echo "  Scraper (3100):  $SCRAPER_OK"
echo ""
echo "URLs:"
echo "  https://www.dfecentral.com.br"
echo "  https://api.dfecentral.com.br"
echo "  https://consulta.dfecentral.com.br"
