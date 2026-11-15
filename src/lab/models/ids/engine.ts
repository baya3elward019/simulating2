// IDS / Bayes model — types, instant validation and the JavaScript fallback engine.
// The real engine is python/simlab/models/ids/engine.py (Pyodide). Same equations here.
import {rng} from '../../../engine';
import type {FieldError, RunOutcome} from '../../python/protocol';
import {FormChecker, type Label} from '../../validate';

export type IdsCore = {packets: number; malicious_pct: number; tpr_pct: number; fpr_pct: number};
export type CoreKey = keyof IdsCore;
export type Scenario = IdsCore & {name: string};
export type IdsParams = IdsCore & {monte_carlo: boolean; seed: string; scenarios: Scenario[]};
export type CoreForm = Record<CoreKey, string>;
export type ScenarioForm = CoreForm & {name: string};
export type IdsForm = CoreForm & {monte_carlo: boolean; seed: string; scenarios: ScenarioForm[]};

export type Expected = {
  packets: number; malicious: number; benign: number; tp: number; fn: number; fp: number; tn: number; alerts: number; no_alerts: number;
  p_malicious_given_alarm: number | null; p_benign_given_alarm: number | null; p_benign_given_no_alarm: number | null; accuracy: number; f1: number | null;
  bayes: {p_m: number; p_b: number; p_a_given_m: number; p_a_given_b: number; p_a_and_m: number; p_a_and_b: number; p_a: number; posterior: number | null};
};
export type PacketSample = {packet: number; u_class: number; malicious: boolean; u_alarm: number; alarm: boolean; outcome: 'TP' | 'FN' | 'FP' | 'TN'};
export type Simulated = {seed: string; packets: number; malicious: number; benign: number; tp: number; fn: number; fp: number; tn: number; alerts: number;
  no_alerts: number; p_malicious_given_alarm: number | null; ppv_margin95: number | null; accuracy: number; sample: PacketSample[]};
export type Comparison = {name: string; inputs: IdsCore; expected: Expected};
export type IdsResult = {model: 'ids'; inputs: IdsParams; expected: Expected; simulated: Simulated | null; comparison: Comparison[];
  chart: {alerts: {name: string; key: string; expected: number; simulated?: number}[]; scenarios: {name: string; tp: number; fp: number; ppv: number | null}[]}};

export const MAX_PACKETS = 100_000_000, MAX_MC_PACKETS = 1_000_000, MAX_SCENARIOS = 6;
export const IDS_DEFAULTS: IdsParams = {packets: 10000, malicious_pct: 5, tpr_pct: 99, fpr_pct: 5, monte_carlo: false, seed: '2026',
  scenarios: [{name: 'Scenario B – 1% malicious', packets: 10000, malicious_pct: 1, tpr_pct: 99, fpr_pct: 5}]};
export const IDS_LABELS: Record<CoreKey, Label> = {
  packets: ['Total packets', 'إجمالي الحزم'],
  malicious_pct: ['Malicious traffic rate (%)', 'نسبة الحزم الخبيثة (%)'],
  tpr_pct: ['Detection rate – TPR (%)', 'معدل الكشف TPR (%)'],
  fpr_pct: ['False positive rate – FPR (%)', 'معدل الإنذار الكاذب FPR (%)'],
};
const CORE: CoreKey[] = ['packets', 'malicious_pct', 'tpr_pct', 'fpr_pct'];
const coreForm = (c: IdsCore): CoreForm => Object.fromEntries(CORE.map(k => [k, String(c[k])])) as CoreForm;
export const toIdsForm = (p: IdsParams): IdsForm => ({...coreForm(p), monte_carlo: p.monte_carlo, seed: p.seed,
  scenarios: p.scenarios.map(s => ({...coreForm(s), name: s.name}))});

function checkCore(form: CoreForm, prefix = '') {
  const c = new FormChecker<CoreKey>(form, prefix);
  c.num('packets', IDS_LABELS.packets, {min: 1, max: MAX_PACKETS, integer: true});
  for (const k of ['malicious_pct', 'tpr_pct', 'fpr_pct'] as const) c.num(k, IDS_LABELS[k], {min: 0, max: 100});
  return c;
}

export function parseIds(form: IdsForm): {params?: IdsParams; errors: FieldError[]} {
  const core = checkCore(form);
  const errors = [...core.errors];
  if (form.seed.length > 64) errors.push({field: 'seed', en: 'Random seed must be at most 64 characters.', ar: 'البذرة العشوائية: الحد الأقصى 64 حرفاً.'});
  if (form.monte_carlo && !errors.length && core.values.packets! > MAX_MC_PACKETS)
    errors.push({field: 'packets', en: `Monte Carlo mode supports up to ${MAX_MC_PACKETS.toLocaleString('en')} packets.`, ar: `وضع مونت كارلو يدعم حتى ${MAX_MC_PACKETS.toLocaleString('en')} حزمة.`});
  const scenarios = form.scenarios.slice(0, MAX_SCENARIOS).map((s, i) => {
    const c = checkCore(s, `scenarios.${i}.`);
    errors.push(...c.errors);
    return {name: (s.name || `Scenario ${String.fromCharCode(66 + i)}`).slice(0, 60), ...(c.values as IdsCore)};
  });
  if (errors.length) return {errors};
  return {params: {...(core.values as IdsCore), monte_carlo: form.monte_carlo, seed: form.seed, scenarios}, errors: []};
}

const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

export function expected(p: IdsCore): Expected {
  const n = p.packets, m = p.malicious_pct / 100, tpr = p.tpr_pct / 100, fpr = p.fpr_pct / 100;
  const mal = n * m, ben = n * (1 - m), tp = mal * tpr, fn = mal * (1 - tpr), fp = ben * fpr, tn = ben * (1 - fpr), alerts = tp + fp;
  const pa = tpr * m + fpr * (1 - m), ppv = ratio(tp, alerts), pr = (ppv ?? 0) + tpr;
  return {packets: n, malicious: mal, benign: ben, tp, fn, fp, tn, alerts, no_alerts: fn + tn, p_malicious_given_alarm: ppv,
    p_benign_given_alarm: ratio(fp, alerts), p_benign_given_no_alarm: ratio(tn, tn + fn), accuracy: (tp + tn) / n,
    f1: ppv === null || pr === 0 ? null : 2 * ppv * tpr / pr,
    bayes: {p_m: m, p_b: 1 - m, p_a_given_m: tpr, p_a_given_b: fpr, p_a_and_m: tpr * m, p_a_and_b: fpr * (1 - m), p_a: pa, posterior: pa === 0 ? null : tpr * m / pa}};
}

/** JavaScript Monte Carlo (fallback only — a different random stream from Python's). */
export function monteCarlo(p: IdsCore & {seed: string}): Simulated {
  const r = rng(`ids:${p.seed}`), m = p.malicious_pct / 100, tpr = p.tpr_pct / 100, fpr = p.fpr_pct / 100;
  let tp = 0, fn = 0, fp = 0, tn = 0;
  const sample: PacketSample[] = [];
  for (let i = 0; i < p.packets; i++) {
    const uc = r(), ua = r(), mal = uc < m, alarm = ua < (mal ? tpr : fpr);
    const outcome = mal ? (alarm ? 'TP' : 'FN') : (alarm ? 'FP' : 'TN');
    if (outcome === 'TP') tp++; else if (outcome === 'FN') fn++; else if (outcome === 'FP') fp++; else tn++;
    if (i < 25) sample.push({packet: i + 1, u_class: uc, malicious: mal, u_alarm: ua, alarm, outcome});
  }
  const alerts = tp + fp, ppv = ratio(tp, alerts);
  return {seed: p.seed, packets: p.packets, malicious: tp + fn, benign: fp + tn, tp, fn, fp, tn, alerts, no_alerts: fn + tn,
    p_malicious_given_alarm: ppv, ppv_margin95: ppv === null ? null : 1.96 * Math.sqrt(ppv * (1 - ppv) / alerts), accuracy: (tp + tn) / p.packets, sample};
}

export function simulateIds(p: IdsParams): IdsResult {
  const pick = (s: IdsCore): IdsCore => ({packets: s.packets, malicious_pct: s.malicious_pct, tpr_pct: s.tpr_pct, fpr_pct: s.fpr_pct});
  const comparison = [{name: 'Current inputs', ...pick(p)}, ...p.scenarios].map(s => ({name: s.name, inputs: pick(s), expected: expected(s)}));
  const e = expected(p), sim = p.monte_carlo ? monteCarlo(p) : null;
  return {model: 'ids', inputs: p, expected: e, simulated: sim, comparison,
    chart: {alerts: [{name: 'True alerts (TP)', key: 'tp', expected: e.tp, ...(sim ? {simulated: sim.tp} : {})}, {name: 'False alerts (FP)', key: 'fp', expected: e.fp, ...(sim ? {simulated: sim.fp} : {})}],
      scenarios: comparison.map(c => ({name: c.name, tp: c.expected.tp, fp: c.expected.fp, ppv: c.expected.p_malicious_given_alarm}))}};
}

export function idsFallback(params: unknown): RunOutcome<IdsResult> {
  const parsed = parseIds(toIdsForm(params as IdsParams));
  return parsed.params ? {ok: true, result: simulateIds(parsed.params), engine: 'javascript', ms: 0} : {ok: false, errors: parsed.errors};
}
