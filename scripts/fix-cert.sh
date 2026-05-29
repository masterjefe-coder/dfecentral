#!/bin/bash
set -e
CERT_DIR="/opt/apps/dfecentral/shared/certificados"
cd "$CERT_DIR"
for f in *.pfx; do
  [ -f "$f" ] || continue
  sudo cp -f "$f" certificado.pfx
  echo "Copied $f -> certificado.pfx"
  break
done
sudo chown ubuntu:ubuntu certificado.pfx
ls -la
echo ---
openssl pkcs12 -in certificado.pfx -passin pass:He300417@ -nokeys 2>/dev/null | openssl x509 -noout -subject -dates 2>&1
echo ---
echo "Done"
