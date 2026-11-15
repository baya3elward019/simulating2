// Instant, field-level validation for the Simulation Lab forms. It mirrors
// python/simlab/validation.py so students see errors while typing; Python re-validates on run.
import type {FieldError} from './python/protocol';

export type Label = [string, string];
type Opts = {min?: number; max?: number; integer?: boolean; positive?: boolean};
const show = (x: number) => (Number.isInteger(x) ? String(x) : String(+x.toPrecision(12)));

export class FormChecker<K extends string> {
  errors: FieldError[] = [];
  values: Partial<Record<K, number>> = {};
  constructor(private form: Record<K, string>, private prefix = '') {}

  fail(field: string, en: string, ar: string) { this.errors.push({field: this.prefix + field, en, ar}); }

  num(key: K, [en, ar]: Label, {min, max, integer, positive}: Opts = {}): number | undefined {
    const raw = (this.form[key] ?? '').trim();
    if (raw === '') { this.fail(key, `${en} is required and must be a number.`, `${ar}: القيمة مطلوبة ويجب أن تكون رقماً.`); return; }
    const v = Number(raw);
    if (!Number.isFinite(v)) { this.fail(key, `${en} must be a number.`, `${ar}: يجب أن تكون القيمة رقماً.`); return; }
    if (integer && !Number.isInteger(v)) { this.fail(key, `${en} must be a whole number.`, `${ar}: يجب أن تكون القيمة عدداً صحيحاً.`); return; }
    if (positive && v <= 0) { this.fail(key, `${en} must be greater than 0.`, `${ar}: يجب أن تكون القيمة أكبر من 0.`); return; }
    const lo = min ?? -Infinity, hi = max ?? Infinity;
    if (v < lo || v > hi) {
      if (max === undefined) this.fail(key, `${en} cannot be less than ${show(lo)}.`, `${ar}: لا يمكن أن تكون أقل من ${show(lo)}.`);
      else this.fail(key, `${en} must be between ${show(lo)} and ${show(hi)}.`, `${ar}: يجب أن تكون بين ${show(lo)} و ${show(hi)}.`);
      return;
    }
    this.values[key] = v;
    return v;
  }
}

export const errorFor = (errors: FieldError[], field: string) => errors.find(e => e.field === field);
