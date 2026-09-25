(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimuladorCalc = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function estimateMonths(balance, installment, paidBefore, adhesionMode, adhesionMonths, adhesionPerMonth) {
    let remaining = Math.max(0, balance);
    let months = 0;
    while (remaining > 0.01 && months < 3600) {
      const contractMonth = paidBefore + months + 1;
      const adhesion = adhesionMode === 'diluida' && contractMonth <= adhesionMonths
        ? adhesionPerMonth
        : 0;
      const payment = Math.max(0, installment + adhesion);
      if (payment === 0) return 3600;
      remaining = Math.max(0, remaining - payment);
      months += 1;
    }
    return months;
  }

  function calculate(input) {
    input = input || {};

    const credit = Math.max(0, number(input.credit, 0));
    const term = Math.max(1, Math.floor(number(input.term, 1)));
    const grossAdminPct = Math.max(0, number(input.adminPct, 0));
    const adhesionPct = clamp(number(input.adhesionPct, 0), 0, grossAdminPct);
    const netAdminPct = grossAdminPct - adhesionPct;
    const reservePct = Math.max(0, number(input.reservePct, 0));
    const paidBefore = clamp(Math.floor(number(input.paidBefore, 0)), 0, term);
    const remainingTerm = Math.max(0, term - paidBefore);
    const redutor = clamp(number(input.redutor, 0), 0, 95);
    const assetType = input.assetType === 'auto' ? 'auto' : 'imovel';
    const minimumPct = assetType === 'auto' ? 1 : 0.5;
    const bidOwn = clamp(number(input.bidOwn, 0), 0, credit);
    const bidEmbedded = clamp(number(input.bidEmbedded, 0), 0, credit);
    const bidTotal = bidOwn + bidEmbedded;
    const mode = input.mode === 'parcelas' ? 'parcelas' : 'prazo';
    const adhesionMode = input.adhesionMode === 'diluida' ? 'diluida' : 'avista';
    const adhesionMonths = clamp(Math.floor(number(input.adhesionMonths, 1)), 1, term);
    const adhesionBase = credit * adhesionPct / 100;
    const adhesionPerMonth = adhesionMode === 'diluida' && adhesionPct > 0
      ? adhesionBase / adhesionMonths
      : 0;

    function planFor(percent) {
      const factor = 1 - percent / 100;
      const commonFund = credit * factor;
      const reserveFund = credit * reservePct / 100 * factor;
      const adminFee = credit * netAdminPct / 100;
      const debt = commonFund + reserveFund + adminFee;
      const installment = debt / term;
      const adhesion = adhesionMode === 'avista' && adhesionPct > 0
        ? adhesionBase + installment
        : adhesionBase;
      const firstInstallment = adhesionMode === 'avista' && adhesionPct > 0
        ? adhesion
        : installment + adhesionPerMonth;
      let paidAmount = 0;
      for (let month = 1; month <= paidBefore; month += 1) {
        if (adhesionMode === 'avista' && month === 1 && adhesionPct > 0) {
          paidAmount += adhesion;
        } else {
          paidAmount += installment;
          if (adhesionMode === 'diluida' && month <= adhesionMonths) {
            paidAmount += adhesionPerMonth;
          }
        }
      }
      const adhesionPaidBefore = adhesionMode === 'avista'
        ? (paidBefore > 0 ? adhesionBase : 0)
        : adhesionPerMonth * Math.min(paidBefore, adhesionMonths);
      const adhesionRemaining = Math.max(0, adhesionBase - adhesionPaidBefore);
      const bidApplied = Math.min(bidTotal, debt);
      const balanceAfterBid = Math.max(0, debt - bidApplied);
      const postBalance = Math.max(0, balanceAfterBid - paidAmount);

      return {
        redutor: percent,
        factor,
        commonFund,
        reserveFund,
        adminFee,
        debt,
        installment,
        adhesion,
        adhesionBase,
        adhesionPerMonth,
        adhesionPaidBefore,
        adhesionRemaining,
        firstInstallment,
        paidAmount,
        balanceAfterBid,
        postBalance,
        bidApplied
      };
    }

    const plans = [0, 25, 50].map(planFor);
    const fullPlan = plans[0];
    const minimumInstallment = fullPlan.debt * minimumPct / 100;
    const bidForFullPlan = fullPlan.bidApplied;
    const fullPostBalance = Math.max(0, fullPlan.debt - bidForFullPlan - fullPlan.paidAmount);

    const postPlans = plans.map(plan => {
      const differenceTotal = Math.max(0, fullPostBalance - plan.postBalance);
      const differencePerMonth = remainingTerm > 0 ? differenceTotal / remainingTerm : 0;
      const differencePaidBefore = Math.max(0, fullPlan.installment - plan.installment) * paidBefore;
      const installmentByTerm = remainingTerm > 0
        ? plan.postBalance / remainingTerm
        : plan.postBalance;
      const realInstallment = Math.max(minimumInstallment, installmentByTerm) + differencePerMonth;
      const fullBalanceBeforeBid = Math.max(0, fullPlan.debt - plan.paidAmount);
      const lanceAgainstFullBalance = Math.min(bidTotal, fullBalanceBeforeBid);
      const termBalance = Math.max(0, fullBalanceBeforeBid - lanceAgainstFullBalance);
      const installmentBalance = termBalance;
      const monthsByTerm = estimateMonths(
        termBalance,
        realInstallment,
        paidBefore,
        adhesionMode,
        adhesionMonths,
        adhesionPerMonth
      );
      const monthsByInstallment = estimateMonths(
        installmentBalance,
        minimumInstallment,
        paidBefore,
        adhesionMode,
        adhesionMonths,
        adhesionPerMonth
      );

      return {
        ...plan,
        differenceTotal,
        differencePerMonth,
        differencePaidBefore,
        installmentByTerm,
        realInstallment,
        minimumInstallment,
        termBalance,
        installmentBalance,
        monthsByTerm,
        monthsByInstallment
      };
    });

    const selected = postPlans.find(plan => plan.redutor === redutor) || postPlans[0];
    const monthsAfter = mode === 'prazo' ? selected.monthsByTerm : selected.monthsByInstallment;
    const postInstallment = mode === 'prazo' ? selected.realInstallment : minimumInstallment;
    const postBalance = mode === 'prazo' ? selected.termBalance : selected.installmentBalance;
    const totalMonths = paidBefore + monthsAfter;
    const creditAfterBid = Math.max(0, credit - bidTotal);

    return {
      credit,
      term,
      grossAdminPct,
      adhesionPct,
      netAdminPct,
      reservePct,
      paidBefore,
      remainingTerm,
      redutor,
      assetType,
      minimumPct,
      minimumInstallment,
      bidOwn,
      bidEmbedded,
      bidTotal,
      creditAfterBid,
      mode,
      adhesionMode,
      adhesionMonths,
      adhesionBase,
      adhesionPerMonth,
      plans,
      postPlans,
      selected,
      monthsAfter,
      postInstallment,
      postBalance,
      totalMonths
    };
  }

  function buildProjection(result, annualRatePct) {
    const rate = Math.max(0, number(annualRatePct, 0)) / 100;
    const rows = [];
    const scenario = result.selected;
    const mode = result.mode;
    const plannedMonths = Math.max(1, result.totalMonths);
    const maxMonths = Math.min(3600, plannedMonths + 120);
    let factor = 1;
    let balance = result.plans[0].debt;
    let adjustedCredit = result.credit;

    for (let month = 1; month <= maxMonths && (month <= plannedMonths || balance > 0.01); month += 1) {
      if (month > 1 && (month - 1) % 12 === 0) {
        factor *= 1 + rate;
        balance *= 1 + rate;
        adjustedCredit *= 1 + rate;
      }

      let phase = 'Antes da contemplação';
      let bid = 0;
      let payment = 0;

      if (month <= result.paidBefore) {
        if (result.adhesionMode === 'avista' && month === 1 && result.adhesionPct > 0) {
          payment = scenario.firstInstallment * factor;
        } else {
          const adhesionPayment = result.adhesionMode === 'diluida' && month <= result.adhesionMonths
            ? scenario.adhesionPerMonth
            : 0;
          payment = (scenario.installment + adhesionPayment) * factor;
        }
      } else {
        if (month === result.paidBefore + 1) {
          phase = 'Contemplação';
          bid = Math.min(result.bidTotal, balance);
          balance = Math.max(0, balance - bid);
          adjustedCredit = Math.max(0, adjustedCredit - bid);
        } else {
          phase = 'Pós-contemplação';
        }

        const baseInstallment = mode === 'prazo'
          ? scenario.realInstallment
          : result.minimumInstallment;
        const adhesionPayment = result.adhesionMode === 'diluida' && month <= result.adhesionMonths
          ? scenario.adhesionPerMonth * factor
          : 0;
        payment = baseInstallment * factor + adhesionPayment;
      }

      payment = Math.min(balance, Math.max(0, payment));
      balance = Math.max(0, balance - payment);
      rows.push({
        month,
        phase,
        factor,
        adjustedCredit,
        balance,
        payment,
        bid
      });
    }

    return rows;
  }

  function calculateYield(creditAfterBid, monthlyRatePct, months) {
    const base = Math.max(0, number(creditAfterBid, 0));
    const rate = Math.max(0, number(monthlyRatePct, 0)) / 100;
    const term = Math.max(0, Math.floor(number(months, 0)));
    return {
      base,
      firstMonth: base * rate,
      total: base * Math.pow(1 + rate, term),
      months: term
    };
  }

  return { calculate, buildProjection, calculateYield };
}));
