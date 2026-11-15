import {useEffect, useMemo, useState} from 'react';
import {Activity, Download, HeartPulse, Play, RotateCcw, ShieldCheck, Sigma, Wand2} from 'lucide-react';
import {Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import Laws from '../../../Laws';
import {python, saveBytes, usePythonEngine} from '../../python/client';
import type {FieldError} from '../../python/protocol';
import {errorFor} from '../../validate';
import {Busy, ErrorBox, NumField, RunInfo, StatCard, Toggle, count, fmt, tr} from '../../ui';
import {parseSir, sirFallback, SIR_DEFAULTS, SIR_LABELS, SIR_MAX_DAYS, toForm, type SirForm, type SirKey, type SirParams, type SirResult} from './engine';

export const SIR_COLORS = {S: '#6687ff', I: '#ff6b6b', R: '#40cdb3'};
const tip = {background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10};
const FIELDS: [SirKey, string, string?][] = [['N', 'N'], ['S0', 'S₀'], ['I0', 'I₀'], ['R0', 'R₀'], ['beta', 'β'], ['gamma', 'γ'], ['days', 'D']];

export default function SirModel({ar}: {ar: boolean}) {
  const t = tr(ar);
  const engine = usePythonEngine();
  const [form, setForm] = useState<SirForm>(() => toForm(SIR_DEFAULTS));
  const [run, setRun] = useState<{result: SirResult; engine: 'python' | 'javascript'; ms: number; key: string} | null>(null);
  const [serverErrors, setServerErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState<'run' | 'excel' | null>(null);
  const [status, setStatus] = useState('');
  const [steps, setSteps] = useState(false);
  const [allSteps, setAllSteps] = useState(false);
  const parsed = useMemo(() => parseSir(form), [form]);
  const errors = parsed.errors.length ? parsed.errors : serverErrors;
  const stale = !!run && !!parsed.params && JSON.stringify(parsed.params) !== run.key;

  async function simulate(params: SirParams | undefined = parsed.params) {
    if (!params) { setStatus(t('Fix the highlighted inputs first.', 'صحّح المدخلات المحددة أولاً.')); return; }
    setBusy('run'); setStatus('');
    try {
      const out = await python.run<SirResult>('sir', params, sirFallback);
      if (out.ok) { setRun({result: out.result, engine: out.engine, ms: out.ms, key: JSON.stringify(params)}); setServerErrors([]); }
      else setServerErrors(out.errors);
    } catch (e) { setStatus(String(e instanceof Error ? e.message : e)); }
    finally { setBusy(null); }
  }
  useEffect(() => { simulate(SIR_DEFAULTS); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  async function download() {
    if (!parsed.params) { setStatus(t('Fix the highlighted inputs first.', 'صحّح المدخلات المحددة أولاً.')); return; }
    setBusy('excel'); setStatus(t('Python (openpyxl) is building your workbook…', 'يقوم Python (openpyxl) بإنشاء الملف…'));
    try {
      const out = await python.exportWorkbook('sir', parsed.params);
      if (out.ok) { saveBytes(out.bytes, out.filename); setStatus(t(`Downloaded ${out.filename}`, `تم تنزيل ${out.filename}`)); }
      else { setServerErrors(out.errors); setStatus(''); }
    } catch {
      setStatus(t('Excel export needs the Python engine. On a computer you can run: python -m simlab sir --xlsx sir.xlsx', 'تصدير Excel يحتاج محرك Python. على الحاسوب يمكنك تشغيل: python -m simlab sir --xlsx sir.xlsx'));
    } finally { setBusy(null); }
  }

  const set = (k: SirKey) => (v: string) => setForm(f => ({...f, [k]: v}));
  const n = Number(form.N), i0 = Number(form.I0), r0 = Number(form.R0);
  const sum = Number(form.S0) + i0 + r0;
  const canFixS0 = !!errorFor(parsed.errors, 'S0') && Number.isFinite(n - i0 - r0) && n - i0 - r0 >= 0 && !errorFor(parsed.errors, 'N');
  const res = run?.result;
  const rows = res?.rows ?? [];
  const p = res?.inputs;
  const stepRows = allSteps ? rows.slice(1) : rows.slice(1, 11);

  return <>
    <Laws topic="sir" ar={ar} open={false}/>
    <section className="panel lab-inputs">
      <div className="section-heading"><div><span className="eyebrow">{t('INPUTS', 'المدخلات')}</span><h2>{t('Network & malware parameters', 'معاملات الشبكة والبرمجية الخبيثة')}</h2></div>
        <span className={Number.isFinite(sum) && Math.abs(sum - n) <= 1e-9 * Math.max(1, Math.abs(n)) ? 'sum-chip ok' : 'sum-chip bad'} dir="ltr">S₀ + I₀ + R₀ = {Number.isFinite(sum) ? +sum.toPrecision(12) : '?'} {Math.abs(sum - n) <= 1e-9 * Math.max(1, Math.abs(n)) ? '= N ✓' : `≠ N (${form.N})`}</span></div>
      <div className="lab-grid">
        {FIELDS.map(([k, sym]) => <NumField key={k} ar={ar} label={SIR_LABELS[k]} symbol={sym} value={form[k]} onChange={set(k)} error={errorFor(parsed.errors.length ? parsed.errors : serverErrors, k)}
          hint={k === 'beta' || k === 'gamma' ? t('0 – 1, decimals allowed', 'من 0 إلى 1، يقبل الكسور') : k === 'days' ? t(`1 – ${SIR_MAX_DAYS} days`, `من 1 إلى ${SIR_MAX_DAYS} يوماً`) : undefined}/>)}
      </div>
      <div className="actions">
        <button className="primary" onClick={() => simulate()} disabled={busy !== null || !parsed.params}>{busy === 'run' ? <Busy label={engine.status === 'loading' ? t('Starting Python…', 'تشغيل Python…') : t('Running…', 'جارٍ التشغيل…')}/> : <><Play size={16}/>{t('Run Simulation', 'تشغيل المحاكاة')}</>}</button>
        <button className="secondary" onClick={() => { setForm(toForm(SIR_DEFAULTS)); setServerErrors([]); simulate(SIR_DEFAULTS); }} disabled={busy !== null}><RotateCcw size={15}/>{t('Reset', 'إعادة الضبط')}</button>
        {canFixS0 && <button className="text-button" onClick={() => setForm(f => ({...f, S0: String(+(n - i0 - r0).toPrecision(12))}))}><Wand2 size={15}/>{t('Set S₀ = N − I₀ − R₀', 'اجعل S₀ = N − I₀ − R₀')}</button>}
        {stale && <span className="stale">{t('Inputs changed — run again to update the results.', 'تغيّرت المدخلات — شغّل المحاكاة لتحديث النتائج.')}</span>}
      </div>
      <ErrorBox errors={errors} ar={ar} fields={new Set(FIELDS.map(f => f[0]))}/>
      {status && <p className="lab-status" role="status">{status}</p>}
    </section>

    {res && p && <div className={stale ? 'lab-results is-stale' : 'lab-results'}>
      <div className="lab-results-head"><h2>{t(`Results after ${p.days} day${p.days > 1 ? 's' : ''}`, `النتائج بعد ${p.days} يوم`)}</h2><RunInfo engine={run!.engine} ms={run!.ms} ar={ar}/></div>
      <div className="lab-stats">
        <StatCard tone="s" label={t('Healthy · susceptible (S)', 'سليمة · معرّضة (S)')} value={res.summary.final.S} render={v => fmt(v)} icon={<ShieldCheck size={18}/>}
          sub={t(`${fmt(res.summary.final.S / p.N * 100)}% of the network`, `${fmt(res.summary.final.S / p.N * 100)}% من الشبكة`)}/>
        <StatCard tone="i" label={t('Infected (I)', 'مصابة (I)')} value={res.summary.final.I} render={v => fmt(v)} icon={<Activity size={18}/>}
          sub={t(`Peak ${fmt(res.summary.peak_infected)} on day ${res.summary.peak_day}`, `الذروة ${fmt(res.summary.peak_infected)} في اليوم ${res.summary.peak_day}`)}/>
        <StatCard tone="r" label={t('Recovered (R)', 'متعافية (R)')} value={res.summary.final.R} render={v => fmt(v)} icon={<HeartPulse size={18}/>}
          sub={t(`${fmt(res.summary.cumulative_new_infections)} new infections in total`, `${fmt(res.summary.cumulative_new_infections)} إصابة جديدة إجمالاً`)}/>
        <StatCard tone="k" label={t('Reproduction number ℛ₀ = β/γ', 'رقم التكاثر ℛ₀ = β/γ')} value={res.summary.basic_reproduction_number ?? NaN} render={v => (Number.isFinite(v) ? fmt(v) : '∞')} icon={<Sigma size={18}/>}
          sub={res.summary.basic_reproduction_number === null ? t('γ = 0: nobody recovers', 'γ = 0: لا يوجد تعافٍ') : res.summary.basic_reproduction_number > 1 ? t('> 1: the outbreak grows', '> 1: الانتشار يتزايد') : t('≤ 1: the outbreak fades', '≤ 1: الانتشار يتلاشى')}/>
      </div>

      <div className="two-col">
        <section className="panel"><h3>{t('S, I and R over time', 'تطور S و I و R عبر الأيام')}</h3>
          <div className="chart lab-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={res.chart} margin={{top: 8, right: 12, bottom: 4, left: 0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="day" tick={{fill: 'var(--muted)', fontSize: 11}} label={{value: t('Day', 'اليوم'), position: 'insideBottomRight', offset: -2, fill: 'var(--muted)', fontSize: 11}}/>
            <YAxis tick={{fill: 'var(--muted)', fontSize: 11}} width={54}/><Tooltip contentStyle={tip} formatter={(v) => fmt(Number(v))} labelFormatter={d => `${t('Day', 'اليوم')} ${d}`}/><Legend/>
            <Line type="monotone" dataKey="S" name={t('S – susceptible', 'S – معرّضة')} stroke={SIR_COLORS.S} strokeWidth={2.4} dot={p.days <= 40}/>
            <Line type="monotone" dataKey="I" name={t('I – infected', 'I – مصابة')} stroke={SIR_COLORS.I} strokeWidth={2.4} dot={p.days <= 40}/>
            <Line type="monotone" dataKey="R" name={t('R – recovered', 'R – متعافية')} stroke={SIR_COLORS.R} strokeWidth={2.4} dot={p.days <= 40}/>
          </LineChart></ResponsiveContainer></div></section>
        <section className="panel"><h3>{t('New infections and recoveries per day', 'الإصابات الجديدة والتعافي لكل يوم')}</h3>
          <div className="chart lab-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={res.chart.slice(1)} margin={{top: 8, right: 12, bottom: 4, left: 0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="day" tick={{fill: 'var(--muted)', fontSize: 11}}/><YAxis tick={{fill: 'var(--muted)', fontSize: 11}} width={54}/>
            <Tooltip contentStyle={tip} formatter={(v) => fmt(Number(v))} labelFormatter={d => `${t('Day', 'اليوم')} ${d}`}/><Legend/>
            <Bar dataKey="new_infections" name={t('New infections', 'إصابات جديدة')} fill={SIR_COLORS.I} radius={[4, 4, 0, 0]}/>
            <Bar dataKey="recoveries" name={t('Recoveries', 'تعافٍ')} fill={SIR_COLORS.R} radius={[4, 4, 0, 0]}/>
          </BarChart></ResponsiveContainer></div></section>
      </div>

      <section className="panel">
        <div className="section-heading"><h3>{t('Day-by-day results', 'النتائج يوماً بيوم')}</h3><span className="muted" dir="ltr">S + I + R = N {res.summary.conserved ? '✓' : '✗'} · max |Δ| = {res.summary.max_conservation_error.toExponential(1)}</span></div>
        <div className="table-wrap"><table className="lab-table"><thead><tr><th>{t('Day', 'اليوم')}</th><th>S</th><th>I</th><th>R</th><th>{t('New infections β·S·I/N', 'إصابات جديدة β·S·I/N')}</th><th>{t('Recoveries γ·I', 'تعافٍ γ·I')}</th><th>S + I + R</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.day}><td><strong>{r.day}</strong></td>
            <td title={String(r.S)} className="c-s">{fmt(r.S)}</td><td title={String(r.I)} className="c-i">{fmt(r.I)}</td><td title={String(r.R)} className="c-r">{fmt(r.R)}</td>
            <td title={String(r.new_infections ?? '')}>{r.new_infections === null ? '—' : fmt(r.new_infections)}</td><td title={String(r.recoveries ?? '')}>{r.recoveries === null ? '—' : fmt(r.recoveries)}</td>
            <td>{fmt(r.total)}</td></tr>)}</tbody></table></div>
        <p className="muted lab-note">{t('Values are rounded only for display (hover a cell for the full value). The calculation keeps full precision.', 'القيم مقرّبة للعرض فقط (مرّر المؤشر لرؤية القيمة الكاملة). الحساب يحتفظ بالدقة الكاملة.')}</p>
      </section>

      <section className="panel">
        <Toggle open={steps} onClick={() => setSteps(!steps)}><span className="stat-icon tone-1"><Sigma size={18}/></span><span><span className="eyebrow">{t('SHOW YOUR WORK', 'خطوات الحل')}</span><strong>{t('Calculation steps for every day', 'خطوات الحساب لكل يوم')}</strong></span></Toggle>
        {steps && <div className="lab-steps">{stepRows.map(r => {
          const prev = rows[r.day - 1];
          return <div className="lab-step" key={r.day}><span className="law-num">{r.day}</span><div dir="ltr">
            <code>New infections = β × S × I / N = {p.beta} × {fmt(prev.S, 4)} × {fmt(prev.I, 4)} / {count(p.N)} = <b>{fmt(r.new_infections, 4)}</b></code>
            <code>Recoveries = γ × I = {p.gamma} × {fmt(prev.I, 4)} = <b>{fmt(r.recoveries, 4)}</b></code>
            <code>S{r.day} = {fmt(prev.S, 4)} − {fmt(r.new_infections, 4)} = <b className="c-s">{fmt(r.S, 4)}</b>   ·   I{r.day} = {fmt(prev.I, 4)} + {fmt(r.new_infections, 4)} − {fmt(r.recoveries, 4)} = <b className="c-i">{fmt(r.I, 4)}</b>   ·   R{r.day} = {fmt(prev.R, 4)} + {fmt(r.recoveries, 4)} = <b className="c-r">{fmt(r.R, 4)}</b></code>
            <small>S + I + R = {fmt(r.total, 4)} = N ✓</small></div></div>;
        })}
          {rows.length > 11 && <button className="text-button" onClick={() => setAllSteps(!allSteps)}>{allSteps ? t('Show the first 10 days only', 'عرض أول 10 أيام فقط') : t(`Show all ${rows.length - 1} days`, `عرض جميع الأيام (${rows.length - 1})`)}</button>}
        </div>}
      </section>
    </div>}

    <section className="panel lab-excel">
      <div className="section-heading"><div><span className="eyebrow">EXCEL · OPENPYXL</span><h2>{t('Download Excel with Formulas', 'تنزيل Excel بالمعادلات')}</h2>
        <p>{t('Three sheets: Inputs (editable blue cells), SIR Simulation (every cell is a real formula using the previous day) and Charts. Change β, γ or N in Inputs and Excel recalculates everything.',
          'ثلاث أوراق: Inputs (خلايا زرقاء قابلة للتعديل)، و SIR Simulation (كل خلية معادلة حقيقية تعتمد على اليوم السابق)، و Charts. غيّر β أو γ أو N في Inputs وسيعيد Excel حساب كل شيء.')}</p></div>
        <button className="primary" onClick={download} disabled={busy !== null || !parsed.params}>{busy === 'excel' ? <Busy label={t('Building…', 'جارٍ الإنشاء…')}/> : <><Download size={16}/>{t('Download Excel with Formulas', 'تنزيل Excel بالمعادلات')}</>}</button></div>
      <div className="lab-sheets" dir="ltr">
        <div><b>Inputs</b><code>TotalDevices · InitialS/I/R · InfectionRate · RecoveryRate</code></div>
        <div><b>SIR Simulation</b><code>E6 =InfectionRate*B5*C5/TotalDevices{'\n'}B6 =B5-E6   C6 =C5+E6-F6   D6 =D5+F6</code></div>
        <div><b>Charts</b><code>Line: S, I, R · Bars: new infections vs recoveries</code></div>
      </div>
    </section>
  </>;
}
