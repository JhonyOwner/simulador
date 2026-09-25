# Simulador de Consórcio

Aplicação privada com acesso controlado para simular planos de consórcio,
comparar redutores e projetar os pagamentos pós-contemplação.

> Este projeto não é afiliado a nenhuma administradora de consórcio. Os
> resultados são estimativas para fins de estudo — consulte sempre o
> simulador oficial e o contrato da sua administradora antes de decidir.

## Estrutura do projeto

```
.
├── index.html            # Página inicial
├── simulador.html         # Simulador autenticado e resultados
├── JS/
│   └── calc.js             # Cálculos puros do simulador
├── api/                    # Serverless Functions usadas no deploy da Vercel
├── server.js              # Servidor HTTP + autenticação e proteção do simulador
├── auth.js                # Autenticação do servidor local com PostgreSQL
├── package.json           # Dependências do backend
├── TESTES/
│   └── calc.test.js        # Regressões do cálculo e da projeção
└── README.md
```

## Como executar

Para rodar localmente:

```bash
npm install
ADMIN_KEY="defina-uma-chave-forte" node server.js
```

Por padrão o servidor sobe em `http://localhost:8080`. Para usar outra porta:

```bash
PORT=3000 ADMIN_KEY="defina-uma-chave-forte" node server.js
```

O servidor local usa PostgreSQL pela variável `DATABASE_URL`. No deploy da
Vercel, as funções em `api/` usam Supabase pelas variáveis `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY`; nesse caso, execute antes o [`schema.sql`](schema.sql)
no SQL Editor do Supabase.

Para usar acesso administrativo sem limite de dispositivo, configure também
`ADMIN_EMAIL` com o e-mail da conta administrativa. No login, use esse e-mail
e informe `ADMIN_KEY` no próprio campo de senha. Usuários comuns continuam
usando suas senhas cadastradas.

Se a tela informar erro HTTP da API, confira em Vercel > Settings > Environment
Variables se `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_KEY` estão
configuradas para o ambiente correto. Depois de alterar variáveis, faça um novo
deploy. A chave `service_role` deve ser usada somente nas funções serverless.
O cadastro cria um usuário pendente; somente usuários aprovados na seção
**Gestão de acessos** da página inicial conseguem abrir `/simulador`. A chave
usada nessa seção é a variável `ADMIN_KEY`, que deve ser definida fora do
código e nunca compartilhada.

O login usa sessões em cookie `HttpOnly`, com expiração de 12 horas, e as
senhas são armazenadas somente como hash bcrypt. A confirmação de cadastro é
exibida na própria tela; o envio de e-mail transacional exige configurar um
provedor SMTP antes de ser ativado.
O acesso ao `simulador.html` exige login quando servido por `server.js` ou pela
Vercel. O arquivo `index.html` pode ser aberto diretamente apenas para
inspecionar a interface; as chamadas de autenticação precisam de um servidor.

## Cálculos

A interface usa `JS/calc.js` para calcular a taxa de administração líquida,
planos cheio/25%/50%, lance, amortização por prazo ou parcela, piso
pós-contemplação, reajuste anual e rendimento composto. A adesão pode ser paga
à vista (taxa mais uma parcela) ou diluída em um número configurável de meses;
durante esse período, o adicional mensal é somado à parcela e depois cessa. Os
cenários são validados com `npm test`.

## Licença

Uso livre para fins educacionais.
