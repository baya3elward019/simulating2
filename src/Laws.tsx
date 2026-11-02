import {useState, type ReactNode} from 'react';
import {BookOpenCheck, ChevronDown} from 'lucide-react';
import {LAWS, type LawTopic} from './laws';

/** "Laws & formulas" panel shown next to every simulator. */
export default function Laws({topic, ar, open: initiallyOpen = true, children}: {topic: LawTopic; ar: boolean; open?: boolean; children?: ReactNode}) {
  const [open, setOpen] = useState(initiallyOpen);
  const laws = LAWS[topic];
  return <section className="panel laws">
    <button className="laws-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="stat-icon tone-1"><BookOpenCheck size={19}/></span>
      <span><span className="eyebrow">{ar ? 'افهم قبل أن تحاكي' : 'UNDERSTAND BEFORE YOU SIMULATE'}</span>
        <strong>{ar ? 'القوانين والمعادلات وراء هذه المحاكاة' : 'The laws and formulas behind this simulation'}</strong></span>
      <ChevronDown size={18} className={open ? 'chev open' : 'chev'}/>
    </button>
    {open && <>
      <p className="muted">{ar ? 'كل قانون مكتوب بالصيغة الرياضية، ومعه صيغة إكسل المقابلة وشرح مبسط. نفس القوانين مكتوبة داخل ملف الإكسل الذي تنزّله.' : 'Each law is written mathematically, with the matching Excel formula and a plain explanation. The same laws are written inside the Excel workbook you download.'}</p>
      <ol className="law-list">{laws.map((law, i) => <li key={i}>
        <div className="law-head"><span className="law-num">{i + 1}</span><strong>{ar ? law.name[1] : law.name[0]}</strong></div>
        <code className="law-math" dir="ltr">{law.math}</code>
        {law.excel && <div className="law-excel"><small>Excel</small><code dir="ltr">{law.excel}</code></div>}
        <p>{ar ? law.meaning[1] : law.meaning[0]}</p>
      </li>)}</ol>
      {children}
    </>}
  </section>;
}
