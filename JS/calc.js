/**
 * js/calc.js — lógica de cálculo do Simulador de Consórcio.
 *
 * Função pura: recebe um objeto de entradas (strings ou números, como viriam
 * de um formulário) e devolve um objeto de resultados. Não toca no DOM, o
 * que permite rodar tanto no navegador (via <script>) quanto no Node
 * (require), sem duplicar a lógica entre app e testes.
 *
 * input esperado:
 * {
 *   credito, prazo, taPct, frPct, seguroPct, mesContemplacao,
 *   tipoBemPct,        // '0.5' | '1' | '-1' (personalizado)
 *   minCustomPct,       // usado quando tipoBemPct === '-1'
 *   redutorPct,         // '0' | '25' | '50' | '-1' (personalizado)
 *   redutorCustomPct,   // usado quando redutorPct === '-1'
 *   embutidoPct, dinheiroPct, usarLance,
 *   formaRestante,      // 'parcelas' | 'prazo'
 *   adesaoPct, adesaoForma, adesaoMeses
 * }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimuladorCalc = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function calc(input) {
    input = input || {};

    const credito = parseFloat(input.credito) || 0;
    let N = parseInt(input.prazo, 10) || 1;
    if (N < 1) N = 1;
    const taPct = parseFloat(input.taPct) || 0;
    const frPct = parseFloat(input.frPct) || 0;
    let seguroPct = parseFloat(input.seguroPct) || 0;
    if (seguroPct < 0.06) seguroPct = 0.06;
    if (seguroPct > 0.075) seguroPct = 0.075;
    const totalSeguroPct = seguroPct * N;
    const seguroMensal = ((totalSeguroPct / 100) * credito) / N;
    const seguro = seguroMensal;

    let redutorPct = parseFloat(input.redutorPct);
    if (redutorPct === -1) {
      redutorPct = parseFloat(input.redutorCustomPct) || 0;
    }
    redutorPct = Math.min(Math.max(redutorPct, 0), 95);

    let k = parseInt(input.mesContemplacao, 10) || 1;
    if (k < 1) k = 1;
    if (k > N) k = N;

    const embutidoPct = Math.min(Math.max(parseFloat(input.embutidoPct) || 0, 0), 100);
    const dinheiroPct = Math.min(Math.max(parseFloat(input.dinheiroPct) || 0, 0), 100);
    const usarLance = !!input.usarLance;
    const formaRestante = input.formaRestante === 'prazo' ? 'prazo' : 'parcelas';

    const adesaoPct = Math.min(Math.max(parseFloat(input.adesaoPct) || 0, 0), taPct);
    const adesaoForma = input.adesaoForma === 'diluida' ? 'diluida' : 'avista';
    let adesaoMeses = adesaoForma === 'avista' ? 1 : (parseInt(input.adesaoMeses, 10) || 1);
    if (adesaoMeses < 1) adesaoMeses = 1;
    if (adesaoMeses > N) adesaoMeses = N;

    const fundoComumMensal = credito / N;
    const taPctDiluida = Math.max(0, taPct - adesaoPct); // parte da TA que segue diluída no prazo todo
    const taMensal = credito * (taPctDiluida / 100) / N; // TA sempre sobre 100% do crédito, mesmo com redutor
    const frMensalCheio = credito * (frPct / 100) / N;

    const adesaoValor = credito * (adesaoPct / 100); // valor total da taxa de adesão antecipada
    const adesaoPorParcela = adesaoPct > 0 ? adesaoValor / adesaoMeses : 0;

    // Piso de parcela mínima por tipo de bem (ex: 0,5% do crédito para Imóvel, 1% para Automóvel)
    let pisoPct = parseFloat(input.tipoBemPct);
    if (pisoPct === -1) pisoPct = parseFloat(input.minCustomPct) || 0;
    const parcelaMinima = credito * (pisoPct / 100);

    const parcelaCheiaBruta = fundoComumMensal + taMensal + frMensalCheio + seguro;
    const parcelaCheia = Math.max(parcelaCheiaBruta, parcelaMinima);
    const pisoAtingido = parcelaCheia > parcelaCheiaBruta;

    // Com redutor: Fundo Comum e Fundo de Reserva são reduzidos na mesma proporção do redutor.
    // A Taxa de Administração continua incidindo sobre 100% do crédito.
    const fatorRedutor = 1 - redutorPct / 100;
    const fundoComumReduzido = fundoComumMensal * fatorRedutor;
    const frReduzido = frMensalCheio * fatorRedutor;
    const parcelaReduzidaBruta = fundoComumReduzido + taMensal + frReduzido + seguro;
    const parcelaReduzida = parcelaReduzidaBruta;

    // Diferença acumulada = o que faltou recolher em Fundo Comum + Fundo de Reserva durante os meses com redutor antes da contemplação.
    const diferencaAcumulada = Math.max(0, ((fundoComumMensal + frMensalCheio) - (fundoComumReduzido + frReduzido)) * k);
    const valorEmbutido = credito * (embutidoPct / 100);
    const valorDinheiro = credito * (dinheiroPct / 100);
    const totalLance = valorEmbutido + valorDinheiro;

    const lanceParaDeficit = usarLance ? Math.min(valorDinheiro, diferencaAcumulada) : 0;
    const coberturaDeficit = lanceParaDeficit;
    const restante = Math.max(0, diferencaAcumulada - coberturaDeficit);

    const creditoLiquido = Math.max(0, credito - valorEmbutido);
    const principalPagoAntesContem = fundoComumReduzido * k;
    const saldoDevedorAntesLance = Math.max(0, creditoLiquido - principalPagoAntesContem);
    const lanceSobressalente = usarLance ? Math.max(0, valorDinheiro - lanceParaDeficit) : 0;
    const lanceDinheiroAbateSaldo = Math.min(lanceSobressalente, saldoDevedorAntesLance);
    const saldoDevedor = Math.max(0, saldoDevedorAntesLance - lanceDinheiroAbateSaldo);

    const mesesRestantesPos = Math.max(0, N - k);
    let mesesExtras = 0;
    let parcelaPos = parcelaCheia;
    let Nefetivo = N;
    let extraDiluicao = 0;

    // Saldo efetivo a quitar após a contemplação.
    // saldoDevedor: crédito remanescente após os pagamentos reduzidos até o mês de contemplação.
    // restante: diferença do redutor ainda não coberta pelo lance.
    const saldoTotal = saldoDevedor + restante;

    if (saldoTotal > 0) {
      if (formaRestante === 'parcelas') {
        if (mesesRestantesPos > 0) {
          // Mantém o prazo original e reduz a parcela pós-contemplação.
          extraDiluicao = restante / mesesRestantesPos;
          parcelaPos = Math.max(parcelaMinima, parcelaCheia - extraDiluicao);
          Nefetivo = N;
        } else {
          // Se não há prazo restante, paga o saldo com parcelas extras no valor cheio.
          parcelaPos = parcelaCheia;
          mesesExtras = Math.max(1, Math.ceil(restante / parcelaCheia));
          Nefetivo = N + mesesExtras;
        }
      } else {
        // Prazo: mantém a parcela cheia e reduz o prazo remanescente.
        parcelaPos = parcelaCheia;
        const mesesReduzidos = Math.min(mesesRestantesPos, Math.ceil(restante / parcelaCheia));
        Nefetivo = Math.max(k, N - mesesReduzidos);
      }
    } else {
      parcelaPos = parcelaCheia;
      Nefetivo = N;
    }

    const outflow = new Array(Nefetivo + 1).fill(0);
    for (let t = 1; t <= Nefetivo; t++) {
      const extraAdesao = t <= adesaoMeses ? adesaoPorParcela : 0;
      if (t < k) outflow[t] = parcelaReduzida + extraAdesao;
      else if (t === k) outflow[t] = parcelaReduzida + valorDinheiro + extraAdesao;
      else outflow[t] = parcelaPos + extraAdesao;
    }
    const inflow = new Array(Nefetivo + 1).fill(0);
    inflow[k] += creditoLiquido;

    let totalPago = 0;
    for (let t = 1; t <= Nefetivo; t++) totalPago += outflow[t];
    const custoTotal = totalPago - creditoLiquido;
    const custoTotalPct = creditoLiquido > 0 ? (custoTotal / creditoLiquido * 100) : null;

    function npv(r) {
      let s = 0;
      for (let t = 1; t <= Nefetivo; t++) {
        s += (inflow[t] - outflow[t]) / Math.pow(1 + r, t);
      }
      return s;
    }
    let taxaAnual = null;
    let lo = -0.9, hi = 5;
    let flo = npv(lo), fhi = npv(hi);
    if (flo * fhi <= 0) {
      let mid = 0;
      for (let i = 0; i < 200; i++) {
        mid = (lo + hi) / 2;
        const fm = npv(mid);
        if (Math.abs(fm) < 1e-6) break;
        if ((flo < 0) === (fm < 0)) { lo = mid; flo = fm; } else { hi = mid; fhi = fm; }
      }
      taxaAnual = (Math.pow(1 + mid, 12) - 1) * 100;
    }

    return {
      N, Nefetivo, k, credito, creditoLiquido, taPct, taMensal, frMensalCheio, frReduzido, seguro,
      fundoComumMensal, fundoComumReduzido, parcelaReduzida, parcelaCheia, parcelaPos,
      diferencaAcumulada, coberturaDeficit, restante, saldoDevedor, extraDiluicao, mesesExtras, formaRestante,
      adesaoPct, adesaoValor, adesaoPorParcela, adesaoMeses, adesaoForma,
      parcelaMinima, pisoAtingido,
      totalLance, valorEmbutido, valorDinheiro,
      totalPago, custoTotal, custoTotalPct, taxaAnual, outflow
    };
  }

  return { calc: calc };
}));
