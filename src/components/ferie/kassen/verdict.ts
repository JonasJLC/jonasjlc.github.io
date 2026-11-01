import { fmtShort, toISO } from '../lib/dates';
import {
  bindingInfo, bindingText, cap, hasSteps, kr, nextChangeText, planSentence,
  type Analysis, type MoneyModel, type Segment,
} from '../lib/kasse';
import type { FerieState } from '../lib/types';

export type VerdictAction =
  | { kind: 'usedep'; total: number; label: string }
  | { kind: 'plan'; plus?: number; label: string }
  | { kind: 'oneoff'; amount: number; rate: number; label: string };

export interface VerdictOption {
  title: string;
  text: string;
  action: VerdictAction;
}

export interface Verdict {
  title: string;
  text: string;
  bad: boolean;
  options: VerdictOption[];
  action?: VerdictAction;
  /** Recommended schedule, drawn in the monthly chart. */
  rec: Segment[] | null;
}

/** Turns the analysis into advice on whether to raise, lower or stage the monthly deposit. */
/** `m` is the account as it stands now; `a` is the analysis that assumes no deposits. */
export function buildVerdict(s: FerieState, a: Analysis, m: MoneyModel, today: number): Verdict {
  const D = m.D;
  const hasOut = s.money.some((it) => it.kind !== 'deposit');
  const margin = +s.kasse.margin || 0;
  const mnote = margin > 0 ? ` Der er regnet med ${margin} % margin på det, der ikke er betalt endnu.` : '';
  if (!hasOut) {
    return {
      title: 'Læg udgifter ind på jeres rejser',
      text: `Så regner rejsekassen ud, om ${D > 0 ? `${kr(D)} om måneden` : 'jeres opsparing'} er nok, og hvor meget I skal skrue op eller ned.`,
      bad: false, options: [], rec: null,
    };
  }
  const buf = +s.kasse.buffer || 0;
  const curOk = m.min >= buf - 0.5;
  const segs = a.segs;
  const stepped = segs.length > 1 && segs[1].rate <= segs[0].rate * 0.75;
  const oo = a.oneOff;
  const ooOption: VerdictOption[] = oo && oo.amount > 0 && segs.length > 1
    ? [{
        title: 'Engangsbeløb',
        text: `Sæt ${kr(oo.amount)} ind én gang nu, og hold derefter ${kr(oo.rate)} om måneden.`,
        action: { kind: 'oneoff', amount: oo.amount, rate: oo.rate, label: 'Brug engangsbeløbet' },
      }]
    : [];
  const planOption = (title = 'Trappeplan'): VerdictOption[] =>
    segs.length ? [{ title, text: `${cap(planSentence(s, segs))}.`, action: { kind: 'plan', label: 'Brug trappeplanen' } }] : [];
  const lowest = `Den laveste saldo bliver ${kr(m.min)} d. ${fmtShort(m.minT, true)}.`;

  if (a.inf) {
    const out: Verdict = {
      title: `Der mangler ${kr(a.inf.short)} d. ${fmtShort(a.inf.t, true)}`,
      text: `Det er før næste indskud, så det skal dækkes af et engangsindskud nu.${mnote}`,
      bad: true, options: [], rec: null,
    };
    if (segs.length) {
      out.options = [{
        title: 'Engangsbeløb + trappeplan',
        text: `Sæt ${kr(a.off)} ind nu og derefter ${planSentence(s, segs)}.`,
        action: { kind: 'plan', plus: a.off, label: 'Brug den' },
      }];
      out.rec = segs;
    } else {
      out.options = [{
        title: 'Engangsbeløb', text: `Sæt ${kr(a.off)} ind nu.`,
        action: { kind: 'oneoff', amount: a.off, rate: Math.round(D), label: 'Læg det ind' },
      }];
    }
    return out;
  }
  if (hasSteps(s)) {
    if (curOk) {
      const nx = nextChangeText(s, today);
      return { title: 'Jeres trappeplan holder', text: `${nx ? `${nx} ` : ''}${lowest}${mnote}`, bad: false, options: [], rec: null };
    }
    return {
      title: 'Trappeplanen er ikke nok længere',
      text: `Der er kommet udgifter til, siden planen blev lavet. Sådan ser den ud nu:${mnote}`,
      bad: true, options: [...planOption('Ny trappeplan'), ...ooOption], rec: segs,
    };
  }
  if (stepped) {
    const after = segs[1].rate;
    const bi = bindingInfo(s, a.m, segs[0].bind);
    const big = bi ? `${bi.name} (${fmtShort(bi.t, true)})` : 'den store betaling';
    const months = segs[0].count === 1 ? 'én måned' : `${segs[0].count} måneder`;
    if (curOk) {
      if (D > after) {
        return {
          title: `Jeres ${kr(D)} om måneden holder`,
          text: `Men I har kun brug for så meget frem til ${big}. Derefter er ${kr(after)} om måneden nok.${mnote}`,
          bad: false, options: planOption(), rec: segs,
        };
      }
      return { title: `Jeres ${kr(D)} om måneden holder`, text: `${lowest}${mnote}`, bad: false, options: [], rec: null };
    }
    return {
      title: `Der skal ekstra ind før ${bi ? bi.name : 'den store betaling'}`,
      text: `Et fast beløb skulle være ${kr(a.cReq)} om måneden hele vejen, men det er kun ${months}, der kræver så meget. Efter ${big} er ${kr(after)} om måneden nok.${mnote}`,
      bad: true, options: [...planOption(), ...ooOption], rec: segs,
    };
  }
  const req = a.cReq;
  const diff = req - D;
  const bt = bindingText(s, a.m, a.cBind);
  const useAction: VerdictAction = { kind: 'usedep', total: req, label: `Brug ${kr(req)} om måneden` };
  if (diff > 0) {
    return {
      title: `Skru op med ${kr(diff)} om måneden`,
      text: `I sætter ${kr(D)} ind nu. Med ${kr(req)} om måneden har I råd til det hele${bt ? `, også ${bt}` : ''}.${mnote}`,
      bad: false, options: [], action: useAction, rec: null,
    };
  }
  if (-diff >= 50) {
    return {
      title: `I kan skrue ned med ${kr(-diff)} om måneden`,
      text: `${kr(req)} om måneden er nok til alt, I har planlagt${bt ? `, også ${bt}` : ''}. Med det nuværende beløb bliver den laveste saldo ${kr(m.min)} d. ${fmtShort(m.minT, true)}.${mnote}`,
      bad: false, options: [], action: useAction, rec: null,
    };
  }
  return { title: 'Jeres opsparing passer til planen', text: `${lowest}${mnote}`, bad: false, options: [], rec: null };
}

export const isoOf = toISO;
