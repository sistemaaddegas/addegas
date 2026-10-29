-- E32/E34 · preços do plano para a tela de assinatura.
begin;
select plan(3);

select tests.act_as(tests.new_user('precos@x.com'));
select is(jsonb_array_length(app.plan_prices() -> 'data'), 3, 'mensal, semestral e anual');
select is(app.plan_prices() -> 'data' -> 0 ->> 'cycle', 'monthly', 'mensal primeiro');
reset role;
set local role anon;
select throws_ok($$ select app.plan_prices() $$, '42501', null, 'anon não chama');
reset role;

select * from finish();
rollback;
