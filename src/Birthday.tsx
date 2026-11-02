import {useMemo, useState, type ChangeEvent} from 'react';
import {Download, FileSignature, KeyRound, PartyPopper, Play, RotateCcw, Sigma, Users, Zap} from 'lucide-react';
import {CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {DAYS, HALF_FACTOR, HASHES, collisionApprox, collisionExact, dayLabel, estimate, exactProbability, findMatches, findSignatureCollision, hashCollision, nForProbability, pairs, randomGroup, sci, smallestGroupFor, sweep, type AttackResult, type SweepRow} from './birthday';
import {rng} from './engine';
import {birthdayFormulas} from './excelFormulas';
import Laws from './Laws';

const MAX = 100;
const COLORS = ['#ff8a65', '#40cdb3', '#ba8aff', '#f5c451', '#6687ff', '#ff7eb6'];
const pct = (p: number) => `${(p * 100).toFixed(2)}%`;
const f4 = (p: number) => p.toFixed(4);
const tipStyle = {background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10};
const curve = Array.from({length: MAX}, (_, i) => ({n: i + 1, p: +(exactProbability(i + 1) * 100).toFixed(2), a: +(collisionApprox(i + 1) * 100).toFixed(2)}));
type Tab = 'room' | 'laws' | 'experiment' | 'hash' | 'session';

export default function Birthday({ar}: {ar: boolean}) {
  const t = (en: string, a: string) => (ar ? a : en);
  const [tab, setTab] = useState<Tab>('room');
  const [n, setN] = useState(23);
  const [experiment, setExperiment] = useState<{rows: SweepRow[]; N: number; seed: string} | null>(null);
  const [session, setSession] = useState({bits: 16, active: 302});
  const [status, setStatus] = useState('');

  async function download() {
    setStatus(t('Preparing workbook…', 'جارٍ إعداد المصنف…'));
    try {
      const e = await import('./export');
      await e.exportBirthday({n, experiment: experiment?.rows, experimentN: experiment?.N, seed: experiment?.seed, sessionBits: session.bits, activeSessions: session.active});
      setStatus(t('Workbook downloaded.', 'تم تنزيل المصنف.'));
    } catch (err) { setStatus(String(err)); }
  }

  const tabs: [Tab, string, string][] = [
    ['room', 'Interactive room', 'الغرفة التفاعلية'],
    ['laws', 'Laws & worked solution (Part 1)', 'القوانين والحل (الجزء الأول)'],
    ['experiment', 'Simulation experiment (Part 3)', 'تجربة المحاكاة (الجزء الثالث)'],
    ['hash', 'Hashes & signatures (Part 2)', 'التجزئة والتوقيع (الجزء الثاني)'],
    ['session', 'Session IDs', 'معرّفات الجلسات'],
  ];
  return <>
    <div className="tabs" role="tablist">{tabs.map(([id, en, a]) =>
      <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'secondary selected' : 'secondary'} onClick={() => setTab(id)}>{t(en, a)}</button>)}
    </div>
    {tab === 'room' && <Room ar={ar} n={n} setN={setN}/>}
    {tab === 'laws' && <LawsTab ar={ar} n={n}/>}
    {tab === 'experiment' && <Experiment ar={ar} result={experiment} onResult={setExperiment}/>}
    {tab === 'hash' && <Hashes ar={ar}/>}
    {tab === 'session' && <Sessions ar={ar} value={session} onChange={setSession}/>}
    <section className="panel">
      <div className="section-heading"><div><h2>{t('Keep experimenting inside Excel', 'كمّل التجربة داخل إكسل')}</h2>
        <p>{t('One live worksheet: inputs (N, n, target), every law with its Excel formula, the exact-vs-approximate table for k = 1…100, your simulation experiment, hash and session-ID tables, and 200 random rooms that change with F9.',
          'ورقة واحدة حية: المدخلات (N و n والاحتمال المستهدف)، وكل القوانين مع صيغ إكسل، وجدول الصيغة الدقيقة مقابل التقريب لـ k = 1…100، ونتائج تجربة المحاكاة، وجداول التجزئة ومعرّفات الجلسات، و200 غرفة عشوائية تتغير مع F9.')}</p></div>
        <button className="primary" onClick={download}><Download size={16}/>{t('Download live Excel workbook', 'تنزيل مصنف إكسل بالمعادلات')}</button></div>
      {status && <p role="status">{status}</p>}
      <div className="callout">{experiment ? t(`Your last experiment (${experiment.rows.length} group sizes, ${experiment.rows[0].trials.toLocaleString()} trials each) will be included.`, `ستُضاف تجربتك الأخيرة (${experiment.rows.length} قيمة لـ n، و${experiment.rows[0].trials.toLocaleString()} تجربة لكل قيمة).`)
        : t('You have not run the Part 3 experiment yet; the workbook will include a fresh run with n = 5…70 and 10,000 trials each.', 'لم تشغّل تجربة الجزء الثالث بعد؛ سيحتوي المصنف على تشغيل جديد لـ n = 5…70 بعدد 10,000 تجربة لكل قيمة.')}</div>
      <details><summary>{t('Exact formulas written in the workbook', 'الصيغ الفعلية المكتوبة في المصنف')}</summary>
        <div className="table-wrap formula-list"><table><thead><tr><th>{t('Cell', 'الخلية')}</th><th>{t('Purpose', 'الوظيفة')}</th><th>{t('Formula', 'الصيغة')}</th></tr></thead>
          <tbody>{birthdayFormulas().map(c => <tr key={c.address}><td><strong>{c.address}</strong></td><td>{c.label}</td><td><code dir="ltr">={c.formula}</code></td></tr>)}</tbody></table></div>
      </details>
    </section>
  </>;
}

// ---------------------------------------------------------------------------
function Room({ar, n, setN}: {ar: boolean; n: number; setN: (n: number) => void}) {
  const t = (en: string, a: string) => (ar ? a : en);
  const [group, setGroup] = useState<number[] | null>(null);
  const [tally, setTally] = useState({rooms: 0, hits: 0});
  const [batch, setBatch] = useState<number | null>(null);
  const matches = useMemo(() => (group ? findMatches(group) : []), [group]);
  const colorOf = useMemo(() => {
    const m = new Map<number, string>();
    matches.forEach((match, i) => match.people.forEach(p => m.set(p, COLORS[i % COLORS.length])));
    return m;
  }, [matches]);
  const theory = exactProbability(n);
  function changeSize(value: number) {
    setN(Math.min(MAX, Math.max(2, Math.round(value) || 2)));
    setGroup(null); setTally({rooms: 0, hits: 0}); setBatch(null);
  }
  function fillRoom() {
    const g = randomGroup(n);
    setGroup(g);
    setTally(s => ({rooms: s.rooms + 1, hits: s.hits + (findMatches(g).length ? 1 : 0)}));
  }
  return <>
    <div className="two-col">
      <section className="panel bday-stage">
        <span className="eyebrow">{t('ONE CLICK. ONE ROOM FULL OF PEOPLE.', 'نقرة واحدة، غرفة مليئة بالأشخاص.')}</span>
        <h2>{t('How many people are in the room?', 'كم شخصاً في الغرفة؟')}</h2>
        <div className="bday-size">
          <input type="range" min="2" max={MAX} value={n} aria-label={t('Group size', 'عدد الأشخاص')} onChange={e => changeSize(+e.target.value)}/>
          <input type="number" min="2" max={MAX} value={n} aria-label={t('Group size', 'عدد الأشخاص')} onChange={e => changeSize(+e.target.value)}/>
        </div>
        <div className="actions">
          <button className="primary" onClick={fillRoom}><Users size={16}/>{t('Fill the room', 'املأ الغرفة')}</button>
          <button className="secondary" onClick={() => changeSize(23)}>{t('Try 23', 'جرّب 23')}</button>
        </div>
        <div className={`bday-result ${group ? (matches.length ? 'hit' : 'miss') : ''}`} role="status">
          {!group ? t('Press "Fill the room" to give everyone a random birthday.', 'اضغط "املأ الغرفة" ليحصل كل شخص على يوم ميلاد عشوائي.')
            : matches.length ? <><PartyPopper size={18}/>{t(`Match! ${matches.length} shared birthday${matches.length > 1 ? 's' : ''} in this room.`, `يوجد تطابق! ${matches.length} يوم ميلاد مشترك في هذه الغرفة.`)}</>
            : t('No shared birthday this time. Try again!', 'لا يوجد تطابق هذه المرة. حاول مرة أخرى!')}
        </div>
        {matches.length > 0 && <ul className="bday-matches">{matches.map((m, i) =>
          <li key={m.day}><span className="swatch" style={{background: COLORS[i % COLORS.length]}}/>
            <strong>{dayLabel(m.day, ar)}</strong> — {m.people.map(p => `#${p + 1}`).join(t(' & ', ' و '))}
          </li>)}
        </ul>}
      </section>
      <section className="panel">
        <h2>{t('What are the chances?', 'ما الاحتمال؟')}</h2>
        <div className="metric-grid bday-metrics">
          <div className="metric"><small>{t('Chance of a match (exact)', 'احتمال التطابق (الصيغة الدقيقة)')}</small><strong>{f4(theory)}</strong><span>{t(`for ${n} people`, `لـ ${n} شخصاً`)}</span></div>
          <div className="metric"><small>{t('Pairs to compare', 'عدد الأزواج')}</small><strong>{pairs(n).toLocaleString()}</strong><span>n(n−1)/2</span></div>
          <div className="metric"><small>{t('Your rooms', 'غرفك')}</small><strong>{tally.hits} / {tally.rooms}</strong><span>{tally.rooms ? t(`${pct(tally.hits / tally.rooms)} had a match`, `${pct(tally.hits / tally.rooms)} فيها تطابق`) : t('none yet', 'لا شيء بعد')}</span></div>
          <div className="metric"><small>{t('1,000 rooms at once', '1,000 غرفة دفعة واحدة')}</small><strong>{batch === null ? '—' : f4(batch)}</strong><span>{t('simulated estimate', 'تقدير بالمحاكاة')}</span></div>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => setBatch(estimate(n, 1000))}><Zap size={16}/>{t('Simulate 1,000 rooms', 'حاكِ 1,000 غرفة')}</button>
          <button className="secondary" onClick={() => { setTally({rooms: 0, hits: 0}); setBatch(null); setGroup(null); }}><RotateCcw size={16}/>{t('Reset', 'إعادة')}</button>
        </div>
        <div className="callout">
          {t(`Only ${smallestGroupFor(0.5)} people give a better-than-even chance, and ${smallestGroupFor(0.99)} people make it 99%. It feels wrong because we think "someone with MY birthday", but every pair counts: ${n} people make ${pairs(n).toLocaleString()} pairs.`,
            `يكفي ${smallestGroupFor(0.5)} شخصاً ليتجاوز الاحتمال 50%، و${smallestGroupFor(0.99)} شخصاً ليصل إلى 99%. تبدو النتيجة غريبة لأننا نفكر في "شخص يشاركني يوم ميلادي أنا"، لكن كل زوج من الأشخاص فرصة للتطابق: ${n} شخصاً يكوّنون ${pairs(n).toLocaleString()} زوجاً.`)}
        </div>
      </section>
    </div>
    {group && <section className="panel">
      <h2>{t('The room', 'الغرفة')}</h2>
      <p className="muted">{t('Each card is one person and their random birthday. Same color = same birthday.', 'كل بطاقة تمثل شخصاً ويوم ميلاده العشوائي. اللون نفسه = يوم الميلاد نفسه.')}</p>
      <div className="bday-grid">{group.map((day, i) => {
        const c = colorOf.get(i);
        return <div key={i} className={c ? 'person match' : 'person'} style={c ? {borderColor: c, background: `${c}22`} : undefined}>
          <small>#{i + 1}</small><strong style={c ? {color: c} : undefined}>{dayLabel(day, ar)}</strong>
        </div>;
      })}</div>
    </section>}
    <section className="panel">
      <h2>{t('Chance of a shared birthday by group size', 'احتمال وجود يوم ميلاد مشترك حسب عدد الأشخاص')}</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve} margin={{top: 10, right: 16, bottom: 0, left: -10}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
            <XAxis dataKey="n" type="number" domain={[1, MAX]} ticks={[1, 10, 23, 30, 40, 50, 57, 70, 85, 100]} tick={{fill: 'var(--muted)', fontSize: 11}}/>
            <YAxis domain={[0, 100]} unit="%" tick={{fill: 'var(--muted)', fontSize: 11}}/>
            <Tooltip formatter={(v, name) => [`${v}%`, name === 'p' ? t('Exact', 'الدقيق') : t('Approximation', 'التقريب')]} labelFormatter={v => t(`${v} people`, `${v} شخصاً`)} contentStyle={tipStyle}/>
            <ReferenceLine y={50} stroke="var(--muted)" strokeDasharray="4 4"/>
            <Line type="monotone" dataKey="p" stroke="#6687ff" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
            <Line type="monotone" dataKey="a" stroke="#40cdb3" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false}/>
            <ReferenceDot x={n} y={+(theory * 100).toFixed(2)} r={6} fill="#ff8a65" stroke="var(--panel)" strokeWidth={2}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="callout">
        <strong>{t('The math in one line', 'الرياضيات في سطر واحد')}:</strong> <span dir="ltr">p(n) = 1 − (365/365 × 364/365 × … × (365−n+1)/365)</span>
        <br/>{t('Dashed line: the approximation 1 − e^(−n(n−1)/730).', 'الخط المتقطع: التقريب 1 − e^(−n(n−1)/730).')}
        <br/>{t('Assumes 365 equally likely birthdays (no 29 February). See the "Laws" tab for every step.', 'نفترض 365 يوماً متساوية الاحتمال (بدون 29 فبراير). راجع تبويب "القوانين" لكل الخطوات.')}
      </div>
    </section>
  </>;
}

// ---------------------------------------------------------------------------
function LawsTab({ar, n: roomN}: {ar: boolean; n: number}) {
  const t = (en: string, a: string) => (ar ? a : en);
  const [N, setN] = useState(DAYS);
  const [n, setn] = useState(roomN);
  const safeN = Math.max(2, Math.round(N) || 2), safen = Math.max(1, Math.round(n) || 1);
  const factors = Array.from({length: Math.min(safen, 6)}, (_, k) => `${safeN - k}/${safeN}`);
  const exponent = safen * (safen - 1) / (2 * safeN), n50 = nForProbability(0.5, safeN);
  return <>
    <Laws topic="birthday" ar={ar}/>
    <section className="panel">
      <span className="eyebrow">{t('PART 1 · Q2 & Q3', 'الجزء الأول · س2 و س3')}</span>
      <h2>{t('Worked solution: exact formula vs approximation (N = 365)', 'الحل: الصيغة الدقيقة مقابل التقريب (N = 365)')}</h2>
      <div className="table-wrap"><table><thead><tr><th>n</th><th>{t('Pairs', 'الأزواج')}</th><th>{t('Exact p(n)', 'الدقيق p(n)')}</th><th>{t('Approx 1−e^(−n(n−1)/2N)', 'التقريب')}</th><th>{t('Difference', 'الفرق')}</th></tr></thead>
        <tbody>{[10, 23, 50].map(k => <tr key={k}><td><strong>{k}</strong></td><td>{pairs(k)}</td><td>{f4(collisionExact(k))}</td><td>{f4(collisionApprox(k))}</td><td>{f4(collisionExact(k) - collisionApprox(k))}</td></tr>)}</tbody></table></div>
      <div className="callout">
        <strong>{t('Q3 derivation', 'اشتقاق س3')}:</strong>{' '}
        <span dir="ltr">1 − e^(−n(n−1)/(2N)) = ½ ⇒ n(n−1) = 2N·ln2 ⇒ n² ≈ 2N·ln2 ⇒ n ≈ √(2 ln2)·√N = {HALF_FACTOR.toFixed(4)}·√N</span><br/>
        <span dir="ltr">N = 365 ⇒ n ≈ 1.1774 × 19.1050 = {nForProbability(0.5).toFixed(4)} → 23</span>{' '}
        {t(`and indeed p(23) = ${f4(collisionExact(23))} exactly, versus ${f4(collisionApprox(23))} from the approximation.`, `وبالفعل p(23) = ${f4(collisionExact(23))} بالصيغة الدقيقة، مقابل ${f4(collisionApprox(23))} بالتقريب.`)}
      </div>
    </section>
    <section className="panel">
      <h2><Sigma size={18}/> {t('Calculate it yourself, step by step', 'احسبها بنفسك خطوة بخطوة')}</h2>
      <div className="controls">
        <label>{t('N — number of possible values', 'N — عدد القيم الممكنة')}<input type="number" min="2" value={N} onChange={e => setN(+e.target.value)}/></label>
        <label>{t('n — people / items', 'n — عدد الأشخاص / العناصر')}<input type="number" min="1" value={n} onChange={e => setn(+e.target.value)}/></label>
      </div>
      <ol className="steps">
        <li>{t('All different:', 'الجميع مختلفون:')} <code dir="ltr">Q(n) = {factors.join(' × ')}{safen > 6 ? ' × …' : ''} = {f4(1 - collisionExact(safen, safeN))}</code></li>
        <li>{t('Complement:', 'المتممة:')} <code dir="ltr">p(n) = 1 − Q(n) = {f4(collisionExact(safen, safeN))}</code></li>
        <li>{t('Approximation:', 'التقريب:')} <code dir="ltr">n(n−1)/(2N) = {safen}×{safen - 1}/(2×{safeN}) = {f4(exponent)} ⇒ 1 − e^(−{f4(exponent)}) = {f4(collisionApprox(safen, safeN))}</code></li>
        <li>{t('50% point:', 'نقطة 50%:')} <code dir="ltr">n ≈ 1.1774 × √{safeN} = 1.1774 × {Math.sqrt(safeN).toFixed(4)} = {n50.toFixed(4)} → {smallestGroupFor(0.5, safeN)} ({t('exact smallest n', 'أصغر n بالضبط')})</code></li>
      </ol>
    </section>
  </>;
}

// ---------------------------------------------------------------------------
function Experiment({ar, result, onResult}: {ar: boolean; result: {rows: SweepRow[]; N: number; seed: string} | null; onResult: (r: {rows: SweepRow[]; N: number; seed: string}) => void}) {
  const t = (en: string, a: string) => (ar ? a : en);
  const [cfg, setCfg] = useState({from: 5, to: 70, step: 5, trials: 10000, N: DAYS, seed: 'birthday-2026'});
  const [error, setError] = useState('');
  const [study, setStudy] = useState<{T: number; p: number; err: number; margin: number}[] | null>(null);
  const [studyN, setStudyN] = useState(23);
  const set = (k: keyof typeof cfg) => (e: ChangeEvent<HTMLInputElement>) => setCfg({...cfg, [k]: k === 'seed' ? e.target.value : +e.target.value});
  function run() {
    const points = Math.floor((cfg.to - cfg.from) / cfg.step) + 1;
    if (!(cfg.from >= 2 && cfg.to <= 100 && cfg.step >= 1 && cfg.to >= cfg.from && points <= 40 && cfg.trials >= 10 && cfg.trials <= 200000 && cfg.N >= 2 && Number.isInteger(cfg.N))) {
      setError(t('Use 2 ≤ from ≤ to ≤ 100, step ≥ 1 (at most 40 points), 10–200,000 trials and a whole N ≥ 2.', 'استخدم 2 ≤ البداية ≤ النهاية ≤ 100، وخطوة ≥ 1 (40 نقطة كحد أقصى)، و10 إلى 200,000 تجربة، وN عدداً صحيحاً ≥ 2.'));
      return;
    }
    setError('');
    onResult({rows: sweep({...cfg, rand: rng(cfg.seed)}), N: cfg.N, seed: cfg.seed});
  }
  function trialStudy() {
    const rand = rng(`${cfg.seed}-trials`), exact = collisionExact(studyN, cfg.N);
    // 10 independent repetitions per T: the mean |error| shows the 1/√T trend without single-run luck.
    setStudy([100, 1000, 10000, 100000].map(T => {const runs = Array.from({length: 10}, () => estimate(studyN, T, rand, cfg.N)); return {T, p: runs[0], err: runs.reduce((a, p) => a + Math.abs(p - exact), 0) / runs.length, margin: 1.96 * Math.sqrt(exact * (1 - exact) / T)};}));
  }
  const rows = result?.rows ?? [];
  const meanErr = rows.length ? rows.reduce((a, r) => a + Math.abs(r.diff), 0) / rows.length : 0;
  const inside = rows.filter(r => Math.abs(r.diff) <= r.margin).length;
  const chart = rows.map(r => ({n: r.n, sim: +(r.simulated * 100).toFixed(2), exact: +(r.exact * 100).toFixed(2), approx: +(r.approx * 100).toFixed(2)}));
  return <>
    <section className="panel">
      <span className="eyebrow">{t('PART 3 · EXERCISE A', 'الجزء الثالث · التمرين أ')}</span>
      <h2>{t('Monte Carlo experiment: simulated vs theoretical', 'تجربة مونت كارلو: النتيجة العملية مقابل النظرية')}</h2>
      <p>{t('For each n from 5 to 70 in steps of 5, run 10,000 random groups, each drawing n birthdays from 1…365, and count the groups with a repeated birthday. The defaults are exactly the assignment’s settings.',
        'لكل قيمة n من 5 إلى 70 بخطوة 5 ننفذ 10,000 تجربة عشوائية، في كل تجربة نسحب n يوم ميلاد من 1 إلى 365 ونعدّ التجارب التي ظهر فيها يوم مكرر. القيم الافتراضية هي إعدادات الواجب نفسها.')}</p>
      <div className="controls">
        <label>{t('n from', 'n من')}<input type="number" value={cfg.from} onChange={set('from')}/></label>
        <label>{t('to', 'إلى')}<input type="number" value={cfg.to} onChange={set('to')}/></label>
        <label>{t('step', 'الخطوة')}<input type="number" value={cfg.step} onChange={set('step')}/></label>
        <label>{t('Trials per n', 'عدد التجارب لكل n')}<input type="number" value={cfg.trials} onChange={set('trials')}/></label>
        <label>N<input type="number" value={cfg.N} onChange={set('N')}/></label>
        <label>{t('Random seed', 'البذرة العشوائية')}<input value={cfg.seed} onChange={set('seed')}/></label>
      </div>
      <div className="actions"><button className="primary" onClick={run}><Play size={16}/>{t('Run the experiment', 'شغّل التجربة')}</button><span className="muted">{t('Same seed → same results (reproducible).', 'نفس البذرة ← نفس النتائج (قابلة للتكرار).')}</span></div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    {rows.length > 0 && <>
      <section className="panel">
        <h2>{t('Simulated and theoretical curves', 'المنحنى العملي والمنحنى النظري')}</h2>
        <div className="chart"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart} margin={{top: 10, right: 16, bottom: 0, left: -10}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
            <XAxis dataKey="n" tick={{fill: 'var(--muted)', fontSize: 11}}/>
            <YAxis domain={[0, 100]} unit="%" tick={{fill: 'var(--muted)', fontSize: 11}}/>
            <Tooltip contentStyle={tipStyle} formatter={v => `${v}%`} labelFormatter={v => `n = ${v}`}/>
            <Legend/>
            <Line dataKey="exact" name={t('Theoretical (exact)', 'النظري (الدقيق)')} stroke="#6687ff" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
            <Line dataKey="approx" name={t('Approximation', 'التقريب')} stroke="#40cdb3" strokeDasharray="5 4" dot={false} isAnimationActive={false}/>
            <Line dataKey="sim" name={t('Simulated', 'العملي (المحاكاة)')} stroke="#ff8a65" strokeWidth={0} dot={{r: 4, fill: '#ff8a65'}} isAnimationActive={false}/>
          </LineChart>
        </ResponsiveContainer></div>
      </section>
      <section className="panel">
        <h2>{t('Results table', 'جدول النتائج')}</h2>
        <div className="table-wrap"><table><thead><tr><th>n</th><th>{t('Trials', 'التجارب')}</th><th>{t('Simulated p̂', 'العملي p̂')}</th><th>{t('Exact p(n)', 'النظري p(n)')}</th><th>{t('Approx', 'التقريب')}</th><th>p̂ − p</th><th>{t('95% margin', 'هامش 95%')}</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.n}><td><strong>{r.n}</strong></td><td>{r.trials.toLocaleString()}</td><td>{f4(r.simulated)}</td><td>{f4(r.exact)}</td><td>{f4(r.approx)}</td><td className={Math.abs(r.diff) <= r.margin ? 'good' : 'error'}>{r.diff >= 0 ? '+' : ''}{f4(r.diff)}</td><td>±{f4(r.margin)}</td></tr>)}</tbody></table></div>
        <div className="callout">{t(
          `Mean absolute difference = ${f4(meanErr)}. ${inside} of ${rows.length} points lie inside the 95% sampling margin 1.96·√(p(1−p)/T). The small differences are random sampling error, not a mistake in the formula: each simulated value is a proportion from T independent trials, so its standard error is √(p(1−p)/T). It is largest near p = 0.5 and shrinks like 1/√T — ten times more trials make the error about √10 ≈ 3.16 times smaller.`,
          `متوسط الفرق المطلق = ${f4(meanErr)}. تقع ${inside} من ${rows.length} نقطة داخل هامش الخطأ 95% وهو 1.96·√(p(1−p)/T). الفروق الصغيرة سببها خطأ العينة العشوائي وليس خطأ في الصيغة: كل قيمة عملية هي نسبة من T تجربة مستقلة، وخطؤها المعياري √(p(1−p)/T)، ويكون أكبر قرب p = 0.5 ويصغر بمعدل 1/√T؛ أي أن زيادة التجارب عشر مرات تقلل الخطأ نحو √10 ≈ 3.16 مرة.`)}</div>
      </section>
    </>}
    <section className="panel">
      <h2>{t('How does the difference change with the number of trials?', 'كيف يتغير الفرق بتغيّر عدد التجارب؟')}</h2>
      <div className="controls"><label>n<input type="number" value={studyN} min="2" max="100" onChange={e => setStudyN(Math.min(100, Math.max(2, +e.target.value || 2)))}/></label></div>
      <div className="actions"><button className="secondary" onClick={trialStudy}><Zap size={16}/>{t('Compare 100 / 1,000 / 10,000 / 100,000 trials', 'قارن 100 / 1,000 / 10,000 / 100,000 تجربة')}</button></div>
      {study && <div className="table-wrap"><table><thead><tr><th>{t('Trials T', 'عدد التجارب T')}</th><th>{t('p̂ (first run)', 'p̂ (أول تكرار)')}</th><th>{t('Exact', 'الدقيق')}</th><th>{t('Mean |p̂ − p| over 10 runs', 'متوسط |p̂ − p| في 10 تكرارات')}</th><th>{t('Expected 95% margin', 'هامش 95% المتوقع')}</th></tr></thead>
        <tbody>{study.map(s => <tr key={s.T}><td>{s.T.toLocaleString()}</td><td>{f4(s.p)}</td><td>{f4(collisionExact(studyN, cfg.N))}</td><td>{f4(s.err)}</td><td>±{f4(s.margin)}</td></tr>)}</tbody></table></div>}
      {study && <div className="callout">{t('Each tenfold increase in T shrinks the typical error by about √10 ≈ 3.16. With 10,000 trials the simulated value is usually within ±0.01 of the exact probability.', 'كل زيادة لعدد التجارب عشر مرات تقلل الخطأ النموذجي نحو √10 ≈ 3.16 مرة. مع 10,000 تجربة تكون القيمة العملية عادة ضمن ±0.01 من الاحتمال الدقيق.')}</div>}
    </section>
  </>;
}

// ---------------------------------------------------------------------------
function Hashes({ar}: {ar: boolean}) {
  const t = (en: string, a: string) => (ar ? a : en);
  const [bits, setBits] = useState(64);
  const [attackBits, setAttackBits] = useState(24);
  const [attack, setAttack] = useState<AttackResult | null>(null);
  const [running, setRunning] = useState(false);
  const custom = hashCollision(Math.max(1, Math.min(1024, Math.round(bits) || 1)));
  const verdict: Record<string, [string, string]> = {
    MD5: ['Broken: practical collisions since 2004; never use for signatures.', 'مكسورة: تصادمات عملية منذ 2004؛ لا تُستخدم للتوقيعات إطلاقاً.'],
    'SHA-1': ['Broken: 2^80 is reachable, and a real collision (SHAttered) was published in 2017; deprecated for signatures.', 'مكسورة: 2^80 أصبح في متناول المهاجمين، ونُشر تصادم حقيقي (SHAttered) عام 2017؛ متوقفة للتوقيعات.'],
    'SHA-256': ['Secure today: ~2^128 work for a collision is far beyond any computer.', 'آمنة حالياً: نحو 2^128 عملية لإيجاد تصادم، وهذا يفوق قدرة أي حاسوب.'],
  };
  async function runAttack() {
    setRunning(true); setAttack(null);
    try { setAttack(await findSignatureCollision(attackBits)); } finally { setRunning(false); }
  }
  const show = (s: string) => s.replace(/ {2}/g, ' ·');
  return <>
    <section className="panel">
      <span className="eyebrow">{t('PART 2 · Q1 & Q2', 'الجزء الثاني · المطلوب 1 و 2')}</span>
      <h2>{t('Why a collision costs 2^(b/2) but a target costs 2^b', 'لماذا يكلف التصادم 2^(b/2) بينما المطابقة لقيمة محددة 2^b؟')}</h2>
      <div className="two-col">
        <div className="callout"><strong>{t('Collision (any two inputs match)', 'التصادم (أي مدخلين متطابقين)')}</strong><br/>
          {t('After k hashes there are k(k−1)/2 pairs, and each pair matches with probability 2^−b. The chance reaches 50% when k(k−1)/2 ≈ ln2·2^b, i.e. k ≈ 1.1774·2^(b/2).', 'بعد k عملية تجزئة يوجد k(k−1)/2 زوجاً، وكل زوج يتطابق باحتمال 2^−b. يصل الاحتمال إلى 50% عندما k(k−1)/2 ≈ ln2·2^b أي k ≈ 1.1774·2^(b/2).')}</div>
        <div className="callout"><strong>{t('Second preimage (match one fixed hash)', 'المطابقة لقيمة محددة سلفاً')}</strong><br/>
          {t('Each attempt only compares with one target, so it succeeds with probability 2^−b. The expected number of attempts is 2^b (≈ 0.69·2^b for 50%). Pairs do not help here.', 'كل محاولة تُقارن بقيمة واحدة فقط، فتنجح باحتمال 2^−b. العدد المتوقع للمحاولات 2^b (≈ 0.69·2^b لاحتمال 50%). هنا لا تساعد الأزواج.')}</div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>{t('Hash', 'الدالة')}</th><th>b</th><th>{t('Hashes for 50% collision', 'عدد التجزئات لتصادم 50%')}</th><th>≈ 2^x</th><th>{t('Preimage ≈ 2^b', 'المطابقة ≈ 2^b')}</th><th>{t('Security', 'مستوى الأمان')}</th><th>{t('Verdict for signatures', 'الحكم للتوقيعات')}</th></tr></thead>
        <tbody>{HASHES.map(h => <tr key={h.name}><td><strong>{h.name}</strong></td><td>{h.bits}</td><td dir="ltr">{sci(h.collision50)}</td><td dir="ltr">2^{h.log2Collision.toFixed(2)}</td><td dir="ltr">{sci(h.preimage)}</td><td>{h.securityBits} bit</td><td style={{whiteSpace: 'normal', minWidth: 220}}>{ar ? verdict[h.name][1] : verdict[h.name][0]}</td></tr>)}
          <tr><td><input type="number" aria-label="bits" value={bits} onChange={e => setBits(+e.target.value)} style={{width: 80}}/></td><td>{custom.bits}</td><td dir="ltr">{sci(custom.collision50)}</td><td dir="ltr">2^{custom.log2Collision.toFixed(2)}</td><td dir="ltr">{sci(custom.preimage)}</td><td>{custom.securityBits} bit</td><td>{t('your own b', 'قيمة b من اختيارك')}</td></tr>
        </tbody></table></div>
    </section>
    <section className="panel">
      <span className="eyebrow">{t('PART 2 · Q3 — LIVE DEMO', 'الجزء الثاني · المطلوب 3 — تجربة حية')}</span>
      <h2><FileSignature size={18}/> {t('Forging a signed contract with a birthday attack', 'تزوير عقد موقّع بهجوم عيد الميلاد')}</h2>
      <p>{t('Real SHA-256 is too long to break, so the demo keeps only its first b bits (a deliberately weak "toy" hash). The attacker writes many invisible variants (extra spaces) of a fair contract (1,000 dollars) and of a fraudulent one (100,000 dollars) until one fair and one fraudulent variant have the same hash.',
        'لا يمكن كسر SHA-256 الكامل، لذلك نأخذ أول b بت فقط منه (دالة ضعيفة متعمدة للتجربة). يكتب المهاجم نسخاً كثيرة غير مرئية الفرق (مسافات إضافية) من عقد عادل (1,000 دولار) ومن عقد احتيالي (100,000 دولار) حتى يجد نسخة عادلة ونسخة احتيالية لهما نفس قيمة التجزئة.')}</p>
      <div className="controls"><label>{t('Toy hash size b (bits)', 'طول التجزئة b (بت)')}<input type="number" min="8" max="28" value={attackBits} onChange={e => setAttackBits(Math.min(28, Math.max(8, +e.target.value || 8)))}/></label></div>
      <div className="actions"><button className="primary" disabled={running} onClick={runAttack}><Play size={16}/>{running ? t('Searching…', 'جارٍ البحث…') : t('Find a collision', 'ابحث عن تصادم')}</button>
        <span className="muted">{t(`Expected ≈ 2·√(2^${attackBits}·ln2) ≈ ${Math.round(2 * Math.sqrt(2 ** attackBits * Math.LN2)).toLocaleString()} hashes; a fixed target would need ≈ ${(2 ** attackBits).toLocaleString()}.`, `المتوقع ≈ 2·√(2^${attackBits}·ln2) ≈ ${Math.round(2 * Math.sqrt(2 ** attackBits * Math.LN2)).toLocaleString()} عملية تجزئة؛ بينما المطابقة لقيمة محددة تحتاج ≈ ${(2 ** attackBits).toLocaleString()}.`)}</span></div>
      {attack && <div className="attack">
        <div className="metric-grid"><div className="metric"><small>{t('Shared hash', 'التجزئة المشتركة')}</small><strong dir="ltr">0x{attack.hash.toString(16).padStart(Math.ceil(attack.bits / 4), '0')}</strong></div>
          <div className="metric"><small>{t('Hashes computed', 'عدد التجزئات')}</small><strong>{attack.attempts.toLocaleString()}</strong><span>{t('expected', 'المتوقع')} ≈ {Math.round(attack.expected).toLocaleString()}</span></div>
          <div className="metric"><small>{t('Fair variant #', 'رقم النسخة العادلة')}</small><strong>{attack.fairVariant}</strong></div>
          <div className="metric"><small>{t('Fraud variant #', 'رقم النسخة الاحتيالية')}</small><strong>{attack.fraudVariant}</strong></div></div>
        <code dir="ltr">✔ {show(attack.fairText)}</code>
        <code dir="ltr" className="fraud">✘ {show(attack.fraudText)}</code>
        <small className="muted">{t('“·” marks an extra space. Both texts have the same truncated SHA-256, so a signature on the first is also valid for the second.', '“·” تعني مسافة إضافية. للنصين نفس قيمة SHA-256 المقتطعة، فالتوقيع على الأول صالح للثاني أيضاً.')}</small>
      </div>}
      <div className="two-col">
        <div><h3>{t('The attack in five steps', 'الهجوم في خمس خطوات')}</h3><ol className="steps">
          <li>{t('Prepare a fair contract and a fraudulent one.', 'يجهز المهاجم عقداً عادلاً وعقداً احتيالياً.')}</li>
          <li>{t('Generate about 2^(b/2) invisible variants of each (spaces, commas, synonyms).', 'يولّد نحو 2^(b/2) نسخة من كل عقد بتغييرات غير مؤثرة (مسافات، فواصل، مرادفات).')}</li>
          <li>{t('Hash all variants and look for one fair and one fraudulent variant with the same hash (birthday paradox).', 'يحسب التجزئة لكل النسخ ويبحث عن نسخة عادلة ونسخة احتيالية بنفس التجزئة (مفارقة عيد الميلاد).')}</li>
          <li>{t('The victim signs the fair variant: the signature is computed on its hash.', 'يوقّع الضحية على النسخة العادلة، والتوقيع يُحسب على قيمة تجزئتها.')}</li>
          <li>{t('The attacker attaches the same signature to the fraudulent variant; verification succeeds because the hashes are equal.', 'ينقل المهاجم التوقيع نفسه إلى النسخة الاحتيالية؛ فينجح التحقق لأن التجزئتين متساويتان.')}</li>
        </ol></div>
        <div><h3>{t('Two defences', 'إجراءان دفاعيان')}</h3><ol className="steps">
          <li>{t('Use a collision-resistant hash with a long output (SHA-256/SHA-3 or longer). The attack then needs ≈ 2^128 work.', 'استخدام دالة تجزئة مقاومة للتصادم وطويلة الناتج (SHA-256 أو SHA-3 أو أطول)، فيحتاج الهجوم نحو 2^128 عملية.')}</li>
          <li>{t('Before signing, the signer adds something the attacker cannot predict (a random nonce/serial number, or randomized hashing) or makes a small change of their own. The attacker’s precomputed pair no longer matches.', 'قبل التوقيع يضيف الموقّع شيئاً لا يستطيع المهاجم توقعه (رقماً عشوائياً أو رقماً تسلسلياً أو تجزئة عشوائية) أو يُجري تعديلاً بسيطاً بنفسه، فيفقد الزوج المحضّر مسبقاً تطابقه.')}</li>
        </ol></div>
      </div>
    </section>
  </>;
}

// ---------------------------------------------------------------------------
function Sessions({ar, value, onChange}: {ar: boolean; value: {bits: number; active: number}; onChange: (v: {bits: number; active: number}) => void}) {
  const t = (en: string, a: string) => (ar ? a : en);
  const bits = Math.max(4, Math.min(40, Math.round(value.bits) || 16)), N = 2 ** bits;
  const n50 = nForProbability(0.5, N), nUp = Math.ceil(n50), exact = collisionExact(nUp, N);
  const [sim, setSim] = useState<{n: number; p: number; T: number} | null>(null);
  const data = useMemo(() => {const top = Math.ceil(3 * Math.sqrt(N)); return Array.from({length: 61}, (_, i) => {const k = Math.round(top * i / 60); return {k, p: +(collisionExact(k, N) * 100).toFixed(2)};});}, [N]);
  const active = Math.max(1, Math.round(value.active) || 1);
  return <>
    <section className="panel">
      <span className="eyebrow">{t('IT APPLICATION · SESSION IDs', 'تطبيق تقنية المعلومات · معرّفات الجلسات')}</span>
      <h2><KeyRound size={18}/> {t('How many active sessions until two share an ID?', 'كم جلسة نشطة حتى تتشارك جلستان نفس المعرّف؟')}</h2>
      <div className="controls">
        <label>{t('Session ID length (bits)', 'طول معرّف الجلسة (بت)')}<input type="number" min="4" max="40" value={value.bits} onChange={e => onChange({...value, bits: +e.target.value})}/></label>
        <label>{t('Active sessions now', 'عدد الجلسات النشطة الآن')}<input type="number" min="1" value={value.active} onChange={e => onChange({...value, active: +e.target.value})}/></label>
      </div>
      <ol className="steps">
        <li><code dir="ltr">N = 2^{bits} = {N.toLocaleString()}</code></li>
        <li><code dir="ltr">√N = {Math.sqrt(N).toFixed(4)}</code></li>
        <li><code dir="ltr">n ≈ √(2·ln2)·√N = 1.1774 × {Math.sqrt(N).toFixed(4)} = {n50.toFixed(4)} → {nUp} {t('sessions', 'جلسة')}</code></li>
        <li><code dir="ltr">{t('Check (exact):', 'تحقق (بالصيغة الدقيقة):')} p({nUp}) = 1 − ∏(1 − k/N) = {f4(exact)}  ·  p({nUp - 1}) = {f4(collisionExact(nUp - 1, N))}</code></li>
      </ol>
      <div className="actions"><button className="secondary" onClick={() => setSim({n: nUp, T: 5000, p: estimate(nUp, 5000, rng(`sessions-${bits}`), N)})}><Zap size={16}/>{t(`Simulate 5,000 servers with ${nUp} sessions`, `حاكِ 5,000 خادم بكل منها ${nUp} جلسة`)}</button>
        {sim && <span className="good">{t(`${f4(sim.p)} of the simulated servers had a duplicate ID (theory ${f4(collisionExact(sim.n, N))}).`, `${f4(sim.p)} من الخوادم المحاكاة ظهر فيها معرّف مكرر (النظري ${f4(collisionExact(sim.n, N))}).`)}</span>}</div>
      <div className="chart"><ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{top: 10, right: 16, bottom: 0, left: -10}}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
          <XAxis dataKey="k" type="number" domain={[0, 'dataMax']} tick={{fill: 'var(--muted)', fontSize: 11}}/>
          <YAxis domain={[0, 100]} unit="%" tick={{fill: 'var(--muted)', fontSize: 11}}/>
          <Tooltip contentStyle={tipStyle} formatter={v => [`${v}%`, t('Collision chance', 'احتمال التصادم')]} labelFormatter={v => t(`${v} sessions`, `${v} جلسة`)}/>
          <ReferenceLine y={50} stroke="var(--muted)" strokeDasharray="4 4"/>
          <ReferenceLine x={nUp} stroke="#ff8a65" strokeDasharray="4 4"/>
          <Line dataKey="p" stroke="#6687ff" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer></div>
    </section>
    <div className="two-col">
      <section className="panel">
        <h3>{t('Security impact (session hijacking)', 'الأثر الأمني (اختطاف الجلسة)')}</h3>
        <ul className="steps">
          <li>{t('A collision means two users receive the same ID: the second login can land inside the first user’s session and see or change their data, without any attack.', 'التصادم يعني أن مستخدمين حصلا على المعرّف نفسه: قد يدخل الثاني إلى جلسة الأول ويرى بياناته أو يغيّرها دون أي هجوم.')}</li>
          <li>{t(`A small space also makes guessing easy. With ${active.toLocaleString()} active sessions, one random guess hits a live session with probability ${active.toLocaleString()}/${N.toLocaleString()} = ${f4(active / N)}; about ${Math.round(N / active).toLocaleString()} guesses are enough on average — seconds for a script.`, `الفضاء الصغير يجعل التخمين سهلاً أيضاً. مع ${active.toLocaleString()} جلسة نشطة، احتمال أن يصيب تخمين عشوائي واحد جلسة حقيقية ${active.toLocaleString()}/${N.toLocaleString()} = ${f4(active / N)}؛ ويكفي في المتوسط نحو ${Math.round(N / active).toLocaleString()} تخميناً، أي ثوانٍ لبرنامج آلي.`)}</li>
          <li>{t('The attacker then acts as the victim (session hijacking): reads private data, makes purchases or changes passwords.', 'بعدها يتصرف المهاجم كأنه الضحية (اختطاف الجلسة): يقرأ البيانات الخاصة أو يشتري أو يغيّر كلمة المرور.')}</li>
        </ul>
      </section>
      <section className="panel">
        <h3>{t('Standard solution (OWASP)', 'الحل المعياري (حسب OWASP)')}</h3>
        <ul className="steps">
          <li>{t('Use the framework’s session manager; never invent IDs (no counters, timestamps or user names).', 'استخدم مدير الجلسات الجاهز في إطار العمل؛ لا تخترع معرّفات بنفسك (لا عدادات ولا أوقات ولا أسماء مستخدمين).')}</li>
          <li>{t('Generate IDs with a cryptographically secure random generator (CSPRNG) with at least 64 bits of entropy (OWASP); in practice use IDs of at least 128 bits (16 bytes = 32 hex characters), the length OWASP has long recommended.', 'ولّد المعرّفات بمولّد أرقام عشوائية آمن تشفيرياً (CSPRNG) بإنتروبيا لا تقل عن 64 بت (OWASP)، وعملياً استخدم معرّفات لا يقل طولها عن 128 بت (16 بايت = 32 حرفاً سداسياً عشرياً)، وهو الطول الذي توصي به OWASP منذ مدة.')}</li>
          <li>{t(`With 128 bits, a 50% collision needs ≈ ${sci(nForProbability(0.5, 2 ** 128))} sessions — impossible in practice.`, `مع 128 بت يحتاج تصادم بنسبة 50% نحو ${sci(nForProbability(0.5, 2 ** 128))} جلسة، وهذا مستحيل عملياً.`)}</li>
          <li>{t('Check uniqueness on the server, regenerate the ID after login, expire idle sessions, and send it only in Secure, HttpOnly, SameSite cookies over HTTPS.', 'تحقق من عدم التكرار على الخادم، وجدّد المعرّف بعد تسجيل الدخول، وأنهِ الجلسات الخاملة، وأرسل المعرّف فقط في ملفات تعريف ارتباط Secure وHttpOnly وSameSite عبر HTTPS.')}</li>
        </ul>
      </section>
    </div>
  </>;
}
