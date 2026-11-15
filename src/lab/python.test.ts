// Runs the real python/simlab package inside Pyodide (the same WebAssembly runtime the browser
// uses), then checks that Python and the JavaScript mirror give identical theoretical results and
// that the Excel export from Pyodide is a real workbook with formulas.
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {beforeAll, describe, expect, it} from 'vitest';
import type {PyodideAPI} from 'pyodide';
import {simulateSir, SIR_DEFAULTS, type SirParams, type SirResult} from './models/sir/engine';
import {IDS_DEFAULTS, simulateIds, type IdsParams, type IdsResult} from './models/ids/engine';
import {WHEELS} from './python/protocol';

const ROOT = join(__dirname, '..', '..');
let py: PyodideAPI;
type Bridge = {run: (m: string, p: string) => string; export: (m: string, p: string, path: string) => string};
let bridge: Bridge;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? (f === '__pycache__' ? [] : files(p)) : p.endsWith('.py') ? [p] : []; });
}

beforeAll(async () => {
  const {loadPyodide} = await import('pyodide');
  py = await loadPyodide();
  await py.loadPackage(WHEELS.map(w => join(ROOT, 'python', 'wheels', w)));
  for (const f of files(join(ROOT, 'python', 'simlab'))) {
    const target = `/home/pyodide/${relative(join(ROOT, 'python'), f)}`;
    py.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
    py.FS.writeFile(target, readFileSync(f, 'utf8'));
  }
  py.runPython('import sys; sys.path.insert(0, "/home/pyodide")');
  bridge = py.pyimport('simlab.bridge') as Bridge;
}, 120_000);

const runPy = <T,>(model: string, params: unknown) => JSON.parse(bridge.run(model, JSON.stringify(params))) as {ok: boolean; result: T; errors?: {field: string}[]};

describe('Python engine in Pyodide', () => {
  it.each<Partial<SirParams>>([{}, {days: 60}, {beta: 0.85, gamma: 0.03, days: 200}, {N: 10.5, S0: 10, I0: 0.5, R0: 0, gamma: 0}, {S0: 1000, I0: 0}])
  ('SIR Python == JavaScript for %o', p => {
    const params = {...SIR_DEFAULTS, ...p};
    const out = runPy<SirResult>('sir', params);
    expect(out.ok).toBe(true);
    const js = simulateSir(params);
    out.result.rows.forEach((r, i) => { for (const k of ['S', 'I', 'R'] as const) expect(r[k]).toBeCloseTo(js.rows[i][k], 9); });
    expect(out.result.summary.basic_reproduction_number).toEqual(js.summary.basic_reproduction_number);
  });

  it('SIR day 1 from Python matches the worked solution', () => {
    const d1 = runPy<SirResult>('sir', SIR_DEFAULTS).result.rows[1];
    expect([d1.new_infections, d1.recoveries, d1.S, d1.I, d1.R].map(v => +v!.toFixed(10))).toEqual([1.99, 0.5, 993.01, 6.49, 0.5]);
  });

  it.each<Partial<IdsParams>>([{}, {malicious_pct: 1}, {tpr_pct: 0, fpr_pct: 0}, {packets: 1234, malicious_pct: 0.7, tpr_pct: 97.5, fpr_pct: 2.25}])
  ('IDS expected Python == JavaScript for %o', p => {
    const params = {...IDS_DEFAULTS, ...p};
    const out = runPy<IdsResult>('ids', params);
    expect(out.ok).toBe(true);
    const js = simulateIds(params);
    for (const k of ['malicious', 'benign', 'tp', 'fn', 'fp', 'tn', 'alerts'] as const) expect(out.result.expected[k]).toBeCloseTo(js.expected[k], 9);
    expect(out.result.expected.p_malicious_given_alarm).toEqual(js.expected.p_malicious_given_alarm === null ? null : expect.closeTo(js.expected.p_malicious_given_alarm, 12));
    expect(out.result.comparison.map(c => c.expected.p_malicious_given_alarm)).toEqual(js.comparison.map(c => c.expected.p_malicious_given_alarm === null ? null : expect.closeTo(c.expected.p_malicious_given_alarm, 12)));
  });

  it('Monte Carlo in Python is seeded and separate from expected values', () => {
    const a = runPy<IdsResult>('ids', {...IDS_DEFAULTS, monte_carlo: true, seed: 'lab'}).result;
    const b = runPy<IdsResult>('ids', {...IDS_DEFAULTS, monte_carlo: true, seed: 'lab'}).result;
    expect(a.simulated).toEqual(b.simulated);
    expect(a.expected.tp).toBeCloseTo(495, 9);
    expect(a.simulated!.tp + a.simulated!.fn + a.simulated!.fp + a.simulated!.tn).toBe(10000);
  });

  it('reports validation errors as JSON', () => {
    expect(runPy('sir', {...SIR_DEFAULTS, beta: 3}).errors![0].field).toBe('beta');
    expect(runPy('ids', {...IDS_DEFAULTS, fpr_pct: 101}).errors![0].field).toBe('fpr_pct');
  });

  it.each([['sir', ['Inputs', 'SIR Simulation', 'Charts']], ['ids', ['Inputs', 'Detection Results', 'Bayes Calculation', 'Scenario Comparison']]] as const)
  ('exports a real %s workbook with formulas', async (model, sheets) => {
    const res = JSON.parse(bridge.export(model, JSON.stringify(model === 'ids' ? {monte_carlo: true} : {}), `/tmp/${model}.xlsx`));
    expect(res.ok).toBe(true);
    // Re-open the bytes with openpyxl (ExcelJS cannot parse chart drawings).
    const info = JSON.parse(py.runPython(`
import json, openpyxl
wb = openpyxl.load_workbook("/tmp/${model}.xlsx")
cell = wb["SIR Simulation"]["E6"] if "${model}" == "sir" else wb["Detection Results"]["C7"]
json.dumps({"sheets": wb.sheetnames, "formula": cell.value, "charts": sum(len(ws._charts) for ws in wb.worksheets)})`) as string);
    expect(info.sheets).toEqual(sheets);
    expect(info.formula).toBe(model === 'sir' ? '=InfectionRate*B5*C5/TotalDevices' : '=C5*DetectionRate');
    expect(info.charts).toBe(2);
    const bytes = py.FS.readFile(`/tmp/${model}.xlsx`) as Uint8Array;
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);   // a real .xlsx (zip) file
  });
});
