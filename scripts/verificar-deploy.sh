#!/usr/bin/env bash
# Confere se o deploy responde corretamente.
# Uso: bash scripts/verificar-deploy.sh https://seu-projeto.vercel.app
set -u
BASE="${1:?Uso: bash scripts/verificar-deploy.sh https://seu-projeto.vercel.app}"
BASE="${BASE%/}"
FALHAS=0

check() {
  local url="$1" esperado="$2" res code tipo
  res=$(curl -sL -o /dev/null -w "%{http_code} %{content_type}" "$url")
  code="${res%% *}"; tipo="${res#* }"
  if [ "$code" = "200" ] && [[ "$tipo" == *"$esperado"* ]]; then
    echo "OK     $url"
  else
    echo "FALHA  $url  ($code $tipo)"; FALHAS=$((FALHAS+1))
  fi
}

check "$BASE/" "text/html"
if curl -sL "$BASE/" | grep -q 'data-dc-script'; then echo "OK     index.html contém a lógica do sistema"; else echo "FALHA  index.html não é o arquivo do sistema"; FALHAS=$((FALHAS+1)); fi
check "$BASE/support.js" "javascript"
check "$BASE/data/lucro-no-copo.js" "javascript"
for f in addegas-icon.png addegas-logo-dark.png dd-amarelo.png dd-login.png dd-pattern.png; do check "$BASE/assets/$f" "image/png"; done
for f in favicon-32.png apple-touch-icon.png icon-192.png icon-512.png; do check "$BASE/icons/$f" "image/png"; done
check "$BASE/manifest.webmanifest" "json"
check "https://unpkg.com/react@18.3.1/umd/react.production.min.js" "javascript"
check "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" "javascript"
check "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" "text/css"

echo
if [ "$FALHAS" -eq 0 ]; then echo "Tudo certo."; else echo "$FALHAS falha(s). Veja 'Problemas comuns' no CLAUDE.md."; exit 1; fi
