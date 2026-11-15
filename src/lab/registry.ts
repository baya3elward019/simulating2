// Simulation Lab model registry (web side). To add a model:
//  1. python/simlab/models/<id>/  — engine.py (inputs, validation, simulate, chart data) + excel.py
//  2. register it in python/simlab/registry.py
//  3. src/lab/models/<id>/<Name>Model.tsx (+ engine.ts for types / instant validation)
//  4. add one entry below.  Nothing else in the platform needs to change.
import {lazy, type ComponentType, type LazyExoticComponent} from 'react';
import {Bug, ShieldAlert, type LucideIcon} from 'lucide-react';

export type LabModel = {
  id: string; icon: LucideIcon; tone: number;
  title: [string, string]; summary: [string, string]; tags: string[];
  component: LazyExoticComponent<ComponentType<{ar: boolean}>>;
};

export const LAB_MODELS: LabModel[] = [
  {id: 'sir', icon: Bug, tone: 2, title: ['SIR Malware Propagation', 'انتشار البرمجيات الخبيثة SIR'],
    summary: ['How malware spreads between Susceptible, Infected and Recovered devices, day by day.', 'كيف تنتشر البرمجيات الخبيثة بين الأجهزة المعرّضة والمصابة والمتعافية يوماً بيوم.'],
    tags: ['Difference equations', 'Python', 'Excel + charts'], component: lazy(() => import('./models/sir/SirModel'))},
  {id: 'ids', icon: ShieldAlert, tone: 0, title: ['IDS Detection & Bayes', 'كشف التسلل وقانون بايز IDS'],
    summary: ['How often is an IDS alarm a real attack? Confusion matrix, Bayes’ theorem and Monte Carlo.', 'ما احتمال أن يكون إنذار نظام كشف التسلل هجوماً حقيقياً؟ مصفوفة الالتباس وقانون بايز ومونت كارلو.'],
    tags: ['Bayes', 'Monte Carlo', 'Scenarios'], component: lazy(() => import('./models/ids/IdsModel'))},
];

/** Shown as “coming next” cards so the modular design is visible to students. */
export const NEXT_MODELS: [string, string][] = [
  ['M/M/1 Queue', 'طابور M/M/1'], ['Monte Carlo experiments', 'تجارب مونت كارلو'], ['Network traffic', 'حركة الشبكة'],
  ['Probability models', 'نماذج الاحتمالات'], ['Cyber-risk simulation', 'محاكاة المخاطر السيبرانية'],
];
