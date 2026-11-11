// Bank loans: four categories, one active loan per category, weekly repayment, early repayment discount.
import type { Game } from '../core/game';
import type { Loan } from '../core/types';
import { BIZ, CFG } from '../core/data';

export function loanDef(cat: string) { return BIZ.loans.find((l: any) => l.id === cat); }
export function loanRate(g: Game, cat: string) { return loanDef(cat).interest * g.diff.interestMult; }
export function canTake(g: Game, cat: string) { return !g.s.loans.some((l) => l.cat === cat); }
export function take(g: Game, cat: string): Loan | null {
  if (!canTake(g, cat)) return null;
  const d = loanDef(cat); const rate = loanRate(g, cat); const interestTotal = Math.round(d.amount * rate);
  const l: Loan = { id: g.uid('l'), cat, principal: d.amount, interestTotal, weekly: Math.ceil((d.amount + interestTotal) / d.weeks), weeksLeft: d.weeks, paid: 0, rate, nextDue: g.s.day + 7, missed: 0 };
  g.s.loans.push(l); g.addMoney(d.amount);
  g.s.stats.loansTaken = (g.s.stats.loansTaken ?? 0) + 1; g.s.chapterStats.loansTaken = (g.s.chapterStats.loansTaken ?? 0) + 1;
  g.emit('loans'); return l;
}
export function owed(l: Loan) { return l.principal + l.interestTotal - l.paid; }
/** Early payoff: remaining principal plus remaining interest with a discount on that interest. */
export function payoffAmount(l: Loan) {
  const total = l.principal + l.interestTotal; const share = l.paid / total;
  const princLeft = l.principal * (1 - share); const intLeft = l.interestTotal * (1 - share);
  return Math.round(princLeft + intLeft * (1 - BIZ.loanEarlyDiscount));
}
export function payOff(g: Game, id: string) {
  const l = g.s.loans.find((x) => x.id === id); if (!l) return false; const amt = payoffAmount(l);
  if (g.s.money < amt) return false;
  g.addMoney(-amt); g.s.loans = g.s.loans.filter((x) => x.id !== id); g.stat('loansRepaid'); g.emit('loans'); return true;
}
const BANK: [string, string] = ['City Bank', 'بنك المدينة'];
/** Weekly payments. Missing one hurts reputation and raises the rate. */
export function weeklyLoans(g: Game) {
  for (const l of [...g.s.loans]) {
    if (g.s.day < l.nextDue) continue;
    l.nextDue += 7;
    const due = Math.min(l.weekly, owed(l));
    if (g.s.money >= due) { g.addMoney(-due); l.paid += due; l.weeksLeft--; }
    else {
      l.missed++; g.addRep(-CFG.reputation.missedPaymentPenalty);
      const extra = Math.round(owed(l) * BIZ.loanMissedRatePenalty); l.interestTotal += extra; l.rate += BIZ.loanMissedRatePenalty;
      l.weeksLeft = Math.max(1, l.weeksLeft);
      l.weekly = Math.ceil(owed(l) / l.weeksLeft);
      g.message(BANK, ['You missed a loan payment of $' + due + '. Your rate went up.', 'فاتتك دفعة قرض بقيمة ' + due + '$. ارتفعت نسبة الفائدة.'], 'bank');
    }
    if (owed(l) <= 0) { g.s.loans = g.s.loans.filter((x) => x.id !== l.id); g.stat('loansRepaid'); g.message(BANK, ['Loan fully repaid. Thank you!', 'تم سداد القرض بالكامل. شكراً لك!'], 'bank'); }
  }
  // Rosa's old debt: small weekly interest and a minimum payment.
  if (g.s.rosaDebt > 0 && g.s.day % 7 === 0) {
    g.s.rosaDebt = Math.round(g.s.rosaDebt * (1 + CFG.start.rosaDebtWeeklyInterest * g.diff.interestMult));
    const due = Math.min(g.s.rosaDebt, CFG.start.rosaDebtMinWeekly);
    if (g.s.money >= due) { g.addMoney(-due); g.s.rosaDebt -= due; }
    else { g.addRep(-1); g.message(BANK, ["You couldn't make the weekly payment on Rosa's debt.", 'لم تتمكن من دفع القسط الأسبوعي لدين روزا.'], 'bank'); }
  }
  g.emit('loans');
}
export function payRosaDebt(g: Game, amount: number) {
  amount = Math.min(amount, g.s.rosaDebt, Math.max(0, g.s.money)); if (amount <= 0) return false;
  g.addMoney(-amount); g.s.rosaDebt -= amount; g.emit('loans'); return true;
}
