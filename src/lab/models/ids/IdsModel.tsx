import {useEffect, useMemo, useRef, useState} from 'react';
import {AlertOctagon, Dices, Download, GitCompareArrows, Play, Plus, RotateCcw, Shield, ShieldAlert, Sigma, Trash2} from 'lucide-react';
import {Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import Laws from '../../../Laws';
import {python, saveBytes, usePythonEngine} from '../../python/client';
import type {FieldError} from '../../python/protocol';
import {errorFor} from '../../validate';
import {Busy, ErrorBox, NumField, RunInfo, StatCard, Toggle, count, fmt, pct, tr} from '../../ui';
import {IDS_DEFAULTS, IDS_LABELS, MAX_MC_PACKETS, MAX_SCENARIOS, idsFallback, parseIds, toIdsForm, type CoreKey, type IdsForm, type IdsParams, type IdsResult, type ScenarioForm} from './engine';

const TRUE_C = '#40cdb3', FALSE_C = '#ff6b6b', PPV_C = '#6687ff';
const tip = {background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10};
const CORE: [CoreKey, string, string?][] = [['packets', 'N'], ['malicious_pct', 'm', '%'], ['tpr_pct', 'TPR', '%'], ['fpr_pct', 'FPR', '%']];
type Run = {result: IdsResult; engine: 'python' | 'javascript'; ms: number; key: string};

export default function IdsModel({ar}: {ar: boolean}) {
  const t = tr(ar);
  const engine = usePythonEngine();
  const [form, setForm] = useState<IdsForm>(() => toIdsForm(IDS_DEFAULTS));
  const [run, setRun] = useState<Run | null>(null);
  const [serverErrors, setServerErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState<'run' | 'compare' | 'excel' | null>(null);
  const [status, setStatus] = useState('');
  const [bayes, setBayes] = useState(true);
  const compareRef = useRef<HTMLElement>(null);
  const parsed = useMemo(() => parseIds(form), [form]);
  const fieldErrors = parsed.errors.length ? parsed.errors : serverErrors;
  const stale = !!run && !!parsed.params && JSON.stringify(parsed.params) !== run.key;

  async function simulate(params: IdsParams | undefined = parsed.params, mode: 'run' | 'compare' = 'run') {
    if (!params) { setStatus(t('Fix the highlighted inputs first.', 'صحّح المدخلات المحددة أولاً.')); return; }
    setBusy(mode); setStatus('');
    try {
      const out = await python.run<IdsResult>('ids', params, idsFallback);
      if (out.ok) {
        setRun({result: out.result, engine: out.engine, ms: out.ms, key: JSON.stringify(params)}); setServerErrors([]);
        if (mode === 'compare') requestAnimationFrame(() => compareRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'}));
      } else setServerErrors(out.errors);
    } catch (e) { setStatus(String(e instanceof Error ? e.message : e)); }
    finally { setBusy(null); }
  }
  useEffect(() => { simulate(IDS_DEFAULTS); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  async function download() {
    if (!parsed.params) { setStatus(t('Fix the highlighted inputs first.', 'صحّح المدخلات المحددة أولاً.')); return; }
    setBusy('excel'); setStatus(t('Python (openpyxl) is building your workbook…', 'يقوم Python (openpyxl) بإنشاء الملف…'));
    try {
      const out = await python.exportWorkbook('ids', parsed.params);
      if (out.ok) { saveBytes(out.bytes, out.filename); setStatus(t(`Downloaded ${out.filename}`, `تم تنزيل ${out.filename}`)); }
      else { setServerErrors(out.errors); setStatus(''); }
    } catch {
      setStatus(t('Excel export needs the Python engine. On a computer you can run: python -m simlab ids --xlsx ids.xlsx', 'تصدير Excel يحتاج محرك Python. على الحاسوب يمكنك تشغيل: python -m simlab ids --xlsx ids.xlsx'));
    } finally { setBusy(null); }
  }

  const setCore = (k: CoreKey) => (v: string) => setForm(f => ({...f, [k]: v}));
  const setScenario = (i: number, k: keyof ScenarioForm) => (v: string) => setForm(f => ({...f, scenarios: f.scenarios.map((s, j) => (j === i ? {...s, [k]: v} : s))}));
  const addScenario = () => setForm(f => ({...f, scenarios: [...f.scenarios, {name: `Scenario ${String.fromCharCode(66 + f.scenarios.length)}`, packets: f.packets, malicious_pct: f.malicious_pct, tpr_pct: f.tpr_pct, fpr_pct: f.fpr_pct}]}));
  const res = run?.result, e = res?.expected, sim = res?.simulated, inp = res?.inputs;
  const coreErrorFields = new Set<string>([...CORE.map(c => c[0]), 'seed', ...form.scenarios.flatMap((_, i) => [...CORE.map(c => `scenarios.${i}.${c[0]}`)])]);

  return <>
    <Laws topic="ids" ar={ar} open={false}/>
    <section className="panel lab-inputs">
      <div className="section-heading"><div><span className="eyebrow">{t('INPUTS', 'المدخلات')}</span><h2>{t('Traffic & detector parameters', 'معاملات الحركة ونظام الكشف')}</h2></div></div>
      <div className="lab-grid">
        {CORE.map(([k, sym, suffix]) => <NumField key={k} ar={ar} label={IDS_LABELS[k]} symbol={sym} suffix={suffix} value={form[k]} onChange={setCore(k)} error={errorFor(fieldErrors, k)}
          hint={suffix ? t('0 – 100, decimals allowed', 'من 0 إلى 100، يقبل الكسور') : t('Whole number ≥ 1', 'عدد صحيح ≥ 1')}/>)}
      </div>
      <div className="mc-row">
        <label className="switch"><input type="checkbox" checked={form.monte_carlo} onChange={ev => setForm(f => ({...f, monte_carlo: ev.target.checked}))}/><span aria-hidden="true"/>
          <b><Dices size={15}/>{t('Monte Carlo Simulation', 'محاكاة مونت كارلو')}</b></label>
        <small>{t(`Generate N virtual packets and classify them randomly (max ${MAX_MC_PACKETS.toLocaleString('en')}).`, `توليد N حزمة افتراضية وتصنيفها عشوائياً (الحد ${MAX_MC_PACKETS.toLocaleString('en')}).`)}</small>
        {form.monte_carlo && <div className="seed"><NumField ar={ar} label={['Random seed', 'البذرة العشوائية']} value={form.seed} onChange={v => setForm(f => ({...f, seed: v}))} error={errorFor(fieldErrors, 'seed')} hint={t('Same seed → same experiment', 'نفس البذرة ← نفس التجربة')}/></div>}
      </div>
      <div className="actions">
        <button className="primary" onClick={() => simulate()} disabled={busy !== null || !parsed.params}>{busy === 'run' ? <Busy label={engine.status === 'loading' ? t('Starting Python…', 'تشغيل Python…') : t('Running…', 'جارٍ التشغيل…')}/> : <><Play size={16}/>{t('Run Simulation', 'تشغيل المحاكاة')}</>}</button>
        <button className="secondary" onClick={() => { setForm(toIdsForm(IDS_DEFAULTS)); setServerErrors([]); simulate(IDS_DEFAULTS); }} disabled={busy !== null}><RotateCcw size={15}/>{t('Reset', 'إعادة الضبط')}</button>
        {stale && <span className="stale">{t('Inputs changed — run again to update the results.', 'تغيّرت المدخلات — شغّل المحاكاة لتحديث النتائج.')}</span>}
      </div>
      <ErrorBox errors={fieldErrors} ar={ar} fields={coreErrorFields}/>
      {status && <p className="lab-status" role="status">{status}</p>}
    </section>

    {res && e && inp && <div className={stale ? 'lab-results is-stale' : 'lab-results'}>
      <div className="lab-results-head"><h2>{t('Expected results (theory)', 'النتائج المتوقعة (نظرياً)')}</h2><RunInfo engine={run!.engine} ms={run!.ms} ar={ar}/></div>
      <div className="ids-top">
        <div className="lab-stats three">
          <StatCard tone="i" label={t('Malicious packets', 'حزم خبيثة')} value={e.malicious} render={count} icon={<ShieldAlert size={18}/>} sub={`N × m = ${count(inp.packets)} × ${fmt(inp.malicious_pct)}%`}/>
          <StatCard tone="r" label={t('Benign packets', 'حزم سليمة')} value={e.benign} render={count} icon={<Shield size={18}/>} sub={`N × (1 − m)`}/>
          <StatCard tone="k" label={t('Total alerts', 'إجمالي الإنذارات')} value={e.alerts} render={count} icon={<AlertOctagon size={18}/>} sub={`TP + FP = ${count(e.tp)} + ${count(e.fp)}`}/>
        </div>
        <Gauge value={e.p_malicious_given_alarm} ar={ar}/>
      </div>

      <div className="two-col">
        <section className="panel"><h3>{t('Confusion matrix', 'مصفوفة الالتباس')}</h3>
          <div className="cm" dir="ltr">
            <span/><b>{t('Alarm', 'إنذار')}</b><b>{t('No alarm', 'لا إنذار')}</b>
            <b>{t('Malicious', 'خبيثة')}</b>
            <div className="cm-cell good"><small>TP · {t('true alert', 'إنذار حقيقي')}</small><strong>{count(e.tp)}</strong>{sim && <em>{t('sim', 'محاكاة')} {fmtInt(sim.tp)}</em>}</div>
            <div className="cm-cell bad"><small>FN · {t('missed attack', 'هجوم فائت')}</small><strong>{count(e.fn)}</strong>{sim && <em>{t('sim', 'محاكاة')} {fmtInt(sim.fn)}</em>}</div>
            <b>{t('Benign', 'سليمة')}</b>
            <div className="cm-cell bad"><small>FP · {t('false alert', 'إنذار كاذب')}</small><strong>{count(e.fp)}</strong>{sim && <em>{t('sim', 'محاكاة')} {fmtInt(sim.fp)}</em>}</div>
            <div className="cm-cell good"><small>TN · {t('correctly ignored', 'تجاهل صحيح')}</small><strong>{count(e.tn)}</strong>{sim && <em>{t('sim', 'محاكاة')} {fmtInt(sim.tn)}</em>}</div>
          </div>
          <div className="cm-metrics">
            <span>{t('Accuracy', 'الدقة الكلية')} <b dir="ltr">{pct(e.accuracy)}</b></span><span>Precision <b dir="ltr">{pct(e.p_malicious_given_alarm)}</b></span>
            <span>Recall <b dir="ltr">{pct(inp.tpr_pct / 100)}</b></span><span>NPV <b dir="ltr">{pct(e.p_benign_given_no_alarm, 3)}</b></span><span>F1 <b dir="ltr">{e.f1 === null ? 'N/A' : fmt(e.f1, 3)}</b></span>
          </div>
        </section>
        <section className="panel"><h3>{t('True alerts vs false alerts', 'الإنذارات الحقيقية مقابل الكاذبة')}</h3>
          <div className="chart lab-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={res.chart.alerts.map(a => ({...a, label: a.key === 'tp' ? t('True alerts (TP)', 'إنذارات حقيقية TP') : t('False alerts (FP)', 'إنذارات كاذبة FP')}))} margin={{top: 8, right: 12, bottom: 4, left: 0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="label" tick={{fill: 'var(--muted)', fontSize: 11}}/><YAxis tick={{fill: 'var(--muted)', fontSize: 11}} width={54}/>
            <Tooltip contentStyle={tip} formatter={(v) => fmt(Number(v))}/><Legend/>
            <Bar dataKey="expected" name={t('Expected', 'متوقع')} fill={TRUE_C} radius={[5, 5, 0, 0]}>{res.chart.alerts.map(a => <Cell key={a.key} fill={a.key === 'tp' ? TRUE_C : FALSE_C}/>)}</Bar>
            {sim && <Bar dataKey="simulated" name={t('Simulated (Monte Carlo)', 'محاكاة (مونت كارلو)')} fill="#2b8f7d" radius={[5, 5, 0, 0]}>{res.chart.alerts.map(a => <Cell key={a.key} fill={a.key === 'tp' ? '#2b8f7d' : '#b84a4a'}/>)}</Bar>}
          </BarChart></ResponsiveContainer></div></section>
      </div>

      <section className="panel">
        <Toggle open={bayes} onClick={() => setBayes(!bayes)}><span className="stat-icon tone-1"><Sigma size={18}/></span><span><span className="eyebrow">{t("BAYES' THEOREM WITH YOUR NUMBERS", 'قانون بايز بأرقامك')}</span><strong>{t('Why is an alarm real only part of the time?', 'لماذا لا يكون الإنذار حقيقياً دائماً؟')}</strong></span></Toggle>
        {bayes && <div className="bayes">
          <code className="law-math" dir="ltr">P(M | A) = P(A | M)·P(M) / [ P(A | M)·P(M) + P(A | B)·P(B) ]</code>
          <code className="law-math big" dir="ltr">= ({fmt(e.bayes.p_a_given_m, 4)} × {fmt(e.bayes.p_m, 4)}) / ({fmt(e.bayes.p_a_given_m, 4)} × {fmt(e.bayes.p_m, 4)} + {fmt(e.bayes.p_a_given_b, 4)} × {fmt(e.bayes.p_b, 4)}) = {fmt(e.bayes.p_a_and_m, 5)} / {fmt(e.bayes.p_a, 5)} = <b>{pct(e.bayes.posterior)}</b></code>
          <ol className="steps">
            <li>{t(`Out of ${count(inp.packets)} packets, ${count(e.malicious)} are malicious and ${count(e.benign)} are benign (base rate m = ${fmt(inp.malicious_pct)}%).`, `من أصل ${count(inp.packets)} حزمة، ${count(e.malicious)} خبيثة و ${count(e.benign)} سليمة (النسبة الأساسية m = ${fmt(inp.malicious_pct)}%).`)}</li>
            <li>{t(`The IDS catches ${fmt(inp.tpr_pct)}% of the malicious ones → ${count(e.tp)} true alerts.`, `يكتشف النظام ${fmt(inp.tpr_pct)}% من الخبيثة ← ${count(e.tp)} إنذاراً حقيقياً.`)}</li>
            <li>{t(`It also flags ${fmt(inp.fpr_pct)}% of the benign ones → ${count(e.fp)} false alerts.`, `ويُطلق إنذاراً على ${fmt(inp.fpr_pct)}% من السليمة ← ${count(e.fp)} إنذاراً كاذباً.`)}</li>
            <li>{e.alerts === 0 ? t('There are no alarms at all, so P(M | A) is undefined (no division by zero).', 'لا توجد أي إنذارات، لذلك P(M | A) غير معرّف (لا قسمة على صفر).')
              : t(`So of ${count(e.alerts)} alarms only ${count(e.tp)} are real: ${count(e.tp)} / ${count(e.alerts)} = ${pct(e.p_malicious_given_alarm)}.`, `إذن من أصل ${count(e.alerts)} إنذاراً، ${count(e.tp)} فقط حقيقية: ${count(e.tp)} / ${count(e.alerts)} = ${pct(e.p_malicious_given_alarm)}.`)}</li>
          </ol>
        </div>}
      </section>

      {sim && <section className="panel mc">
        <div className="section-heading"><div><span className="eyebrow">MONTE CARLO · {t('SEED', 'البذرة')} “{sim.seed}”</span><h2>{t('Expected vs simulated results', 'النتائج المتوقعة مقابل المحاكاة')}</h2></div>
          <span className="pill">{fmtInt(sim.packets)} {t('virtual packets', 'حزمة افتراضية')}</span></div>
        <div className="table-wrap"><table className="lab-table"><thead><tr><th>{t('Quantity', 'الكمية')}</th><th>{t('Expected (theory)', 'متوقع (نظري)')}</th><th>{t('Simulated (sample)', 'محاكاة (عينة)')}</th><th>{t('Difference', 'الفرق')}</th></tr></thead>
          <tbody>{([['malicious', t('Malicious', 'خبيثة')], ['benign', t('Benign', 'سليمة')], ['tp', 'TP'], ['fn', 'FN'], ['fp', 'FP'], ['tn', 'TN'], ['alerts', t('Total alerts', 'إجمالي الإنذارات')]] as const).map(([k, label]) =>
            <tr key={k}><td><strong>{label}</strong></td><td>{fmt(e[k])}</td><td>{fmtInt(sim[k])}</td><td className={sim[k] - e[k] >= 0 ? 'c-r' : 'c-i'}>{(sim[k] - e[k] >= 0 ? '+' : '') + fmt(sim[k] - e[k])}</td></tr>)}
            <tr><td><strong>P(M | A)</strong></td><td>{pct(e.p_malicious_given_alarm)}</td><td>{pct(sim.p_malicious_given_alarm)}{sim.ppv_margin95 !== null && <small className="muted"> ± {pct(sim.ppv_margin95)}</small>}</td>
              <td>{e.p_malicious_given_alarm !== null && sim.p_malicious_given_alarm !== null ? `${fmt((sim.p_malicious_given_alarm - e.p_malicious_given_alarm) * 100)} pp` : 'N/A'}</td></tr>
          </tbody></table></div>
        <details><summary>{t(`Packet log – first ${sim.sample.length} virtual packets`, `سجل الحزم – أول ${sim.sample.length} حزمة افتراضية`)}</summary>
          <div className="table-wrap short"><table className="lab-table"><thead><tr><th>#</th><th>U₁</th><th>{t('Malicious?', 'خبيثة؟')} (U₁ &lt; m)</th><th>U₂</th><th>{t('Alarm?', 'إنذار؟')}</th><th>{t('Outcome', 'النتيجة')}</th></tr></thead>
            <tbody>{sim.sample.map(s => <tr key={s.packet}><td>{s.packet}</td><td>{s.u_class.toFixed(4)}</td><td>{s.malicious ? t('Yes', 'نعم') : t('No', 'لا')}</td><td>{s.u_alarm.toFixed(4)}</td><td>{s.alarm ? t('Yes', 'نعم') : t('No', 'لا')}</td>
              <td><span className={`outcome ${s.outcome}`}>{s.outcome}</span></td></tr>)}</tbody></table></div></details>
        <p className="muted lab-note">{t('Expected results are exact mathematics; simulated results are one random sample and change with the seed. Increase N to see them converge.', 'النتائج المتوقعة رياضية دقيقة؛ والنتائج المحاكاة عينة عشوائية واحدة تتغير بتغيّر البذرة. زد N لترى اقترابها من القيم النظرية.')}</p>
      </section>}
    </div>}

    <section className="panel compare" ref={compareRef}>
      <div className="section-heading"><div><span className="eyebrow">{t('WHAT IF?', 'ماذا لو؟')}</span><h2>{t('Compare scenarios', 'مقارنة السيناريوهات')}</h2>
        <p>{t('The current inputs are always the first scenario. Edit the others (default: the 1% case from the question).', 'المدخلات الحالية هي دائماً السيناريو الأول. عدّل البقية (الافتراضي: حالة 1% من السؤال).')}</p></div></div>
      <div className="scenario-list">
        {form.scenarios.map((s, i) => <div className="scenario" key={i}>
          <div className="lab-field wide"><label>{t('Name', 'الاسم')}</label><div className="lab-input"><input value={s.name} onChange={ev => setScenario(i, 'name')(ev.target.value)}/></div></div>
          {CORE.map(([k, sym, suffix]) => <NumField key={k} ar={ar} label={IDS_LABELS[k]} symbol={sym} suffix={suffix} value={s[k]} onChange={setScenario(i, k)} error={errorFor(fieldErrors, `scenarios.${i}.${k}`)}/>)}
          <button className="icon remove" aria-label={t('Remove scenario', 'حذف السيناريو')} onClick={() => setForm(f => ({...f, scenarios: f.scenarios.filter((_, j) => j !== i)}))}><Trash2 size={16}/></button>
        </div>)}
      </div>
      <div className="actions">
        <button className="primary" onClick={() => simulate(parsed.params, 'compare')} disabled={busy !== null || !parsed.params}>{busy === 'compare' ? <Busy label={t('Comparing…', 'جارٍ المقارنة…')}/> : <><GitCompareArrows size={16}/>{t('Compare Scenarios', 'مقارنة السيناريوهات')}</>}</button>
        <button className="secondary" onClick={addScenario} disabled={form.scenarios.length >= MAX_SCENARIOS}><Plus size={15}/>{t('Add scenario', 'إضافة سيناريو')}</button>
        <button className="text-button" onClick={() => setForm(f => ({...f, malicious_pct: '5', scenarios: toIdsForm(IDS_DEFAULTS).scenarios}))}>{t('Load 5% vs 1% example', 'تحميل مثال 5% مقابل 1%')}</button>
      </div>
      {res && <>
        <div className="table-wrap"><table className="lab-table"><thead><tr><th>{t('Scenario', 'السيناريو')}</th><th>N</th><th>m</th><th>TPR</th><th>FPR</th><th>TP</th><th>FP</th><th>{t('Alerts', 'الإنذارات')}</th><th>P(M | A)</th></tr></thead>
          <tbody>{res.comparison.map((c, i) => <tr key={i}><td><strong>{i === 0 ? t('Current inputs', 'المدخلات الحالية') : c.name}</strong></td><td>{fmtInt(c.inputs.packets)}</td><td>{fmt(c.inputs.malicious_pct)}%</td><td>{fmt(c.inputs.tpr_pct)}%</td><td>{fmt(c.inputs.fpr_pct)}%</td>
            <td className="c-r">{count(c.expected.tp)}</td><td className="c-i">{count(c.expected.fp)}</td><td>{count(c.expected.alerts)}</td><td><b>{pct(c.expected.p_malicious_given_alarm)}</b></td></tr>)}</tbody></table></div>
        <div className="two-col">
          <div className="chart lab-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={res.chart.scenarios.map((s, i) => ({...s, name: i === 0 ? t('Current', 'الحالي') : s.name}))} margin={{top: 8, right: 12, bottom: 4, left: 0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="name" tick={{fill: 'var(--muted)', fontSize: 11}}/><YAxis tick={{fill: 'var(--muted)', fontSize: 11}} width={54}/><Tooltip contentStyle={tip} formatter={(v) => fmt(Number(v))}/><Legend/>
            <Bar dataKey="tp" name={t('True alerts (TP)', 'إنذارات حقيقية')} fill={TRUE_C} radius={[4, 4, 0, 0]}/><Bar dataKey="fp" name={t('False alerts (FP)', 'إنذارات كاذبة')} fill={FALSE_C} radius={[4, 4, 0, 0]}/>
          </BarChart></ResponsiveContainer></div>
          <div className="chart lab-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={res.chart.scenarios.map((s, i) => ({name: i === 0 ? t('Current', 'الحالي') : s.name, ppv: s.ppv === null ? 0 : s.ppv * 100}))} margin={{top: 8, right: 12, bottom: 4, left: 0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="name" tick={{fill: 'var(--muted)', fontSize: 11}}/><YAxis domain={[0, 100]} unit="%" tick={{fill: 'var(--muted)', fontSize: 11}} width={54}/><Tooltip contentStyle={tip} formatter={(v) => `${fmt(Number(v))}%`}/><Legend/>
            <Bar dataKey="ppv" name="P(Malicious | Alarm)" fill={PPV_C} radius={[4, 4, 0, 0]}/>
          </BarChart></ResponsiveContainer></div>
        </div>
      </>}
    </section>

    <section className="panel lab-excel">
      <div className="section-heading"><div><span className="eyebrow">EXCEL · OPENPYXL</span><h2>{t('Download Excel', 'تنزيل Excel')}</h2>
        <p>{t('Four sheets with live formulas: Inputs, Detection Results (TP/TN/FP/FN + confusion matrix), Bayes Calculation (step by step to P(M|A)) and Scenario Comparison with charts. Monte Carlo counts are included as a static sample when the mode is on.',
          'أربع أوراق بمعادلات حية: Inputs، و Detection Results (TP/TN/FP/FN ومصفوفة الالتباس)، و Bayes Calculation (خطوة بخطوة حتى P(M|A))، و Scenario Comparison مع الرسوم. تُضاف نتائج مونت كارلو كعينة ثابتة عند تفعيلها.')}</p></div>
        <button className="primary" onClick={download} disabled={busy !== null || !parsed.params}>{busy === 'excel' ? <Busy label={t('Building…', 'جارٍ الإنشاء…')}/> : <><Download size={16}/>{t('Download Excel', 'تنزيل Excel')}</>}</button></div>
      <div className="lab-sheets" dir="ltr">
        <div><b>Inputs</b><code>TotalPackets · MaliciousRate · DetectionRate · FalsePositiveRate</code></div>
        <div><b>Detection Results</b><code>C7 =C5*DetectionRate   C9 =C6*FalsePositiveRate{'\n'}C13 =IF(C11=0,"N/A",C7/C11)</code></div>
        <div><b>Bayes Calculation</b><code>P(A)=P(A|M)P(M)+P(A|B)P(B) · P(M|A)=P(A∩M)/P(A)</code></div>
        <div><b>Scenario Comparison</b><code>Current row linked to Inputs + editable rows + 2 charts</code></div>
      </div>
    </section>
  </>;
}

const fmtInt = (v: number) => v.toLocaleString('en-US');

function Gauge({value, ar}: {value: number | null; ar: boolean}) {
  const t = tr(ar);
  const v = value ?? 0;
  const angle = Math.PI * (1 - v);
  const r = 80, cx = 100, cy = 96;
  const x = cx + r * Math.cos(angle), y = cy - r * Math.sin(angle);
  const hue = Math.round(4 + v * 150);
  return <div className="gauge panel" role="img" aria-label={`P(Malicious | Alarm) = ${pct(value)}`}>
    <small>{t('Probability that an alarm is real', 'احتمال أن يكون الإنذار حقيقياً')}</small>
    <svg viewBox="0 0 200 112">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} className="gauge-track"/>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} className="gauge-fill" pathLength={100} strokeDasharray={`${v * 100} 100`} style={{stroke: `hsl(${hue} 70% 58%)`}}/>
      {value !== null && <circle cx={x} cy={y} r={6} className="gauge-dot" style={{fill: `hsl(${hue} 70% 58%)`}}/>}
    </svg>
    <strong dir="ltr">{pct(value)}</strong>
    <span>{value === null ? t('No alarms – undefined', 'لا توجد إنذارات – غير معرّف') : t(`${pct(1 - v)} of alarms are false`, `${pct(1 - v)} من الإنذارات كاذبة`)}</span>
    <em dir="ltr">P(Malicious | Alarm)</em>
  </div>;
}
