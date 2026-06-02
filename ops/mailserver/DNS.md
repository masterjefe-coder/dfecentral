# DNS do Mailserver

Use estes registros para `dfecentral.com.br`.

## A
- `mail.dfecentral.com.br` -> IP público da VM Oracle

## MX
- `dfecentral.com.br` -> `mail.dfecentral.com.br` prioridade `10`

## SPF
- `dfecentral.com.br` -> `v=spf1 mx -all`

## DKIM
- Gere a chave no Docker Mailserver e publique o TXT em `mail._domainkey.dfecentral.com.br`.

## DMARC
- `_dmarc.dfecentral.com.br` -> `v=DMARC1; p=quarantine; rua=mailto:postmaster@dfecentral.com.br`

## Reverse DNS
- Aponte o PTR do IP da VM para `mail.dfecentral.com.br`.
