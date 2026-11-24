#!/usr/bin/env bash
# E20 · Dois terminais vendendo o mesmo produto em paralelo.
# Confere: nenhum deadlock ou erro, números de venda sem repetição e saldo = inicial − vendido.
# Uso (com o Supabase local rodando e `npm run db:test` já executado uma vez):
#   bash supabase/tests/concorrencia/venda-paralela.sh [vendas_por_terminal]
# Deixa dados no banco local: rode `npm run db:reset` depois.
set -euo pipefail
N="${1:-300}"
DB="supabase_db_addegas"
PSQL=(docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qtA)
TMP="$(mktemp -d)"

if [ -z "$("${PSQL[@]}" -c "select 1 from pg_namespace where nspname = 'tests'")" ]; then
  echo "Rode 'npm run db:test' uma vez antes (cria o schema tests)."; exit 1
fi

echo "Preparando loja, 2 terminais, 2 operadores e 2 caixas abertos..."
"${PSQL[@]}" > "$TMP/ids" <<'SQL'
do $$
declare
  j jsonb := tests.new_store_owner('concorrencia-' || gen_random_uuid() || '@x.com', 'Concorrencia ' || left(gen_random_uuid()::text, 8));
  v_store uuid := (j ->> 'store_id')::uuid; v_acc uuid := (j ->> 'account_id')::uuid;
  v_prod uuid; v_t1 uuid; v_t2 uuid; v_m1 uuid; v_m2 uuid; v_s1 uuid; v_s2 uuid;
begin
  insert into app.products (account_id, name, price) values (v_acc, 'Heineken', 1000) returning id into v_prod;
  perform private.move_stock(v_store, v_prod, 'initial', 10000, 500);
  insert into app.store_members (store_id, display_name, role) values (v_store, 'Caixa 1', 'cashier') returning id into v_m1;
  insert into app.store_members (store_id, display_name, role) values (v_store, 'Caixa 2', 'cashier') returning id into v_m2;
  v_t1 := tests.new_terminal(v_store); v_t2 := tests.new_terminal(v_store);
  insert into app.operator_sessions (store_id, terminal_id, member_id)
    select v_store, id, v_m1 from app.terminals where auth_user_id = v_t1 returning id into v_s1;
  insert into app.operator_sessions (store_id, terminal_id, member_id)
    select v_store, id, v_m2 from app.terminals where auth_user_id = v_t2 returning id into v_s2;
  insert into app.cash_sessions (store_id, terminal_id, opened_by, business_date)
    select v_store, id, v_m1, current_date from app.terminals where auth_user_id = v_t1;
  insert into app.cash_sessions (store_id, terminal_id, opened_by, business_date)
    select v_store, id, v_m2, current_date from app.terminals where auth_user_id = v_t2;
  create table if not exists public._concorrencia (k text primary key, v uuid);
  delete from public._concorrencia;
  insert into public._concorrencia values ('store', v_store), ('prod', v_prod), ('t1', v_t1), ('t2', v_t2), ('s1', v_s1), ('s2', v_s2);
end $$;
select string_agg(k || '=' || v, ' ') from public._concorrencia;
SQL
declare -A ID
for kv in $(cat "$TMP/ids"); do ID[${kv%%=*}]=${kv#*=}; done

# Cada transação: entra como o terminal ($1) e vende 1 unidade com a sessão de operador ($2).
gen() {
  for _ in $(seq 1 "$N"); do
    cat <<SQL
begin;
do \$q\$ begin perform set_config('request.jwt.claims', '{"sub":"$1","role":"authenticated","app_metadata":{"kind":"terminal"}}', true); end \$q\$;
set local role authenticated;
select app.finalize_sale(jsonb_build_object('operator_session_id','$2','client_request_id',gen_random_uuid(),
  'items',jsonb_build_array(jsonb_build_object('product_id','${ID[prod]}','quantity',1)),
  'payments',jsonb_build_array(jsonb_build_object('method','pix','amount',1000)))) ->> 'ok';
commit;
SQL
  done
}
gen "${ID[t1]}" "${ID[s1]}" > "$TMP/w1.sql"
gen "${ID[t2]}" "${ID[s2]}" > "$TMP/w2.sql"

echo "Rodando $N vendas em cada um dos 2 terminais, ao mesmo tempo..."
start=$(date +%s)
"${PSQL[@]}" < "$TMP/w1.sql" > "$TMP/r1" 2>&1 & p1=$!
"${PSQL[@]}" < "$TMP/w2.sql" > "$TMP/r2" 2>&1 & p2=$!
wait $p1 || true
wait $p2 || true
echo "Tempo: $(( $(date +%s) - start )) s"

# Toda linha de saída deve ser "true" (venda ok); qualquer outra coisa é erro.
erros=$(cat "$TMP/r1" "$TMP/r2" | { grep -v -c -E '^(true|SET|)$' || true; })
read -r vendas distintas saldo < <("${PSQL[@]}" -c "select count(*) || ' ' || count(distinct number) || ' ' ||
  (select quantity::int from app.product_stock where store_id = '${ID[store]}' and product_id = '${ID[prod]}')
  from app.sales where store_id = '${ID[store]}'")
esperado=$((2 * N))
echo "Vendas: $vendas (esperado $esperado) · números distintos: $distintas · saldo: $saldo (esperado $((10000 - esperado))) · linhas com erro: $erros"
if [ "$vendas" = "$esperado" ] && [ "$distintas" = "$esperado" ] && [ "$saldo" = "$((10000 - esperado))" ] && [ "$erros" = "0" ]; then
  echo "OK: sem deadlock, sem número repetido, saldo correto."
else
  echo "FALHA"; cat "$TMP/r1" "$TMP/r2" | grep -v -E '^(true|SET|)$' | head -5; exit 1
fi
