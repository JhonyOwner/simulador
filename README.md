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
│   └── calc.js             # Núcleo de cálculo usado pelos testes
├── api/                    # Serverless Functions usadas no deploy da Vercel
├── server.js              # Servidor HTTP + autenticação e proteção do simulador
├── auth.js                # Autenticação do servidor local com PostgreSQL
├── package.json           # Dependências do backend
├── TESTES/
│   └── calc.test.js        # Teste de regressão de js/calc.js
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

A lógica de cálculo de regressão vive em `JS/calc.js` como uma função pura (`calc(input)`,
sem acesso a DOM), exportada via UMD e importada diretamente pelo teste com
`require()`. O cálculo executado pela tela está embutido em `simulador.html` e
é verificado separadamente pelo teste.
O teste roda alguns
cenários (com e sem lance, amortizando por parcelas ou por prazo), imprime os
resultados e valida invariantes básicas (saldo devedor não-negativo, total
pago ≥ crédito líquido, parcela nunca abaixo do piso mínimo etc.), retornando
código de saída diferente de zero se alguma checagem falhar:

```bash
node TESTES/calc.test.js
```

## Como funciona o cálculo, em resumo

- **Fundo Comum e Fundo de Reserva** são recolhidos na proporção do redutor
  (quando houver) até o mês da contemplação.
- **Taxa de Administração** incide sobre 100% do crédito desde a 1ª parcela,
  independentemente do redutor.
- Na **contemplação**, a diferença acumulada entre a parcela cheia e a
  parcela reduzida pode ser coberta por lance em recursos próprios; o que
  sobrar é diluído nas parcelas restantes ou pago com parcelas extras ao
  final do prazo, conforme a forma de amortização escolhida.
- A **taxa real anual equivalente** é calculada por TIR (fluxo de caixa
  descontado) sobre o fluxo de entradas e saídas do plano.

## Licença

Uso livre para fins educacionais.
