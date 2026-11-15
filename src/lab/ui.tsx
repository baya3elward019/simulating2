// Components shared by every Simulation Lab model (inputs, engine status, cards, toggles…).
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {AlertTriangle, ChevronDown, Cpu, Loader2, RefreshCw} from 'lucide-react';
import {python, usePythonEngine} from './python/client';
import type {FieldError} from './python/protocol';
import type {Label} from './validate';

export const tr = (ar: boolean) => (en: string, a: string) => (ar ? a : en);

export function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/A';
  return v.toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
}
export const fmtInt = (v: number) => v.toLocaleString('en-US', {maximumFractionDigits: 0});
export const pct = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? 'N/A' : `${fmt(v * 100, digits)}%`);
/** Count values (packets, devices) keep decimals only when they have them. */
export const count = (v: number) => (Number.isInteger(Math.round(v * 1e9) / 1e9) ? fmtInt(Math.round(v)) : fmt(v, 2));

export function NumField({label, symbol, value, onChange, error, hint, suffix, ar, wide}: {
  label: Label; symbol?: string; value: string; onChange: (v: string) => void; error?: FieldError; hint?: string; suffix?: string; ar: boolean; wide?: boolean;
}) {
  const id = useRef(`f-${Math.random().toString(36).slice(2)}`).current;
  return <div className={`lab-field${error ? ' invalid' : ''}${wide ? ' wide' : ''}`}>
    <label htmlFor={id} title={ar ? label[1] : label[0]}><span>{ar ? label[1] : label[0]}</span>{symbol && <b dir="ltr">{symbol}</b>}</label>
    <div className="lab-input" dir="ltr">
      <input id={id} type="text" inputMode="decimal" dir="ltr" value={value} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined}
        onChange={e => onChange(e.target.value)}/>
      {suffix && <span>{suffix}</span>}
    </div>
    {error ? <small id={`${id}-e`} className="lab-error" role="alert"><AlertTriangle size={12}/>{ar ? error.ar : error.en}</small> : hint ? <small className="lab-hint">{hint}</small> : null}
  </div>;
}

export function EngineBadge({ar}: {ar: boolean}) {
  const s = usePythonEngine();
  const t = tr(ar);
  if (s.status === 'ready') return <span className="engine-badge ready"><Cpu size={14}/>Python {s.version} · Pyodide <i>{t('ready', 'جاهز')}</i></span>;
  if (s.status === 'error') return <span className="engine-badge failed" title={s.error}><AlertTriangle size={14}/>{t('Python unavailable – JavaScript fallback', 'محرك Python غير متاح – يعمل البديل JavaScript')}
    <button className="icon" onClick={() => python.retry()} aria-label={t('Retry', 'إعادة المحاولة')}><RefreshCw size={13}/></button></span>;
  return <span className="engine-badge loading"><Loader2 size={14} className="spin"/>{t('Starting the Python engine…', 'جارٍ تشغيل محرك Python…')}</span>;
}

export function RunInfo({engine, ms, ar}: {engine: 'python' | 'javascript'; ms: number; ar: boolean}) {
  const t = tr(ar);
  return <span className={`run-info ${engine}`}>{engine === 'python'
    ? t(`Computed by the Python engine in ${ms < 1 ? '<1' : ms.toFixed(0)} ms`, `حُسبت بواسطة محرك Python خلال ${ms < 1 ? 'أقل من 1' : ms.toFixed(0)} ms`)
    : t('Computed by the JavaScript fallback (same equations)', 'حُسبت بالبديل JavaScript (نفس المعادلات)')}</span>;
}

/** Number that eases to its new value (disabled for reduced-motion users). */
export function useCountUp(target: number, ms = 650) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !Number.isFinite(target)) { setV(target); from.current = target; return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - k, 3);
      setV(a + (target - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target, ms]);
  return v;
}

export function StatCard({label, value, render, tone, sub, icon}: {label: string; value: number; render: (v: number) => string; tone: string; sub?: ReactNode; icon?: ReactNode}) {
  const v = useCountUp(value);
  return <div className={`lab-stat tone-${tone}`}>
    <div className="lab-stat-top"><small>{label}</small>{icon}</div>
    <strong dir="ltr">{render(v)}</strong>
    {sub && <span>{sub}</span>}
  </div>;
}

export function Toggle({open, onClick, children}: {open: boolean; onClick: () => void; children: ReactNode}) {
  return <button className="lab-toggle" aria-expanded={open} onClick={onClick}>{children}<ChevronDown size={16} className={open ? 'chev open' : 'chev'}/></button>;
}

export function ErrorBox({errors, ar, fields}: {errors: FieldError[]; ar: boolean; fields?: Set<string>}) {
  const shown = fields ? errors.filter(e => !fields.has(e.field)) : errors;
  if (!shown.length) return null;
  return <div className="lab-alert" role="alert"><AlertTriangle size={16}/><ul>{shown.map((e, i) => <li key={i}>{ar ? e.ar : e.en}</li>)}</ul></div>;
}

export function Busy({label}: {label: string}) {
  return <span className="busy"><Loader2 size={15} className="spin"/>{label}</span>;
}
