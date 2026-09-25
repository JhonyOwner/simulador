# Simulador de Consórcio

Ferramenta educativa e independente para simular a evolução da parcela de um
consórcio: valor pré e pós-contemplação, efeito do redutor, uso de lance
(embutido e em recursos próprios), taxa de adesão antecipada e a taxa real
anual equivalente do plano (calculada por TIR).

> Este projeto não é afiliado a nenhuma administradora de consórcio. Os
> resultados são estimativas para fins de estudo — consulte sempre o
> simulador oficial e o contrato da sua administradora antes de decidir.

## Estrutura do projeto

```
.
├── index.html            # Página inicial
├── simulador.html         # Formulário (landing page) + popup de resultados
├── JS/
│   └── calc.js             # Implementação legada testada separadamente
├── api/                    # Serverless Functions usadas no deploy da Vercel
├── server.js              # Servidor HTTP + autenticação e proteção do simulador
├── auth.js                # Autenticação do servidor local com PostgreSQL
├── package.json           # Dependências do backend
├── TESTES/
│   └── calc.test.js        # Testes do módulo e do cálculo ativo
└── README.md
```

## Como executar

O simulador é uma aplicação client-side (HTML + CSS + JavaScript embutidos), sem
dependências de build. Para rodar localmente:

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

Ao preencher o formulário e clicar em "Mostrar resultados", o extrato abre
em um popup (modal) por cima da página — pode ser fechado pelo × no canto,
clicando fora do card, ou com Esc.

## Testes

O teste valida o cálculo ativo embutido em `simulador.html`, incluindo os valores
da planilha para os planos cheio, com redutor de 25% e de 50%, além do piso e da
amortização pós-contemplação. O módulo legado `JS/calc.js` também é testado
separadamente. O comando retorna código diferente de zero se alguma checagem
falhar:

```bash
node TESTES/calc.test.js
```

## Como funciona o cálculo, em resumo

- **Fundo Comum e Fundo de Reserva** são recolhidos na proporção do redutor
  (quando houver) até o mês da contemplação.
- **Taxa de Administração** incide sobre 100% do crédito desde a 1ª parcela,
  independentemente do redutor.
- A **adesão à vista** substitui a primeira parcela regular; os pagamentos
  seguintes usam a parcela reduzida.
- O **piso pós-contemplação** é calculado sobre o saldo devedor inicial com
  taxas: 1% para automóvel e 0,5% para imóvel.
- O **comparativo pós-contemplação** mostra saldo após lance, pagamentos
  pré-contemplação, diferença do redutor e os prazos nos modos parcela e prazo.
- A **taxa real anual equivalente** é calculada por TIR (fluxo de caixa
  descontado) sobre o fluxo de entradas e saídas do plano.

## Licença

Uso livre para fins educacionais.
