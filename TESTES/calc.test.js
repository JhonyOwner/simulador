const assert = require('node:assert/strict');
const { calculate, buildProjection, calculateYield } = require('../JS/calc.js');
const close = (actual, expected) => assert(Math.abs(actual - expected) < 0.000001);

const example = {
  credit: 1000000,
  adminPct: 20,
  adhesionPct: 2,
  reservePct: 2,
  term: 240,
  paidBefore: 10,
  redutor: 50,
  assetType: 'imovel',
  bidOwn: 250000,
  mode: 'prazo'
};

const result = calculate(example);
assert.equal(result.netAdminPct, 18);
assert.deepEqual(result.plans.map(plan => plan.debt), [1200000, 945000, 690000]);
assert.deepEqual(result.plans.map(plan => plan.installment), [5000, 3937.5, 2875]);
assert.deepEqual(result.plans.map(plan => plan.adhesion), [25000, 23937.5, 22875]);
assert.deepEqual(result.postPlans.map(plan => plan.balanceAfterBid), [950000, 695000, 440000]);
assert.deepEqual(result.postPlans.map(plan => plan.paidAmount), [70000, 59375, 48750]);
assert.deepEqual(result.postPlans.map(plan => plan.postBalance), [880000, 635625, 391250]);
assert.deepEqual(result.postPlans.map(plan => plan.minimumInstallment), [6000, 6000, 6000]);
assert.deepEqual(result.postPlans.map(plan => plan.realInstallment), [6000, 7062.5, 8125]);
assert.deepEqual(result.postPlans.map(plan => plan.monthsByTerm), [147, 125, 108]);
assert.deepEqual(result.postPlans.map(plan => plan.installmentBalance), [880000, 890625, 901250]);
assert.deepEqual(result.postPlans.map(plan => plan.monthsByInstallment), [147, 148, 150]);

const autoFloor = calculate({ ...example, assetType: 'auto' });
assert.equal(autoFloor.minimumInstallment, 12000);
const noAdhesion = calculate({ credit: 100000, term: 100, paidBefore: 10, assetType: 'imovel' });
assert.equal(noAdhesion.selected.paidAmount, 10000);
assert.equal(noAdhesion.selected.postBalance, 90000);

const dilutedAdhesion = calculate({ ...example, adhesionMode: 'diluida', adhesionMonths: 12 });
const dilutedFull = dilutedAdhesion.postPlans[0];
const diluted25 = dilutedAdhesion.postPlans[1];
const dilutedSelected = dilutedAdhesion.selected;
assert.equal(dilutedAdhesion.adhesionMode, 'diluida');
close(dilutedAdhesion.adhesionPerMonth, 20000 / 12);
close(dilutedFull.firstInstallment, 5000 + 20000 / 12);
close(dilutedFull.paidAmount, 10 * (5000 + 20000 / 12));
close(diluted25.paidAmount, 10 * (3937.5 + 20000 / 12));
const dilutedProjection = buildProjection(dilutedAdhesion, 0);
close(dilutedProjection[9].payment, 2875 + 20000 / 12);
close(dilutedProjection[10].payment, dilutedSelected.realInstallment + 20000 / 12);
close(dilutedProjection[11].payment, dilutedSelected.realInstallment + 20000 / 12);
close(dilutedProjection[12].payment, dilutedSelected.realInstallment);

const projection = buildProjection(result, 5);
assert(projection.length >= result.totalMonths);
assert.equal(projection[10].phase, 'Contemplação');
assert.equal(projection.at(-1).balance, 0);
assert(projection[12].adjustedCredit > projection[11].adjustedCredit);

const finalPaymentProjection = buildProjection({
  selected: { debt: 2500, differenceTotal: 0, differencePaidBefore: 0, realInstallment: 1200 },
  mode: 'prazo',
  totalMonths: 2,
  paidBefore: 0,
  bidTotal: 0,
  adhesionMode: 'avista',
  adhesionPct: 0,
  adhesionMonths: 1,
  credit: 2500
}, 0);
assert.deepEqual(finalPaymentProjection.map(row => row.payment), [1200, 1200, 100]);
assert.equal(finalPaymentProjection.at(-1).balance, 0);

const extendedPaymentProjection = buildProjection({
  selected: { debt: 4000, differenceTotal: 0, differencePaidBefore: 0, realInstallment: 1200 },
  mode: 'prazo',
  totalMonths: 2,
  paidBefore: 0,
  bidTotal: 0,
  adhesionMode: 'avista',
  adhesionPct: 0,
  adhesionMonths: 1,
  credit: 4000
}, 0);
assert.deepEqual(extendedPaymentProjection.map(row => row.payment), [1200, 1200, 1200, 400]);

const yieldResult = calculateYield(result.creditAfterBid, 1, 12);
assert.equal(yieldResult.base, 750000);
assert.equal(yieldResult.firstMonth, 7500);
assert(Math.abs(yieldResult.total - 845118.7726) < 0.01);

console.log('Cálculos do plano, amortização, projeção e rendimento passaram.');
