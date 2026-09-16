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
├── css/
│   └── simulador.css      # Estilos do simulador
├── js/
│   ├── calc.js             # Lógica de cálculo, função pura (UMD: navegador + Node)
│   └── app.js               # Camada de UI: formulário, popup, gráfico, exportação
├── server.js              # Servidor HTTP + autenticação e proteção do simulador
├── auth.js                # SQLite, hash de senha, sessões e aprovação de usuários
├── package.json           # Dependências do backend
├── tests/
│   └── calc.test.js        # Teste de regressão de js/calc.js
└── README.md
```

## Como executar

O simulador é uma aplicação client-side (HTML + CSS + JavaScript puro), sem
dependências de build. Para rodar localmente:

```bash
npm install
ADMIN_KEY="defina-uma-chave-forte" node server.js
```

Por padrão o servidor sobe em `http://localhost:8080`. Para usar outra porta:

```bash
PORT=3000 ADMIN_KEY="defina-uma-chave-forte" node server.js

O backend usa o PostgreSQL do Supabase pela variável `DATABASE_URL`. Na
primeira execução, as tabelas `users` e `sessions` são criadas automaticamente.
O cadastro cria um usuário pendente; somente usuários aprovados na seção
**Gestão de acessos** da página inicial conseguem abrir `/simulador`. A chave
usada nessa seção é a variável `ADMIN_KEY`, que deve ser definida fora do
código e nunca compartilhada.

O login usa sessões em cookie `HttpOnly`, com expiração de 12 horas, e as
senhas são armazenadas somente como hash bcrypt. A confirmação de cadastro é
exibida na própria tela; o envio de e-mail transacional exige configurar um
provedor SMTP antes de ser ativado.
```

Também é possível abrir `index.html` ou `simulador.html` diretamente no
navegador, sem servidor, **desde que os arquivos estejam salvos juntos na
mesma pasta** (`css/`, `js/` etc. ao lado do `.html`) — links relativos não
funcionam se os arquivos forem abertos isoladamente, um por um, a partir de
lugares diferentes (por exemplo, pré-visualizações do Claude, que servem
cada arquivo de uma origem separada). A única funcionalidade que depende de
uma origem HTTP de verdade é a cópia para a área de transferência (fallback:
usar "Exportar JSON").

Ao preencher o formulário e clicar em "Mostrar resultados", o extrato abre
em um popup (modal) por cima da página — pode ser fechado pelo × no canto,
clicando fora do card, ou com Esc.

## Testes

A lógica de cálculo vive em `js/calc.js` como uma função pura (`calc(input)`,
sem acesso a DOM), exportada via UMD — o mesmo arquivo é usado pelo navegador
e importado diretamente pelo teste com `require()`. O teste roda alguns
cenários (com e sem lance, amortizando por parcelas ou por prazo), imprime os
resultados e valida invariantes básicas (saldo devedor não-negativo, total
pago ≥ crédito líquido, parcela nunca abaixo do piso mínimo etc.), retornando
código de saída diferente de zero se alguma checagem falhar:

```bash
node tests/calc.test.js
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
