import {describe, expect, it} from 'vitest';
import {parseSir, simulateSir, sirFallback, SIR_DEFAULTS, toForm} from './models/sir/engine';
import {IDS_DEFAULTS, idsFallback, monteCarlo, parseIds, simulateIds, toIdsForm} from './models/ids/engine';
import {LAB_MODELS} from './registry';
import {LAWS} from '../laws';

describe('SIR (JavaScript mirror of the Python engine)', () => {
  it('reproduces the worked day-1 solution', () => {
    const d1 = simulateSir(SIR_DEFAULTS).rows[1];
    expect(d1.new_infections).toBeCloseTo(1.99, 12);
    expect(d1.recoveries).toBeCloseTo(0.5, 12);
    expect(d1.S).toBeCloseTo(993.01, 12);
    expect(d1.I).toBeCloseTo(6.49, 12);
    expect(d1.R).toBeCloseTo(0.5, 12);
  });
  it('keeps S + I + R = N and uses the previous day', () => {
    const r = simulateSir({...SIR_DEFAULTS, days: 365, beta: 0.9, gamma: 0.05});
    expect(r.summary.conserved).toBe(true);
    expect(r.rows[2].new_infections).toBe(0.9 * r.rows[1].S * r.rows[1].I / 1000);
  });
  it('validates inputs like Python', () => {
    const bad = parseSir({...toForm(SIR_DEFAULTS), beta: '1.2', S0: '-1', days: '2.5'});
    expect(bad.errors.map(e => e.field).sort()).toEqual(['S0', 'beta', 'days']);
    expect(parseSir({...toForm(SIR_DEFAULTS), S0: '990'}).errors[0].field).toBe('S0');      // sum ≠ N
    expect(parseSir({...toForm(SIR_DEFAULTS), N: ''}).errors[0].en).toMatch(/required/);
    expect(parseSir({...toForm(SIR_DEFAULTS), beta: '0.25'}).params?.beta).toBe(0.25);
  });
  it('fallback is labelled javascript', () => {
    const out = sirFallback(SIR_DEFAULTS);
    expect(out.ok && out.engine).toBe('javascript');
  });
});

describe('IDS / Bayes (JavaScript mirror)', () => {
  it('matches case 1 (5%) and case 2 (1%)', () => {
    const a = simulateIds(IDS_DEFAULTS);
    expect([a.expected.malicious, a.expected.benign, a.expected.tp, a.expected.fn, a.expected.fp, a.expected.tn, a.expected.alerts].map(v => +v.toFixed(9)))
      .toEqual([500, 9500, 495, 5, 475, 9025, 970]);
    expect(a.expected.p_malicious_given_alarm!).toBeCloseTo(0.5103, 4);
    const b = a.comparison[1].expected;
    expect([b.malicious, b.benign, b.tp, b.fn, b.fp, b.tn, b.alerts].map(v => +v.toFixed(9))).toEqual([100, 9900, 99, 1, 495, 9405, 594]);
    expect(b.p_malicious_given_alarm!).toBeCloseTo(0.1667, 4);
  });
  it('handles no alarms safely', () => {
    const e = simulateIds({...IDS_DEFAULTS, tpr_pct: 0, fpr_pct: 0}).expected;
    expect(e.alerts).toBe(0);
    expect(e.p_malicious_given_alarm).toBeNull();
    expect(e.bayes.posterior).toBeNull();
  });
  it('Monte Carlo is reproducible and sums to N', () => {
    const a = monteCarlo({...IDS_DEFAULTS, seed: 's'}), b = monteCarlo({...IDS_DEFAULTS, seed: 's'});
    expect(a).toEqual(b);
    expect(a.tp + a.fn + a.fp + a.tn).toBe(10000);
  });
  it('validates percentages, packets and scenarios', () => {
    const f = toIdsForm(IDS_DEFAULTS);
    expect(parseIds({...f, malicious_pct: '120'}).errors[0].field).toBe('malicious_pct');
    expect(parseIds({...f, packets: '10.5'}).errors[0].field).toBe('packets');
    expect(parseIds({...f, monte_carlo: true, packets: '2000000'}).errors[0].field).toBe('packets');
    expect(parseIds({...f, scenarios: [{...f.scenarios[0], fpr_pct: '-2'}]}).errors[0].field).toBe('scenarios.0.fpr_pct');
    expect(idsFallback(IDS_DEFAULTS).ok).toBe(true);
  });
});

describe('Simulation Lab registry', () => {
  it('lists both models with laws', () => {
    expect(LAB_MODELS.map(m => m.id)).toEqual(['sir', 'ids']);
    expect(LAWS.sir.length).toBeGreaterThan(4);
    expect(LAWS.ids.length).toBeGreaterThan(4);
  });
});
