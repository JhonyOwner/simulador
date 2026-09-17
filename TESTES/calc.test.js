// Teste de regressão para JS/calc.js.
//
// Antes, este teste recortava o código de calc() de dentro do HTML na marra
// (string slicing + vm.runInContext) e só imprimia o JSON, sem checar nada —
// ou seja, nunca falhava, mesmo se o cálculo quebrasse. Agora ele importa a
// função pura diretamente (SimuladorCalc.calc) e valida algumas invariantes
// básicas do resultado, encerrando com código de saída != 0 se algo regredir.
//
// Uso: node TESTES/calc.test.js

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { calc } = require(path.join(__dirname, '..', 'JS', 'calc.js'));

function activeCalc() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'simulador.html'), 'utf8');
  const start = html.indexOf('function calc(inp)');
  const end = html.indexOf('function fmtNum', start);
  if (start < 0 || end < 0) throw new Error('Cálculo ativo não encontrado no simulador.html');
  const context = {};
  vm.runInNewContext(`${html.slice(start, end)};this.calc=calc;`, context);
  return context.calc;
}

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
    if (r.totalLance > 0) {
      checar(r.mesesPosContemplacao < r.mesesRestantesContrato, 'meses pós-contemplação devem reduzir o prazo restante quando há lance');
      checar(r.Nefetivo <= r.N, 'o prazo total não pode aumentar quando há lance');
    } else {
      checar(r.mesesPosContemplacao === r.mesesRestantesContrato, 'sem lance, o prazo restante deve permanecer igual ao contrato');
      checar(r.Nefetivo === r.N, 'sem lance, o prazo total não pode diminuir');
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

const telaCalc = activeCalc();
const activeInput = {
  credito: 100000, prazo: 120, taPct: 20, frPct: 2, seguroPct: 0,
  inccPct: 5, mesContemplacao: 24, tipoBem: 'auto', redutorPct: 50,
  adesaoPct: 0, adesaoForma: 'avista', dinheiro: 0, embutido: 0,
  formaRestante: 'parcelas'
};
const semLance = telaCalc(activeInput);
const comLance = telaCalc({ ...activeInput, dinheiro: 30000, embutido: 10 });
checar(semLance.parcelasPagasAntesContemplacao === 23, 'a parcela da contemplação não pode ser contada como paga antes do evento');
checar(semLance.parcelaMinima === comLance.parcelaMinima, 'o piso deve ser independente de parcelas pagas e lance');
checar(Math.abs(semLance.parcelaMinima - semLance.saldoDevedorInicial * semLance.percentualPos) < 0.0001, 'o piso deve usar o saldo devedor inicial');
checar(semLance.parcelaPos >= semLance.parcelaMinima + semLance.diferencaDiluida - 0.0001, 'a parcela pós deve respeitar o piso mínimo mais diferença mensal');
checar(semLance.saldoDevedorInicial > semLance.saldoDevedorAntesLance, 'o saldo após pagamentos deve ser menor que o saldo inicial');
const parcelaComLance = telaCalc({ ...activeInput, dinheiro: 1000, formaRestante: 'parcelas' });
const prazoComLance = telaCalc({ ...activeInput, dinheiro: 10000, formaRestante: 'prazo' });
checar(parcelaComLance.mesesPosContemplacao === parcelaComLance.mesesRestantesContrato, 'abatimento na parcela deve manter o prazo');
checar(parcelaComLance.parcelaPos <= semLance.parcelaPos, 'abatimento na parcela não deve aumentar o valor mensal');
const parcelaNoPiso = telaCalc({ ...activeInput, dinheiro: 10000, formaRestante: 'parcelas' });
checar(parcelaNoPiso.parcelaPos >= parcelaNoPiso.parcelaMinima, 'abatimento na parcela deve respeitar o piso');
checar(parcelaNoPiso.parcelaPos >= parcelaNoPiso.parcelaMinimaComDiferenca, 'abatimento na parcela deve respeitar o piso mais a diferença mensal');
checar(parcelaComLance.parcelaPos >= parcelaComLance.parcelaMinimaComDiferenca, 'abatimento na parcela deve preservar o piso efetivo');
checar(prazoComLance.mesesPosContemplacao < prazoComLance.mesesRestantesContrato, 'abatimento no prazo deve reduzir meses');
const primeiraContemplacao = telaCalc({ ...activeInput, mesContemplacao: 1, adesaoPct: 2, formaRestante: 'prazo' });
checar(primeiraContemplacao.primeiraParcela > primeiraContemplacao.parcelaReduzida, 'a primeira parcela deve incluir a adesão');
checar(primeiraContemplacao.valorParcelasAntesContemplacao === primeiraContemplacao.primeiraParcela, 'a primeira parcela deve ser paga na contemplação do mês 1');
const segundaContemplacao = telaCalc({ ...activeInput, mesContemplacao: 2, adesaoPct: 2, formaRestante: 'prazo' });
const decimaContemplacao = telaCalc({ ...activeInput, mesContemplacao: 10, adesaoPct: 2, formaRestante: 'prazo' });
checar(segundaContemplacao.valorParcelasPagasAntes >= segundaContemplacao.primeiraParcela, 'o primeiro mês deve ser pago antes da contemplação no mês 2');
checar(decimaContemplacao.valorParcelasPagasAntes >= decimaContemplacao.primeiraParcela, 'o primeiro mês deve ser pago antes de qualquer contemplação posterior');

if (falhas > 0) {
  console.error(`\n${falhas} falha(s) encontrada(s).`);
  process.exit(1);
}
console.log('Regressões do cálculo ativo passaram.');
