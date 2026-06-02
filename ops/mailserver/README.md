# DFeCentral Mailserver

Stack leve para `contato@dfecentral.com.br`.

## O que ele faz
- Recebe e-mails no domínio.
- Permite IMAP/SMTP no celular/Gmail app.
- Pode usar relay SMTP para enviar para fora da Oracle.

## O que precisa
- DNS do domínio `dfecentral.com.br`.
- Registro `A` para `mail.dfecentral.com.br` apontando para a VM.
- `MX` apontando para `mail.dfecentral.com.br`.
- `SPF`, `DKIM` e `DMARC`.
- Portas liberadas na Oracle: `25`, `465`, `587`, `993`.
- O Security List/NSG da OCI tambem precisa permitir essas portas.
- Veja `DNS.md` para os valores sugeridos.

## Como subir
1. Copie `mailserver.env.example` para `mailserver.env`.
2. Ajuste `POSTFIX_RELAYHOST` com o relay escolhido.
3. Rode `docker compose up -d` neste diretório.
4. Se for a primeira vez, revise `OVERRIDE_HOSTNAME`, `SSL_TYPE` e os registros DNS.
5. Crie a caixa postal com `ops/oracle/setup-mailbox-vm.sh` ou com `docker compose exec -T mailserver setup email add contato@dfecentral.com.br SENHA`.

## App DFeCentral
- A aplicação pode usar `SMTP_HOST=127.0.0.1` e `SMTP_PORT=587`.
- `MAIL_FROM` deve ser `contato@dfecentral.com.br`.
