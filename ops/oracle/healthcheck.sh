#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/opt/apps/dfecentral/shared/healthcheck.log"
ALERT_EMAIL="${ALERT_EMAIL:-}"
MAX_LOG_LINES=1000

check() {
  local name="$1" url="$2"
  local status
  status=$(curl -fsS -o /dev/null -w '%{http_code}' --connect-timeout 5 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "200" ]; then
    echo "[$(date -Iseconds)] $name: OK ($status)" >> "$LOG_FILE"
    return 0
  else
    echo "[$(date -Iseconds)] $name: FALHOU ($status)" >> "$LOG_FILE"
    return 1
  fi
}

FAIL=0
check "web"     "http://127.0.0.1:3003/"             || FAIL=$((FAIL + 1))
check "api"     "http://127.0.0.1:3004/api/v1/health"  || FAIL=$((FAIL + 1))
check "scraper" "http://127.0.0.1:3100/health"         || FAIL=$((FAIL + 1))
check "caddy"   "http://127.0.0.1:80/"                 || FAIL=$((FAIL + 1))

LINES=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$LINES" -gt "$MAX_LOG_LINES" ]; then
  tail -n 200 "$LOG_FILE" > "$LOG_FILE.tmp"
  mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

if [ "$FAIL" -gt 0 ]; then
  echo "[$(date -Iseconds)] HEALTHCHECK: $FAIL servico(s) com problema" >> "$LOG_FILE"
  if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
    echo "DFeCentral: $FAIL servico(s) com problema em $(date)" | mail -s "DFeCentral Alert" "$ALERT_EMAIL"
  fi
  exit 1
fi
