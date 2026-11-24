# E07 · Equipe da loja: o dono cria os logins

**Marco:** M2 · Identidade | **Tamanho:** M | **Depende de:** E06 | **Desbloqueia:** E10, E12
**Origem:** §3 ("os demais entram por convite enviado no WhatsApp"), §1 ("Equipe")
**Decisões aplicadas:** D20 (o dono gera o login e manda por e-mail ou entrega pessoalmente), D22 (sem convite por WhatsApp)

## Objetivo
O dono (ou quem tiver "Gerenciar equipe") cadastra cada pessoa da loja com uma função e entrega o acesso, por e-mail ou pessoalmente, sem depender de convite.

## Entra
- Cadastro pelo dono: RPC `app.create_member(store_id, nome, função, email_ou_usuario, senha_provisoria?)`, que chama a função `/api/members/create` (precisa da chave de serviço do Auth para criar o usuário):
  - **com e-mail:** cria o usuário no Auth com esse e-mail e senha provisória (gerada pelo sistema ou definida pelo dono) e envia o e-mail "Seu acesso ao Addegas" pelo Resend (E35);
  - **sem e-mail:** o dono escolhe um nome de usuário (`joao.esquina`); o sistema cria um e-mail técnico interno (`joao.esquina@u.<store_slug>.addegas.invalid`), que nunca recebe mensagem. A tela mostra **uma vez só** o usuário e a senha provisória para o dono repassar.
  - grava `store_members` com a função e `app_metadata.kind = 'person'`.
- Login: a tela aceita e-mail **ou** nome de usuário; com usuário, o front completa o e-mail técnico antes de chamar o Auth.
- Primeiro acesso: `app_metadata.must_change_password = true` → o app obriga a troca antes de qualquer outra tela; a RLS recusa tudo, menos trocar a senha, enquanto a marca existir.
- Redefinir senha: com e-mail, pelo fluxo normal; sem e-mail, **só o dono** gera uma nova senha provisória.
- Caixa que opera só no tablet do balcão **não precisa** de login: basta o PIN (E10). O cadastro pergunta "Essa pessoa vai usar o sistema no próprio celular?"; se não, cria só o membro com PIN.
- Desativar membro: `store_members.active = false` + revogar sessões no Auth na hora (§9).
- Mudança de função gera auditoria (E13) com antes e depois.

## Não entra
- Matriz de permissões (E12), PIN (E10).

## Regras
- O dono não pode ser desativado nem rebaixado por um gerente (§4).
- O gerente não cadastra ninguém com função acima da dele.
- A senha provisória nunca é guardada nem registrada em log; só aparece na tela uma vez.
- O nome de usuário é único por loja; o e-mail técnico inclui o slug da loja para não colidir entre lojas.

## Critérios de aceite
- Teste: caixa tenta cadastrar membro → recusado e auditado.
- Teste: gerente tenta desativar o dono → recusado.
- Teste: login com `joao.esquina` e senha provisória → só consegue trocar a senha.
- Teste: membro desativado tem a sessão revogada e a próxima chamada falha.

## Riscos e atenção
- A senha provisória vai passar por WhatsApp ou papel. Por isso a troca obrigatória no primeiro acesso não é opcional.
- Quem não tem e-mail depende do dono para recuperar a senha; deixar isso claro na tela de cadastro.
