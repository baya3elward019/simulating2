import {Suspense, useEffect} from 'react';
import {ArrowUpRight, Boxes, FlaskConical, Plus} from 'lucide-react';
import {LAB_MODELS, NEXT_MODELS} from './registry';
import {python} from './python/client';
import {Busy, EngineBadge, tr} from './ui';
import './lab.css';

export default function SimulationLab({ar, model, onModel}: {ar: boolean; model: string; onModel: (id: string) => void}) {
  const t = tr(ar);
  useEffect(() => { python.start().catch(() => undefined); }, []);   // warm the Python engine up
  const active = LAB_MODELS.find(m => m.id === model) ?? LAB_MODELS[0];
  const Model = active.component;
  return <div className="lab">
    <section className="lab-hero">
      <div>
        <span className="pill">SIMULATION LAB · {t('MODULAR', 'نظام وحدات')}</span>
        <h2>{t('Simulation Lab', 'مختبر المحاكاة')} <span className="lab-hero-ar">{ar ? 'Simulation Lab' : 'مختبر المحاكاة'}</span></h2>
        <p>{t('Real Python engines running inside your browser (WebAssembly). Each model owns its inputs, validation, calculations, charts and a live-formula Excel export.',
          'محركات Python حقيقية تعمل داخل متصفحك (WebAssembly). لكل نموذج مدخلاته والتحقق منها وحساباته ورسومه البيانية وتصدير Excel بمعادلات حية.')}</p>
      </div>
      <EngineBadge ar={ar}/>
    </section>

    <div className="lab-models" role="tablist" aria-label={t('Models', 'النماذج')}>
      {LAB_MODELS.map(m => {
        const Icon = m.icon;
        return <button key={m.id} role="tab" aria-selected={m.id === active.id} className={m.id === active.id ? 'lab-model active' : 'lab-model'} onClick={() => onModel(m.id)}>
          <span className={`stat-icon tone-${m.tone}`}><Icon size={22}/></span>
          <span className="lab-model-body"><strong>{ar ? m.title[1] : m.title[0]}</strong><small>{ar ? m.summary[1] : m.summary[0]}</small>
            <span className="lab-tags">{m.tags.map(tag => <i key={tag}>{tag}</i>)}</span></span>
          <ArrowUpRight size={17} className="lab-model-arrow"/>
        </button>;
      })}
      <div className="lab-model next" aria-label={t('Coming next', 'نماذج قادمة')}>
        <span className="stat-icon tone-3"><Boxes size={22}/></span>
        <span className="lab-model-body"><strong>{t('Next models plug in here', 'النماذج القادمة تُضاف هنا')}</strong>
          <span className="lab-tags">{NEXT_MODELS.map(n => <i key={n[0]}><Plus size={10}/>{ar ? n[1] : n[0]}</i>)}</span></span>
      </div>
    </div>

    <Suspense fallback={<section className="panel"><Busy label={t('Loading model…', 'جارٍ تحميل النموذج…')}/></section>}>
      <div className="lab-stage" key={active.id}><Model ar={ar}/></div>
    </Suspense>
    <p className="lab-foot"><FlaskConical size={13}/>{t('Python sources: python/simlab · CLI: python -m simlab', 'ملفات Python: python/simlab · سطر الأوامر: python -m simlab')}</p>
  </div>;
}
