#!/usr/bin/env bash
# Teste ponta a ponta das Edge Functions contra o Supabase local.
# Pré-requisitos: `npm run db:start`, `npm run db:reset` e, em outro terminal,
#   npx supabase functions serve --env-file supabase/functions/.env   (com STRIPE_WEBHOOK_SECRET=whsec_teste_local)
# Uso: bash supabase/tests/funcoes/fluxo.sh
set -uo pipefail
API="http://127.0.0.1:57321"
FN="$API/functions/v1"
STATUS=$(npx supabase status -o json 2>/dev/null)
ANON=$(echo "$STATUS" | python -c "import sys,json;print(json.load(sys.stdin)['ANON_KEY'])")
SERVICE=$(echo "$STATUS" | python -c "import sys,json;print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")
PSQL=(docker exec -i supabase_db_addegas psql -U postgres -d postgres -qtA)
FALHAS=0; TOTAL=0
j() { python -c "import sys,json;d=json.load(sys.stdin);print(eval('d'+sys.argv[1]))" "$1" 2>/dev/null; }
check() { TOTAL=$((TOTAL+1)); if [ "$2" = "$3" ]; then echo "ok     $1"; else echo "FALHA  $1 (veio '$2', esperado '$3')"; FALHAS=$((FALHAS+1)); fi; }
rpc() { curl -s -X POST "$API/rest/v1/rpc/$2" -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Profile: app" -H "Content-Type: application/json" -d "$3"; }
fn() { curl -s -X POST "$FN/$2" -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -H "x-correlation-id: ${CID:-fluxo}" -d "$3"; }
login() { curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | j "['access_token']"; }
new_user() { curl -s -X POST "$API/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" \
  -d "{\"email\":\"$1\",\"password\":\"$2\",\"email_confirm\":true${3:+,\"app_metadata\":$3}}" | j "['id']"; }
SUF=$RANDOM

echo "== E04/E05 · saúde e logs"
check "health responde" "$(curl -s "$FN/health" | j "['ok']")" "True"
CID="corr-fluxo-$SUF" fn "$ANON" logs '{"level":"error","message":"Falha no caixa de joao@x.com","context":{"token":"abc"}}' > /dev/null
check "log do front gravado com o correlation_id e mascarado" \
  "$("${PSQL[@]}" -c "select message || '|' || (context->>'token') from audit.system_logs where correlation_id = 'corr-fluxo-$SUF'")" "Falha no caixa de j***@x.com|[removido]"

echo "== E06 · dono e loja"
new_user "dono$SUF@x.com" "Senha-forte-123" > /dev/null
T_DONO=$(login "dono$SUF@x.com" "Senha-forte-123")
ONB=$(rpc "$T_DONO" complete_onboarding "{\"p_store_name\":\"Adega Fluxo $SUF\",\"p_whatsapp\":\"11999990000\"}")
STORE=$(echo "$ONB" | j "['data']['store_id']"); ACC=$(echo "$ONB" | j "['data']['account_id']")
check "onboarding pela API" "$(echo "$ONB" | j "['ok']")" "True"

echo "== E07 · login criado pelo dono (D20)"
MEM=$(fn "$T_DONO" members/create "{\"store_id\":\"$STORE\",\"name\":\"João\",\"role\":\"cashier\",\"username\":\"joao$SUF\"}")
SENHA=$(echo "$MEM" | j "['data']['password']")
check "dono cria login por nome de usuário" "$(echo "$MEM" | j "['ok']")" "True"
SLUG=$("${PSQL[@]}" -c "select slug from app.stores where id = '$STORE'")
T_JOAO=$(login "joao$SUF@u.$SLUG.addegas.invalid" "$SENHA")
check "com a senha provisória, não vê a loja" "$(rpc "$T_JOAO" my_stores '{}' | j "['data'].__len__()")" "0"
check "app sabe que precisa trocar a senha" "$(rpc "$T_JOAO" must_change_password '{}')" "true"
curl -s -X PUT "$API/auth/v1/user" -H "apikey: $ANON" -H "Authorization: Bearer $T_JOAO" -H "Content-Type: application/json" -d '{"password":"Nova-senha-456"}' > /dev/null
T_JOAO=$(login "joao$SUF@u.$SLUG.addegas.invalid" "Nova-senha-456")
check "trocou a senha, passa a ver a loja" "$(rpc "$T_JOAO" my_stores '{}' | j "['data'].__len__()")" "1"
check "caixa não cria login de ninguém" "$(fn "$T_JOAO" members/create "{\"store_id\":\"$STORE\",\"name\":\"X\",\"role\":\"cashier\",\"username\":\"x$SUF\"}" | j "['error']['code']")" "FORBIDDEN"

echo "== E09/E10 · terminal pareado e PIN"
CODE=$(rpc "$T_DONO" create_pairing_code "{\"p_store_id\":\"$STORE\",\"p_terminal_name\":\"Balcao 1\"}" | j "['data']['code']")
MPIN=$(rpc "$T_DONO" create_pin_member "{\"p_store_id\":\"$STORE\",\"p_display_name\":\"Bruno\",\"p_role\":\"cashier\",\"p_pin\":\"4821\"}" | j "['data']['member_id']")
check "código errado não pareia" "$(curl -s -X POST "$FN/terminals/pair" -H 'Content-Type: application/json' -d "{\"store_slug\":\"$SLUG\",\"code\":\"000000\"}" | j "['error']['code']")" "PAIRING_CODE_INVALID"
PAIR=$(curl -s -X POST "$FN/terminals/pair" -H 'Content-Type: application/json' -d "{\"store_slug\":\"$SLUG\",\"code\":\"$CODE\"}")
T_TERM=$(echo "$PAIR" | j "['data']['session']['access_token']"); TERM_ID=$(echo "$PAIR" | j "['data']['terminal_id']")
check "aparelho pareado recebe sessão" "$(echo "$PAIR" | j "['ok']")" "True"
check "operador entra com PIN no terminal" "$(rpc "$T_TERM" operator_login "{\"p_member_id\":\"$MPIN\",\"p_pin\":\"4821\"}" | j "['data']['name']")" "Bruno"
check "terminal revogado pelo dono" "$(fn "$T_DONO" terminals/revoke "{\"terminal_id\":\"$TERM_ID\"}" | j "['ok']")" "True"
check "terminal revogado é recusado na hora, mesmo com o token ainda dentro da validade (§9)" "$(rpc "$T_TERM" operator_login "{\"p_member_id\":\"$MPIN\",\"p_pin\":\"4821\"}" | j "['error']['code']")" "TERMINAL_REQUIRED"

echo "== E14 · admin-api"
new_user "lia$SUF@addegas.com.br" "Senha-forte-123" '{"kind":"staff"}' > /dev/null
"${PSQL[@]}" -c "insert into platform.staff (user_id, name, email, role_code) select id, 'Lia', email, 'support' from auth.users where email = 'lia$SUF@addegas.com.br'" > /dev/null
T_LIA=$(login "lia$SUF@addegas.com.br" "Senha-forte-123")
check "equipe sem 2FA é recusada" "$(fn "$T_LIA" admin/me '{}' | j "['error']['code']")" "MFA_REQUIRED"
check "dono de adega não entra no admin" "$(fn "$T_DONO" admin/me '{}' | j "['error']['code']")" "AUTH_REQUIRED"

echo "== E34/E42 · webhook do Stripe"
"${PSQL[@]}" -c "update platform.subscriptions set stripe_customer_id = 'cus_$SUF' where account_id = '$ACC'" > /dev/null
NOW=$(date +%s); END=$((NOW + 2592000))
EVT="{\"id\":\"evt_$SUF\",\"type\":\"invoice.paid\",\"data\":{\"object\":{\"id\":\"in_$SUF\",\"customer\":\"cus_$SUF\",\"amount_paid\":14990,\"payment_intent\":\"pi_$SUF\",\"period_start\":$NOW,\"period_end\":$END,\"lines\":{\"data\":[{\"period\":{\"start\":$NOW,\"end\":$END}}]}}}}"
SIG=$(printf '%s' "$NOW.$EVT" | openssl dgst -sha256 -hmac "whsec_teste_local" | awk '{print $NF}')
check "assinatura inválida é recusada" "$(curl -s -X POST "$FN/hooks-stripe" -H "stripe-signature: t=$NOW,v1=errada" -d "$EVT" | j "['error']['code']")" "WEBHOOK_SIGNATURE_INVALID"
check "evento assinado é aceito" "$(curl -s -X POST "$FN/hooks-stripe" -H "stripe-signature: t=$NOW,v1=$SIG" -d "$EVT" | j "['received']")" "True"
check "repetido é marcado como duplicado" "$(curl -s -X POST "$FN/hooks-stripe" -H "stripe-signature: t=$NOW,v1=$SIG" -d "$EVT" | j "['duplicate']")" "True"
check "rotina sem segredo é recusada" "$(curl -s -X POST "$FN/cron/webhooks" | j "['error']['code']")" "FORBIDDEN"
curl -s -X POST "$FN/cron/webhooks" -H "x-cron-secret: local-secret-123" > /dev/null
check "fatura paga ativa a assinatura" "$("${PSQL[@]}" -c "select status || '/' || access from platform.subscriptions where account_id = '$ACC'")" "active/allowed"
check "fatura e pagamento espelhados" "$("${PSQL[@]}" -c "select count(*) from platform.payments where stripe_payment_id = 'pi_$SUF'")" "1"

echo "== E35/E45 · fila de mensagens (envio simulado)"
"${PSQL[@]}" -c "select private.enqueue_message('email', 'service', 'dono$SUF@x.com', 'payment_confirmed', '{\"responsavel\":\"Dono\"}', 'fluxo:$SUF')" > /dev/null
curl -s -X POST "$FN/cron/outbox" -H "x-cron-secret: local-secret-123" > /dev/null
check "mensagem da fila enviada (dry-run)" "$("${PSQL[@]}" -c "select status from platform.outbox where dedupe_key = 'fluxo:$SUF'")" "sent"

echo "== E48 · lead da landing"
check "lead registrado" "$(curl -s -X POST "$FN/leads" -H 'Content-Type: application/json' -d "{\"name\":\"Zé\",\"phone\":\"11977$SUF\",\"utm\":{\"utm_source\":\"instagram\"}}" | j "['ok']")" "True"

echo "== E15 · upload assinado e tipo real"
SIGN=$(fn "$T_DONO" uploads/sign "{\"purpose\":\"product_image\",\"store_id\":\"$STORE\",\"mime\":\"image/png\",\"size\":100}")
UPATH=$(echo "$SIGN" | j "['data']['path']"); UURL=$(echo "$SIGN" | j "['data']['signed_url']")
check "caminho decidido pelo servidor, na pasta da loja" "$(echo "$UPATH" | cut -d/ -f1)" "$STORE"
printf 'isto nao e um png' > /tmp/falso.png
curl -s -X PUT "$UURL" -H "Content-Type: image/png" --data-binary @/tmp/falso.png > /dev/null
check "arquivo com extensão falsa é recusado e apagado" "$(fn "$T_DONO" uploads/finalize "{\"bucket\":\"store-public\",\"path\":\"$UPATH\"}" | j "['error']['code']")" "UPLOAD_TYPE_REJECTED"
check "caixa não assina upload de foto de produto" "$(fn "$T_JOAO" uploads/sign "{\"purpose\":\"product_image\",\"store_id\":\"$STORE\",\"mime\":\"image/png\",\"size\":100}" | j "['error']['code']")" "FORBIDDEN"

echo
echo "$((TOTAL - FALHAS)) de $TOTAL verificações passaram."
[ "$FALHAS" -eq 0 ] || exit 1
