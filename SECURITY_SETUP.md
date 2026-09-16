# Segurança de acesso — Vercel + Supabase

## 1. Banco
1. Crie um projeto no Supabase.
2. Abra SQL Editor e execute `schema.sql`.
3. No projeto, copie `Project URL` e a `service_role` key.

## 2. Vercel
Em Settings > Environment Variables, adicione:
- `SUPABASE_URL` = URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` = chave `service_role`
- `ADMIN_KEY` = uma chave administrativa longa e aleatória

A `service_role` fica SOMENTE nas variáveis da Vercel.

## 3. Regras implementadas
- Primeiro dispositivo usado por uma conta é vinculado ao usuário.
- A senha sozinha não libera a conta em outro aparelho.
- Login em outro dispositivo é recusado pelo backend.
- Existe uma sessão com token HttpOnly e expiração de 30 dias.
- Logout invalida a sessão no banco e limpa os cookies.
- Bloqueio/remoção do usuário invalida sessões.
- Administrador pode liberar o dispositivo por `/api/admin/device-reset`.
- IP do último login fica registrado para auditoria.

## 4. Importante
O bloqueio é feito no servidor, não no JavaScript do simulador. Portanto, alterar o HTML no navegador não libera o acesso.

Para trocar o aparelho de um cliente, use a função administrativa `device-reset` e peça para ele entrar novamente.
