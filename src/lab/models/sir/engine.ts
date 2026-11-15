// SIR model — types, instant validation and the JavaScript fallback engine.
// The real engine is python/simlab/models/sir/engine.py (run through Pyodide); this file uses
// the same equations so the page still works if WebAssembly is unavailable. Tests check both agree.
import type {FieldError, RunOutcome} from '../../python/protocol';
import {FormChecker, type Label} from '../../validate';

export type SirParams = {N: number; S0: number; I0: number; R0: number; beta: number; gamma: number; days: number};
export type SirKey = keyof SirParams;
export type SirForm = Record<SirKey, string>;
export type SirRow = {day: number; S: number; I: number; R: number; new_infections: number | null; recoveries: number | null; total: number};
export type SirResult = {
  model: 'sir'; inputs: SirParams; rows: SirRow[];
  summary: {final: {S: number; I: number; R: number}; peak_infected: number; peak_day: number; cumulative_new_infections: number;
    cumulative_recoveries: number; basic_reproduction_number: number | null; max_conservation_error: number; conserved: boolean};
  chart: {day: number; S: number; I: number; R: number; new_infections: number; recoveries: number}[];
};

export const SIR_DEFAULTS: SirParams = {N: 1000, S0: 995, I0: 5, R0: 0, beta: 0.4, gamma: 0.1, days: 5};
export const SIR_MAX_DAYS = 365;
export const SIR_LABELS: Record<SirKey, Label> = {
  N: ['Total devices (N)', 'إجمالي الأجهزة (N)'],
  S0: ['Susceptible devices (S0)', 'الأجهزة المعرّضة (S0)'],
  I0: ['Infected devices (I0)', 'الأجهزة المصابة (I0)'],
  R0: ['Recovered devices (R0)', 'الأجهزة المتعافية (R0)'],
  beta: ['Infection rate (β)', 'معدل الإصابة (β)'],
  gamma: ['Recovery rate (γ)', 'معدل التعافي (γ)'],
  days: ['Simulation days', 'عدد أيام المحاكاة'],
};
export const toForm = (p: SirParams): SirForm => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) as SirForm;
const tolerance = (n: number) => 1e-9 * Math.max(1, Math.abs(n));

export function parseSir(form: SirForm): {params?: SirParams; errors: FieldError[]} {
  const c = new FormChecker<SirKey>(form);
  const n = c.num('N', SIR_LABELS.N, {positive: true});
  const s0 = c.num('S0', SIR_LABELS.S0, {min: 0});
  const i0 = c.num('I0', SIR_LABELS.I0, {min: 0});
  const r0 = c.num('R0', SIR_LABELS.R0, {min: 0});
  c.num('beta', SIR_LABELS.beta, {min: 0, max: 1});
  c.num('gamma', SIR_LABELS.gamma, {min: 0, max: 1});
  c.num('days', SIR_LABELS.days, {min: 1, max: SIR_MAX_DAYS, integer: true});
  if (n !== undefined && s0 !== undefined && i0 !== undefined && r0 !== undefined && Math.abs(s0 + i0 + r0 - n) > tolerance(n))
    c.fail('S0', `S0 + I0 + R0 must equal N (${s0} + ${i0} + ${r0} = ${+(s0 + i0 + r0).toPrecision(12)}, N = ${n}).`,
      `يجب أن يكون S0 + I0 + R0 = N (المجموع ${+(s0 + i0 + r0).toPrecision(12)} و N = ${n}).`);
  return c.errors.length ? {errors: c.errors} : {params: c.values as SirParams, errors: []};
}

export function simulateSir(p: SirParams): SirResult {
  const rows: SirRow[] = [{day: 0, S: p.S0, I: p.I0, R: p.R0, new_infections: null, recoveries: null, total: p.S0 + p.I0 + p.R0}];
  for (let day = 1; day <= p.days; day++) {
    const prev = rows[rows.length - 1];
    const ni = p.beta * prev.S * prev.I / p.N, rec = p.gamma * prev.I;
    const S = prev.S - ni, I = prev.I + ni - rec, R = prev.R + rec;
    rows.push({day, S, I, R, new_infections: ni, recoveries: rec, total: S + I + R});
  }
  const final = rows[rows.length - 1];
  const peak = rows.reduce((a, r) => (r.I > a.I ? r : a), rows[0]);
  return {
    model: 'sir', inputs: p, rows,
    summary: {
      final: {S: final.S, I: final.I, R: final.R}, peak_infected: peak.I, peak_day: peak.day,
      cumulative_new_infections: rows.reduce((s, r) => s + (r.new_infections ?? 0), 0),
      cumulative_recoveries: rows.reduce((s, r) => s + (r.recoveries ?? 0), 0),
      basic_reproduction_number: p.gamma > 0 ? p.beta / p.gamma : null,
      max_conservation_error: Math.max(...rows.map(r => Math.abs(r.total - p.N))),
      conserved: rows.every(r => Math.abs(r.total - p.N) <= tolerance(p.N)),
    },
    chart: rows.map(r => ({day: r.day, S: r.S, I: r.I, R: r.R, new_infections: r.new_infections ?? 0, recoveries: r.recoveries ?? 0})),
  };
}

export function sirFallback(params: unknown): RunOutcome<SirResult> {
  const parsed = parseSir(toForm(params as SirParams));
  return parsed.params ? {ok: true, result: simulateSir(parsed.params), engine: 'javascript', ms: 0} : {ok: false, errors: parsed.errors};
}
