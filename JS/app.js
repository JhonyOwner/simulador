/**
 * js/app.js — camada de UI do Simulador de Consórcio.
 * Depende de js/calc.js (SimuladorCalc.calc) já carregado antes deste arquivo.
 */
(function () {
  'use strict';

  function fmtBRL(v) {
    if (!isFinite(v)) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }
  function fmtPct(v, d) {
    d = d === undefined ? 2 : d;
    if (v === null || !isFinite(v)) return '—';
    return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
  }

  const $id = id => document.getElementById(id);
  const els = {
    loadExample: $id('loadExample'),
    calcForm: $id('calcForm'),
    credito: $id('credito'), prazo: $id('prazo'), ta: $id('ta'), fr: $id('fr'), seguroPct: $id('seguroPct'),
    mesContemplacao: $id('mesContemplacao'), tipoBem: $id('tipoBem'), minCustom: $id('minCustom'), minCustomField: $id('minCustomField'),
    redutorCustomField: $id('redutorCustomField'), redutorCustom: $id('redutorCustom'),
    adesaoMesesField: $id('adesaoMesesField'), adesaoMeses: $id('adesaoMeses'), adesaoPct: $id('adesaoPct'),
    embutido: $id('embutido'), dinheiro: $id('dinheiro'), usarLance: $id('usarLance')
  };

  const $resultsOverlay = $id('resultsOverlay');
  const $btnCloseModal = $id('btnCloseModal');
  const $btnShowResults = $id('btnShowResults');

  // ---- Leitura do formulário -> objeto de entrada puro para SimuladorCalc.calc ----
  function readInputs() {
    return {
      credito: els.credito.value,
      prazo: els.prazo.value,
      taPct: els.ta.value,
      frPct: els.fr.value,
      seguroPct: els.seguroPct.value,
      mesContemplacao: els.mesContemplacao.value,
      tipoBemPct: els.tipoBem.value,
      minCustomPct: els.minCustom ? els.minCustom.value : 0,
      redutorPct: document.querySelector('input[name="redutor"]:checked').value,
      redutorCustomPct: els.redutorCustom ? els.redutorCustom.value : 0,
      embutidoPct: els.embutido.value,
      dinheiroPct: els.dinheiro.value,
      usarLance: els.usarLance ? els.usarLance.checked : false,
      formaRestante: document.querySelector('input[name="restante"]:checked').value,
      adesaoPct: els.adesaoPct.value,
      adesaoForma: document.querySelector('input[name="adesaoForma"]:checked').value,
      adesaoMeses: els.adesaoMeses ? els.adesaoMeses.value : 1
    };
  }

  els.loadExample && els.loadExample.addEventListener('click', () => {
    els.credito.value = 120000;
    els.prazo.value = 240;
    els.ta.value = 22;
    els.fr.value = 2;
    els.seguroPct.value = 0.065; // 0,065% ao mês — dentro do range 0,06–0,075 do campo. Era 0.65 (10x maior que o permitido).
    els.mesContemplacao.value = 30;
    document.querySelector('input[name="redutor"][value="50"]').checked = true;
    els.adesaoPct.value = 2;
    document.querySelector('input[name="adesaoForma"][value="avista"]').checked = true;
    els.embutido.value = 0;
    els.dinheiro.value = 0;
    els.redutorCustomField && (els.redutorCustomField.style.display = 'none');
    els.adesaoMesesField && (els.adesaoMesesField.style.display = 'none');
    handleFormEvent();
  });

  // ---- Visibilidade de campos condicionais (barato — roda a cada input/change) ----
  function updateFieldVisibility() {
    const redSel = document.querySelector('input[name="redutor"]:checked').value === '-1';
    els.redutorCustomField && (els.redutorCustomField.style.display = redSel ? 'flex' : 'none');
    const dil = document.querySelector('input[name="adesaoForma"]:checked').value === 'diluida';
    els.adesaoMesesField && (els.adesaoMesesField.style.display = dil ? 'flex' : 'none');
    els.minCustomField && (els.minCustomField.style.display = els.tipoBem.value === '-1' ? 'flex' : 'none');
  }

  // ---- Debounce do cálculo pesado (chart + ~30 escritas no DOM + busca da TIR) ----
  let calcTimer = null;
  function scheduleCalc(delay) {
    clearTimeout(calcTimer);
    calcTimer = setTimeout(calcAndRender, delay === undefined ? 150 : delay);
  }

  function isModalOpen() {
    return !!($resultsOverlay && $resultsOverlay.classList.contains('active'));
  }

  function handleFormEvent() {
    updateFieldVisibility();
    // Só recalcula/renderiza de fato se o popup de resultados estiver aberto —
    // evita ~30 escritas de DOM + redesenho do gráfico a cada tecla digitada
    // enquanto o usuário ainda está preenchendo o formulário.
    if (isModalOpen()) scheduleCalc();
  }

  const form = els.calcForm || document.querySelector('#calcForm');
  form && form.addEventListener('input', handleFormEvent);
  form && form.addEventListener('change', handleFormEvent);
  form && form.addEventListener('click', (e) => { if (e.target && e.target.type === 'radio') handleFormEvent(); });

  function drawChart(res) {
    const canvas = $id('chart');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const vals = res.outflow.slice(1);
    const maxV = Math.max(...vals, 1);
    const padL = 6, padR = 6, padT = 10, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    ctx.strokeStyle = 'rgba(34,27,16,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - padB);
    ctx.lineTo(W - padR, H - padB);
    ctx.stroke();

    const kx = padL + (res.k - 1) / (res.Nefetivo - 1 || 1) * plotW;
    ctx.strokeStyle = '#B98A2E';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(kx, padT);
    ctx.lineTo(kx, H - padB);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#B98A2E';
    ctx.font = '10px monospace';
    ctx.fillText('contemplação', Math.min(kx + 4, W - 90), padT + 10);

    ctx.strokeStyle = '#0F2438';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < vals.length; i++) {
      const x = padL + i / (res.Nefetivo - 1 || 1) * plotW;
      const y = H - padB - (vals[i] / maxV) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(15,36,56,0.06)';
    ctx.lineTo(W - padR, H - padB);
    ctx.lineTo(padL, H - padB);
    ctx.closePath();
    ctx.fill();
  }

  function calcAndRender() {
    const r = SimuladorCalc.calc(readInputs());

    $id('headlineTag').textContent = r.seguro > 0 ? 'Com seguro' : 'Sem seguro';

    $id('headline1a').textContent = fmtBRL(r.outflow[1]);
    const adesaoAvistaAtiva = r.adesaoForma === 'avista' && r.adesaoValor > 0;
    $id('headline1aSub').textContent = adesaoAvistaAtiva
      ? `Parcela normal (inclui seguro, ${fmtBRL(r.parcelaReduzida)}) + taxa de adesão (${fmtBRL(r.adesaoValor)})`
      : '';

    const idxDemais = Math.min(2, r.Nefetivo);
    $id('headlineDemais').textContent = fmtBRL(r.outflow[idxDemais]);
    $id('headlineDemaisLabel').textContent = r.k <= idxDemais ? 'Demais parcelas (pós-contemplação)' : 'Demais parcelas (até a contemplação)';
    $id('headlineDemaisSub').textContent = `Parcela nº ${idxDemais} em diante (varia na contemplação e ao final da adesão)`;

    $id('preFundo').textContent = fmtBRL(r.fundoComumReduzido);
    $id('preTA').textContent = fmtBRL(r.taMensal);
    $id('preFR').textContent = fmtBRL(r.frReduzido);
    $id('preSeguro').textContent = fmtBRL(r.seguro);
    $id('preTotal').textContent = fmtBRL(r.parcelaReduzida);

    $id('posFundo').textContent = fmtBRL(r.fundoComumMensal);
    $id('posTA').textContent = fmtBRL(r.taMensal);
    $id('posFR').textContent = fmtBRL(r.frMensalCheio);
    $id('posDiluicao').textContent = r.extraDiluicao > 0 ? '+ ' + fmtBRL(r.extraDiluicao) : fmtBRL(0);
    $id('posTotal').textContent = fmtBRL(r.parcelaPos) + (r.pisoAtingido ? ' *' : '');

    $id('diferenca').textContent = fmtBRL(r.diferencaAcumulada);
    $id('coberta').textContent = fmtBRL(r.coberturaDeficit);
    if (r.formaRestante === 'prazo' && r.mesesExtras > 0) {
      $id('restanteVal').textContent = fmtBRL(r.restante) + ` (+${r.mesesExtras} parcela(s) ao final — prazo ${r.N} → ${r.Nefetivo} meses)`;
    } else if (r.extraDiluicao > 0) {
      $id('restanteVal').textContent = fmtBRL(r.restante) + ` (diluído: +${fmtBRL(r.extraDiluicao)}/mês)`;
    } else {
      $id('restanteVal').textContent = fmtBRL(r.restante);
    }
    $id('creditoLiquido').textContent = fmtBRL(r.creditoLiquido);

    const lanceInfo = r.formaRestante === 'prazo'
      ? `Utilizando o lance para abater no prazo: o que você já pagou e o lance reduzem o saldo devedor; a parcela pós-contemplação permanece em ${fmtBRL(r.parcelaPos)} e o prazo remanescente pode ser reduzido para ${r.Nefetivo - r.k} meses.`
      : `Utilizando o lance para abater na parcela: o que você já pagou e o lance reduzem o saldo devedor; a parcela pós-contemplação é ajustada para ${fmtBRL(r.parcelaPos)} mantendo o prazo original de ${r.N - r.k} meses remanescentes.`;
    $id('lanceInfo').textContent = lanceInfo;

    $id('adesaoTotal').textContent = fmtBRL(r.adesaoValor);
    if (r.adesaoValor <= 0) {
      $id('adesaoFormaLabel').textContent = 'Sem taxa de adesão antecipada';
      $id('adesaoValorParcela').textContent = fmtBRL(0);
    } else if (r.adesaoForma === 'avista') {
      $id('adesaoFormaLabel').textContent = 'Cobrada à vista, na 1ª parcela';
      $id('adesaoValorParcela').textContent = fmtBRL(r.adesaoValor);
    } else {
      $id('adesaoFormaLabel').textContent = `Diluída em ${r.adesaoMeses} parcelas`;
      $id('adesaoValorParcela').textContent = '+ ' + fmtBRL(r.adesaoPorParcela) + '/mês';
    }

    $id('statTotalPago').textContent = fmtBRL(r.totalPago);
    $id('statCusto').textContent = fmtBRL(r.custoTotal);
    $id('statCustoPct').textContent = fmtPct(r.custoTotalPct, 1);
    $id('statPrazo').textContent = `${r.Nefetivo} meses`;

    const taxaMensal = (r.taPct - r.adesaoPct) / r.N;
    const taxaInfo = taxaMensal * 12;
    $id('sealTaxa').textContent = r.taxaAnual !== null ? fmtPct(r.taxaAnual, 1) : fmtPct(taxaInfo, 2);
    const prazoTxt = r.Nefetivo > r.N
      ? `${r.Nefetivo} meses (prazo original de ${r.N} + ${r.Nefetivo - r.N} extras)`
      : (r.Nefetivo < r.N
        ? `${r.Nefetivo} meses (reduzido de ${r.N} meses)`
        : `${r.N} meses`);
    $id('sealText').textContent = r.taxaAnual !== null
      ? `Com esses parâmetros, o custo total do plano equivale a uma taxa aproximada de ${fmtPct(r.taxaAnual, 1)} ao ano sobre o crédito líquido de ${fmtBRL(r.creditoLiquido)}, pago ao longo de ${prazoTxt}.${r.pisoAtingido ? ' * A parcela pós-contemplação foi ajustada para a parcela mínima permitida.' : ''}`
      : `Taxa anual aproximada calculada: ${fmtPct(taxaInfo, 2)} (${fmtPct(taxaMensal, 3)}%/m).`;

    drawChart(r);
    return r;
  }

  // --- Modal (popup de resultados) ---
  function showResultsPanel() {
    if (!$resultsOverlay) return;
    clearTimeout(calcTimer);
    calcAndRender(); // sempre recalcula na hora de abrir, sem esperar o debounce
    $resultsOverlay.classList.add('active');
    $resultsOverlay.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }

  function closeResultsPanel() {
    if (!$resultsOverlay) return;
    $resultsOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  $btnShowResults && $btnShowResults.addEventListener('click', showResultsPanel);
  $btnCloseModal && $btnCloseModal.addEventListener('click', closeResultsPanel);
  $resultsOverlay && $resultsOverlay.addEventListener('click', (e) => {
    if (e.target === $resultsOverlay) closeResultsPanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isModalOpen()) closeResultsPanel();
  });

  updateFieldVisibility();

  // --- Resultados separados / exportação ---
  const $btnSeparate = $id('btnSeparate');
  const $separatedPanel = $id('separatedPanel');
  const $separatedResults = $id('separatedResults');
  const $btnCloseSeparated = $id('btnCloseSeparated');
  const $btnCopySeparated = $id('btnCopySeparated');
  const $btnExportJSON = $id('btnExportJSON');
  const $btnExportCSV = $id('btnExportCSV');
  const $btnExportOutflowCSV = $id('btnExportOutflowCSV');

  function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  function download(filename, text) {
    const a = document.createElement('a');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function currentResult() {
    return SimuladorCalc.calc(readInputs());
  }

  function flattenForCSV(obj) {
    const out = {};
    function rec(prefix, val) {
      if (val === null || val === undefined || typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') {
        out[prefix] = String(val);
      } else if (Array.isArray(val)) {
        out[prefix] = val.join(';');
      } else if (typeof val === 'object') {
        for (const k in val) rec(prefix ? prefix + '.' + k : k, val[k]);
      } else {
        out[prefix] = String(val);
      }
    }
    rec('', obj);
    return out;
  }

  $btnSeparate && $btnSeparate.addEventListener('click', () => {
    const r = currentResult();
    $separatedResults.textContent = JSON.stringify(r, null, 2);
    $separatedPanel.style.display = 'block';
  });

  $btnCloseSeparated && $btnCloseSeparated.addEventListener('click', () => {
    $separatedPanel.style.display = 'none';
  });

  $btnCopySeparated && $btnCopySeparated.addEventListener('click', async () => {
    const txt = JSON.stringify(currentResult(), null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      $btnCopySeparated.textContent = 'Copiado';
      setTimeout(() => $btnCopySeparated.textContent = 'Copiar', 1200);
    } catch (e) {
      alert('Não foi possível copiar — use o botão Exportar JSON.');
    }
  });

  $btnExportJSON && $btnExportJSON.addEventListener('click', () => {
    const r = currentResult();
    download(`simulacao-${timestamp()}.json`, JSON.stringify(r, null, 2));
  });

  $btnExportCSV && $btnExportCSV.addEventListener('click', () => {
    const r = currentResult();
    const flat = flattenForCSV(r);
    const keys = Object.keys(flat);
    const header = keys.map(k => `"${k.replace(/"/g, '""')}"`).join(',');
    const row = keys.map(k => `"${String(flat[k]).replace(/"/g, '""')}"`).join(',');
    download(`simulacao-${timestamp()}.csv`, header + '\n' + row);
  });

  $btnExportOutflowCSV && $btnExportOutflowCSV.addEventListener('click', () => {
    const rows = ['mes;parcela'];
    currentResult().outflow.slice(1).forEach((v, i) => rows.push(`${i + 1};${v}`));
    download(`outflow-${timestamp()}.csv`, rows.join('\n'));
  });
})();
