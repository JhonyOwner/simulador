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
      if (formaRestante === 'parcelas') {
        checar(r.mesesPosContemplacao === r.mesesRestantesContrato, 'abatimento na parcela deve manter os meses restantes');
        checar(r.Nefetivo === r.N, 'abatimento na parcela deve manter o prazo total');
      } else {
        checar(r.mesesPosContemplacao < r.mesesRestantesContrato, 'abatimento no prazo deve reduzir os meses restantes');
        checar(r.Nefetivo <= r.N, 'o prazo total não pode aumentar quando há lance');
      }
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
const exemploPlanilha = telaCalc({
  credito: 1000000, prazo: 240, taPct: 18, frPct: 2, seguroPct: 0,
  inccPct: 5, mesContemplacao: 30, tipoBem: 'auto', redutorPct: 0,
  adesaoPct: 2.5, adesaoForma: 'avista', dinheiro: 0, embutido: 0,
  formaRestante: 'parcelas'
});
const valoresPlanilha = [
  { fundoComum: 1000000, fundoReserva: 20000, saldoDevedor: 1200000, adesao: 25000, parcela: 5000 },
  { fundoComum: 750000, fundoReserva: 15000, saldoDevedor: 945000, adesao: 23937.5, parcela: 3937.5 },
  { fundoComum: 500000, fundoReserva: 10000, saldoDevedor: 690000, adesao: 22875, parcela: 2875 }
];
exemploPlanilha.comparativoPlanilha.forEach((cenario, indice) => {
  const esperado = valoresPlanilha[indice];
  Object.entries(esperado).forEach(([campo, valor]) => {
    checar(Math.abs(cenario[campo] - valor) < 0.01, `planilha ${cenario.redutor}%: ${campo} deveria ser ${valor}`);
  });
});
const activeInput = {
  credito: 100000, prazo: 120, taPct: 20, frPct: 2, seguroPct: 0,
  inccPct: 5, mesContemplacao: 24, tipoBem: 'auto', redutorPct: 50,
  adesaoPct: 0, adesaoForma: 'avista', dinheiro: 0, embutido: 0,
  formaRestante: 'parcelas'
};
const semLance = telaCalc(activeInput);
const comLance = telaCalc({ ...activeInput, dinheiro: 30000, embutido: 10 });
const semLanceImovel = telaCalc({ ...activeInput, tipoBem: 'imovel' });
checar(semLance.parcelasPagasAntesContemplacao === 23, 'a parcela da contemplação não pode ser contada como paga antes do evento');
checar(semLance.parcelaMinima === comLance.parcelaMinima, 'o piso deve ser independente de parcelas pagas e lance');
checar(Math.abs(semLance.parcelaMinima - semLance.saldoDevedorInicial * semLance.percentualPos) < 0.0001, 'o piso deve usar o saldo inicial com taxas');
checar(Math.abs(semLance.parcelaMinima - 1220) < 0.01, 'o piso de automóvel deve ser 1% do saldo inicial com taxas');
checar(Math.abs(semLanceImovel.parcelaMinima - 610) < 0.01, 'o piso de imóvel deve ser 0,5% do saldo inicial com taxas');
checar(semLance.parcelaPos >= semLance.parcelaMinima - 0.0001, 'a parcela no modo parcela deve respeitar o piso mínimo');
checar(semLance.parcelaMinimaComDiferenca >= semLance.parcelaMinima, 'a parcela real deve incorporar a diferença mensal sem reduzir o piso');
checar(semLance.saldoDevedorInicial > semLance.saldoDevedorAntesLance, 'o saldo após pagamentos deve ser menor que o saldo inicial');
const parcelaComLance = telaCalc({ ...activeInput, tipoBem: 'imovel', dinheiro: 10000, formaRestante: 'parcelas' });
const prazoComLance = telaCalc({ ...activeInput, dinheiro: 10000, formaRestante: 'prazo' });
checar(parcelaComLance.mesesPosContemplacao >= 1, 'o modo parcela deve produzir pelo menos um mês de amortização');
checar(parcelaComLance.parcelaPos === parcelaComLance.parcelaMinima, 'modo parcela deve manter a prestação no piso mínimo');
checar(parcelaComLance.mesesPosContemplacao < semLanceImovel.mesesPosContemplacao, 'lance deve reduzir os meses no modo parcela');
checar(prazoComLance.parcelaPos > semLanceImovel.parcelaPos, 'abatimento no prazo deve recalcular e aumentar o valor mensal');
const parcelaNoPiso = telaCalc({ ...activeInput, dinheiro: 10000, formaRestante: 'parcelas' });
checar(parcelaNoPiso.parcelaPos >= parcelaNoPiso.parcelaMinima, 'abatimento na parcela deve respeitar o piso');
checar(parcelaNoPiso.parcelaPos === parcelaNoPiso.parcelaMinima, 'modo parcela deve manter a prestação no piso');
checar(parcelaComLance.parcelaPos === parcelaComLance.parcelaMinima, 'modo parcela deve preservar o piso efetivo');
checar(prazoComLance.mesesPosContemplacao < prazoComLance.mesesRestantesContrato, 'abatimento no prazo deve reduzir meses');
const pisoComExcesso = telaCalc({
  credito: 200000, prazo: 240, taPct: 22, frPct: 2, seguroPct: 0,
  inccPct: 5, mesContemplacao: 10, tipoBem: 'imovel', redutorPct: 50,
  adesaoPct: 2, adesaoForma: 'avista', dinheiro: 0, embutido: 25,
  formaRestante: 'parcelas'
});
checar(pisoComExcesso.pisoBloqueouReducao, 'o cenário do piso deveria ser identificado');
checar(pisoComExcesso.mesesPosContemplacao >= 1, 'o piso deve produzir um prazo pós válido');
checar(Math.abs(pisoComExcesso.parcelaPos - pisoComExcesso.parcelaMinima) < 0.0001, 'a parcela deve permanecer no piso mínimo');
const primeiraContemplacao = telaCalc({ ...activeInput, mesContemplacao: 1, adesaoPct: 2, formaRestante: 'prazo' });
checar(primeiraContemplacao.primeiraParcela > primeiraContemplacao.parcelaReduzida, 'a primeira parcela deve incluir a adesão');
checar(primeiraContemplacao.valorParcelasAntesContemplacao === primeiraContemplacao.primeiraParcela, 'a primeira parcela deve ser paga na contemplação do mês 1');
const segundaContemplacao = telaCalc({ ...activeInput, mesContemplacao: 2, adesaoPct: 2, formaRestante: 'prazo' });
const decimaContemplacao = telaCalc({ ...activeInput, mesContemplacao: 10, adesaoPct: 2, formaRestante: 'prazo' });
checar(segundaContemplacao.valorParcelasPagasAntes >= segundaContemplacao.primeiraParcela, 'o primeiro mês deve ser pago antes da contemplação no mês 2');
checar(decimaContemplacao.valorParcelasPagasAntes >= decimaContemplacao.primeiraParcela, 'o primeiro mês deve ser pago antes de qualquer contemplação posterior');

const amortizacaoBasica = telaCalc({
  credito: 71400, prazo: 20, taPct: 0, frPct: 0, seguroPct: 0,
  inccPct: 0, mesContemplacao: 6, tipoBem: 'auto', redutorPct: 0,
  adesaoPct: 0, adesaoForma: 'avista', dinheiro: 42300, embutido: 0,
  formaRestante: 'parcelas'
});
checar(Math.abs(amortizacaoBasica.saldoDevedorAntesLance - 53550) < 0.01, 'o cenário básico deve partir do saldo devedor de R$ 53.550');
checar(Math.abs(amortizacaoBasica.saldoDevedor - 11250) < 0.01, 'o lance de R$ 42.300 deve deixar R$ 11.250 de saldo');
checar(amortizacaoBasica.mesesPosContemplacao === 16, 'o saldo restante deve determinar os meses no modo parcela');
checar(Math.abs(amortizacaoBasica.parcelaPos - 714) < 0.01, 'a parcela no modo parcela deve respeitar o piso de 1% do saldo cheio');
checar(Math.abs(amortizacaoBasica.totalPagoPos - amortizacaoBasica.obrigacaoPos) < 0.01, 'os pagamentos pós-contemplação devem fechar o saldo após o lance');
checar(Math.abs(amortizacaoBasica.outflow.slice(amortizacaoBasica.k).reduce((s, valor) => s + valor, 0) - 11250) < 0.01, 'o fluxo real de parcelas deve fechar o saldo de R$ 11.250');
const amortizacaoComIndice = telaCalc({
  credito: 71400, prazo: 20, taPct: 0, frPct: 0, seguroPct: 0,
  inccPct: 15, mesContemplacao: 6, tipoBem: 'auto', redutorPct: 0,
  adesaoPct: 0, adesaoForma: 'avista', dinheiro: 42300, embutido: 0,
  formaRestante: 'parcelas'
});
checar(amortizacaoComIndice.parcelaPos === amortizacaoBasica.parcelaPos, 'INCC/IPCA não deve alterar a conta básica da parcela pós-contemplação');

const posPlanilha = telaCalc({
  credito: 1000000, prazo: 240, taPct: 18, frPct: 2, seguroPct: 0,
  inccPct: 5, mesContemplacao: 11, tipoBem: 'imovel', redutorPct: 50,
  adesaoPct: 2.5, adesaoForma: 'avista', dinheiro: 250000, embutido: 0,
  formaRestante: 'prazo'
});
const posEsperado = [
  { saldoDevedor: 1200000, saldoPosLance: 950000, valorParcelasPagasAntes: 70000, saldoPosPagamentos: 880000, parcelaMinima: 6000, parcelaPorPrazo: 3826.0869565, diferencaSaldo: 0, diferencaMensal: 0, parcelaReal: 6000, mesesPrazo: 147, saldoParcelas: 880000, mesesParcelas: 147 },
  { saldoDevedor: 945000, saldoPosLance: 695000, valorParcelasPagasAntes: 59375, saldoPosPagamentos: 635625, parcelaMinima: 6000, parcelaPorPrazo: 2763.5869565, diferencaSaldo: 244375, diferencaMensal: 1062.5, parcelaReal: 7062.5, mesesPrazo: 125, saldoParcelas: 890625, mesesParcelas: 148 },
  { saldoDevedor: 690000, saldoPosLance: 440000, valorParcelasPagasAntes: 48750, saldoPosPagamentos: 391250, parcelaMinima: 6000, parcelaPorPrazo: 1701.0869565, diferencaSaldo: 488750, diferencaMensal: 2125, parcelaReal: 8125, mesesPrazo: 108, saldoParcelas: 901250, mesesParcelas: 150 }
];
posPlanilha.comparativoPos.forEach((cenario, indice) => {
  Object.entries(posEsperado[indice]).forEach(([campo, valor]) => {
    checar(Math.abs(cenario[campo] - valor) < 0.01, `pós-planilha ${cenario.redutor}%: ${campo} deveria ser ${valor}`);
  });
});

if (falhas > 0) {
  console.error(`\n${falhas} falha(s) encontrada(s).`);
  process.exit(1);
}
console.log('Regressões do cálculo ativo passaram.');
