// Teste de regressão para js/calc.js.
//
// Antes, este teste recortava o código de calc() de dentro do HTML na marra
// (string slicing + vm.runInContext) e só imprimia o JSON, sem checar nada —
// ou seja, nunca falhava, mesmo se o cálculo quebrasse. Agora ele importa a
// função pura diretamente (SimuladorCalc.calc) e valida algumas invariantes
// básicas do resultado, encerrando com código de saída != 0 se algo regredir.
//
// Uso: node tests/calc.test.js

const path = require('path');
const { calc } = require(path.join(__dirname, '..', 'js', 'calc.js'));

function runCalc(formaRestante, overrides) {
  const input = Object.assign(
    {
      credito: 120000,
      prazo: 240,
      taPct: 22,
      frPct: 2,
      seguroPct: 0.065,
      mesContemplacao: 30,
      tipoBemPct: '0.5',
      minCustomPct: 0,
      redutorPct: '50',
      redutorCustomPct: 0,
      embutidoPct: 0,
      dinheiroPct: 0,
      usarLance: false,
      formaRestante,
      adesaoPct: 2,
      adesaoForma: 'avista',
      adesaoMeses: 12
    },
    overrides || {}
  );
  return calc(input);
}

const cenarios = [
  { nome: 'Sem lance', overrides: { dinheiroPct: 0, usarLance: false } },
  { nome: 'Lance parcial (5%)', overrides: { dinheiroPct: 5, usarLance: true } },
  { nome: 'Lance cobrindo déficit (20%)', overrides: { dinheiroPct: 20, usarLance: true } }
];

let falhas = 0;
function checar(cond, msg) {
  if (!cond) { console.error(`  FALHA: ${msg}`); falhas++; }
}

['parcelas', 'prazo'].forEach((formaRestante) => {
  console.log(`\n=== Amortização por ${formaRestante} ===`);
  cenarios.forEach(({ nome, overrides }) => {
    const r = runCalc(formaRestante, overrides);
    console.log(`\n${nome}`);
    console.log(
      JSON.stringify(
        {
          k: r.k,
          N: r.N,
          Nefetivo: r.Nefetivo,
          parcelaCheia: r.parcelaCheia,
          parcelaReduzida: r.parcelaReduzida,
          parcelaPos: r.parcelaPos,
          restante: r.restante,
          saldoDevedor: r.saldoDevedor,
          extraDiluicao: r.extraDiluicao,
          mesesExtras: r.mesesExtras,
          proximaParcela: r.outflow[r.k + 1]
        },
        null,
        2
      )
    );

    checar(Number.isFinite(r.saldoDevedor), 'saldoDevedor deveria ser numérico');
    checar(r.saldoDevedor >= 0, 'saldoDevedor não pode ser negativo');
    checar(r.totalPago >= r.creditoLiquido, 'totalPago não pode ser menor que o crédito líquido recebido');
    checar(r.outflow.length === r.Nefetivo + 1, 'outflow deveria ter Nefetivo+1 posições (índice 0 em branco)');
    checar(r.parcelaPos >= r.parcelaMinima - 0.01, 'parcelaPos não pode ficar abaixo da parcela mínima');
    if (formaRestante === 'prazo') {
      checar(r.Nefetivo <= r.N, 'amortização por prazo não deveria aumentar o prazo total');
    } else {
      checar(r.Nefetivo >= r.N, 'amortização por parcelas não deveria reduzir o prazo total');
    }
  });
});

// Cenário de regressão específico: lance em dinheiro suficiente para cobrir
// 100% do déficit do redutor deve zerar "restante".
const cobreTudo = runCalc('parcelas', { dinheiroPct: 100, usarLance: true });
checar(cobreTudo.restante === 0, 'lance de 100% do crédito deveria cobrir toda a diferença do redutor');

if (falhas > 0) {
  console.error(`\n${falhas} falha(s) encontrada(s).`);
  process.exit(1);
}
console.log('\nTodos os cenários passaram nas checagens estruturais.');
