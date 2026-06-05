#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/apps/dfecentral}"

usage() {
  cat <<'EOF'
Uso: dfecentral-ops.sh <status|health|logs> [servico] [linhas]

Comandos:
  status   Mostra o estado dos servicos principais
  health   Testa os endpoints locais de web/api/consulta/scraper
  logs     Mostra journal do servico informado

Servicos validos para logs: web, api, consulta, scraper, caddy
EOF
}

service_unit() {
  case "${1:-}" in
    web) echo "dfecentral-web" ;;
    api) echo "dfecentral-api" ;;
    consulta) echo "dfecentral-consulta" ;;
    scraper) echo "dfecentral-scraper" ;;
    caddy) echo "caddy" ;;
    *) return 1 ;;
  esac
}

check() {
  local name="$1" url="$2"
  local code
  code=$(curl -fsS -o /dev/null -w '%{http_code}' --connect-timeout 5 "$url" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    printf '%s OK (%s)\n' "$name" "$code"
    return 0
  fi
  printf '%s FALHOU (%s)\n' "$name" "$code"
  return 1
}

cmd="${1:-}"
case "$cmd" in
  status)
    systemctl --no-pager --full status dfecentral-web dfecentral-api dfecentral-consulta dfecentral-scraper
    ;;
  health)
    fail=0
    check "web" "http://127.0.0.1:3003/" || fail=$((fail + 1))
    check "api" "http://127.0.0.1:3004/api/v1/health" || fail=$((fail + 1))
    check "consulta" "http://127.0.0.1:3005/" || fail=$((fail + 1))
    check "scraper" "http://127.0.0.1:3100/health" || fail=$((fail + 1))
    exit "$fail"
    ;;
  logs)
    unit="$(service_unit "${2:-}")" || { echo "Servico invalido" >&2; usage; exit 1; }
    lines="${3:-120}"
    journalctl -u "$unit" -n "$lines" --no-pager -o short-iso
    ;;
  *)
    usage
    exit 1
    ;;
esac
