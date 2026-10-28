import {useMemo, useState} from 'react';
import {PartyPopper, RotateCcw, Users, Zap} from 'lucide-react';
import {CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {dayLabel, estimate, exactProbability, findMatches, pairs, randomGroup, smallestGroupFor} from './birthday';

const MAX = 100;
const COLORS = ['#ff8a65', '#40cdb3', '#ba8aff', '#f5c451', '#6687ff', '#ff7eb6'];
const pct = (p: number) => `${(p * 100).toFixed(1)}%`;
const curve = Array.from({length: MAX}, (_, i) => ({n: i + 1, p: +(exactProbability(i + 1) * 100).toFixed(2)}));

export default function Birthday({ar}: {ar: boolean}) {
  const t = (en: string, a: string) => (ar ? a : en);
  const [n, setN] = useState(23);
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
    setGroup(null);
    setTally({rooms: 0, hits: 0});
    setBatch(null);
  }
  function fillRoom() {
    const g = randomGroup(n);
    setGroup(g);
    setTally(s => ({rooms: s.rooms + 1, hits: s.hits + (findMatches(g).length ? 1 : 0)}));
  }

  return <>
    <div className="two-col">
      <section className="panel bday-stage">
        <span className="eyebrow">{t('ONE CLICK. ONE ROOM FULL OF PEOPLE.', 'نقرة واحدة، غرفة مليانة ناس.')}</span>
        <h2>{t('How many people are in the room?', 'كم شخص في الغرفة؟')}</h2>
        <div className="bday-size">
          <input type="range" min="2" max={MAX} value={n} aria-label={t('Group size', 'عدد الأشخاص')} onChange={e => changeSize(+e.target.value)}/>
          <input type="number" min="2" max={MAX} value={n} aria-label={t('Group size', 'عدد الأشخاص')} onChange={e => changeSize(+e.target.value)}/>
        </div>
        <div className="actions">
          <button className="primary" onClick={fillRoom}><Users size={16}/>{t('Fill the room', 'عبّي الغرفة')}</button>
          <button className="secondary" onClick={() => changeSize(23)}>{t('Try 23', 'جرّب 23')}</button>
        </div>
        <div className={`bday-result ${group ? (matches.length ? 'hit' : 'miss') : ''}`} role="status">
          {!group ? t('Press "Fill the room" to give everyone a random birthday.', 'اضغط "عبّي الغرفة" عشان كل شخص ياخذ عيد ميلاد عشوائي.')
            : matches.length ? <><PartyPopper size={18}/>{t(`Match! ${matches.length} shared birthday${matches.length > 1 ? 's' : ''} in this room.`, `فيه تطابق! ${matches.length} عيد ميلاد مشترك في هالغرفة.`)}</>
            : t('No shared birthday this time. Try again!', 'ما فيش تطابق المرة هذي. جرّب مرة ثانية!')}
        </div>
        {matches.length > 0 && <ul className="bday-matches">{matches.map((m, i) =>
          <li key={m.day}><span className="swatch" style={{background: COLORS[i % COLORS.length]}}/>
            <strong>{dayLabel(m.day, ar)}</strong> — {m.people.map(p => `#${p + 1}`).join(t(' & ', ' و '))}
          </li>)}
        </ul>}
      </section>

      <section className="panel">
        <h2>{t('What are the chances?', 'شنو الاحتمال؟')}</h2>
        <div className="metric-grid bday-metrics">
          <div className="metric"><small>{t('Chance of a match (math)', 'احتمال التطابق (رياضياً)')}</small><strong>{pct(theory)}</strong><span>{t(`for ${n} people`, `لـ ${n} شخص`)}</span></div>
          <div className="metric"><small>{t('Pairs to compare', 'عدد الأزواج')}</small><strong>{pairs(n).toLocaleString()}</strong><span>n(n−1)/2</span></div>
          <div className="metric"><small>{t('Your rooms', 'غرفك')}</small><strong>{tally.hits} / {tally.rooms}</strong><span>{tally.rooms ? t(`${pct(tally.hits / tally.rooms)} had a match`, `${pct(tally.hits / tally.rooms)} فيها تطابق`) : t('none yet', 'لسه ما فيش')}</span></div>
          <div className="metric"><small>{t('1,000 rooms at once', '1,000 غرفة مرة وحدة')}</small><strong>{batch === null ? '—' : pct(batch)}</strong><span>{t('simulated estimate', 'تقدير بالمحاكاة')}</span></div>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => setBatch(estimate(n, 1000))}><Zap size={16}/>{t('Simulate 1,000 rooms', 'حاكي 1,000 غرفة')}</button>
          <button className="secondary" onClick={() => { setTally({rooms: 0, hits: 0}); setBatch(null); setGroup(null); }}><RotateCcw size={16}/>{t('Reset', 'إعادة')}</button>
        </div>
        <div className="callout">
          {t(`Only ${smallestGroupFor(0.5)} people give a better-than-even chance, and ${smallestGroupFor(0.99)} people make it 99%. It feels wrong because we think "someone with MY birthday", but every pair counts: ${n} people make ${pairs(n).toLocaleString()} pairs.`,
            `يكفي ${smallestGroupFor(0.5)} شخص عشان الاحتمال يفوت النص، و${smallestGroupFor(0.99)} شخص يوصلوه 99%. يبان غريب لأننا نفكر "حد عنده نفس عيد ميلادي أنا"، لكن كل زوج يُحسب: ${n} شخص يعطوا ${pairs(n).toLocaleString()} زوج.`)}
        </div>
      </section>
    </div>

    {group && <section className="panel">
      <h2>{t('The room', 'الغرفة')}</h2>
      <p className="muted">{t('Each card is one person and their random birthday. Same color = same birthday.', 'كل بطاقة شخص وعيد ميلاده العشوائي. نفس اللون = نفس عيد الميلاد.')}</p>
      <div className="bday-grid">{group.map((day, i) => {
        const c = colorOf.get(i);
        return <div key={i} className={c ? 'person match' : 'person'} style={c ? {borderColor: c, background: `${c}22`} : undefined}>
          <small>#{i + 1}</small><strong style={c ? {color: c} : undefined}>{dayLabel(day, ar)}</strong>
        </div>;
      })}</div>
    </section>}

    <section className="panel">
      <h2>{t('Chance of a shared birthday by group size', 'احتمال عيد ميلاد مشترك حسب عدد الأشخاص')}</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve} margin={{top: 10, right: 16, bottom: 0, left: -10}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
            <XAxis dataKey="n" type="number" domain={[1, MAX]} ticks={[1, 10, 23, 30, 40, 50, 57, 70, 85, 100]} tick={{fill: 'var(--muted)', fontSize: 11}}/>
            <YAxis domain={[0, 100]} unit="%" tick={{fill: 'var(--muted)', fontSize: 11}}/>
            <Tooltip formatter={v => [`${v}%`, t('Chance', 'الاحتمال')]} labelFormatter={v => t(`${v} people`, `${v} شخص`)} contentStyle={{background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10}}/>
            <ReferenceLine y={50} stroke="var(--muted)" strokeDasharray="4 4"/>
            <Line type="monotone" dataKey="p" stroke="#6687ff" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
            <ReferenceDot x={n} y={+(theory * 100).toFixed(2)} r={6} fill="#ff8a65" stroke="var(--panel)" strokeWidth={2}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="callout">
        <strong>{t('The math in one line', 'الرياضيات في سطر واحد')}:</strong> <span dir="ltr">P(match) = 1 − (365/365 × 364/365 × … × (365−n+1)/365)</span>
        <br/>{t('Excel', 'إكسل')}: <code>=1-PERMUT(365,{n})/365^{n}</code>
        <br/>{t('Assumes 365 equally likely birthdays (no 29 February).', 'نفترض 365 يوم بنفس الاحتمال (بدون 29 فبراير).')}
      </div>
    </section>
  </>;
}
