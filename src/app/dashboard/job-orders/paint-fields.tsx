'use client';

import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import {
  PAINT_FINISHES,
  PAINT_PARTS,
  PAINT_SCOPES,
  PAINT_TYPES,
  type PaintFinish,
  type PaintScope,
  type PaintType,
} from '@/lib/intake';

/**
 * حقول بند الصبغ — مشتركة بين بيان التشغيل وإضافة بندٍ لاحقاً، فلا يتفرّق
 * شكل البند بين الشاشتين.
 */
export interface PaintState {
  scope: PaintScope;
  type: PaintType;
  finish: PaintFinish;
  parts: string[];
  rimCount: string;
  colorName: string;
  paintCode: string;
  formula: string;
  repairNotes: string;
}

export const BLANK_PAINT: PaintState = {
  scope: 'PARTS',
  type: 'PERMANENT',
  finish: 'GLOSS',
  parts: [],
  rimCount: '4',
  colorName: '',
  paintCode: '',
  formula: '',
  repairNotes: '',
};

export function paintPayload(paint: PaintState) {
  return {
    scope: paint.scope,
    type: paint.type,
    finish: paint.finish,
    parts: paint.scope === 'PARTS' ? paint.parts : [],
    rimCount: paint.scope === 'RIMS' ? paint.rimCount : null,
    colorName: paint.colorName || null,
    paintCode: paint.paintCode || null,
    formula: paint.formula || null,
    repairNotes: paint.repairNotes || null,
  };
}

/** ما ينقص بند الصبغ ليُحفظ — نصّاً يُقرأ لا زرّاً ميّتاً */
export function paintBlocker(paint: PaintState) {
  return paint.scope === 'PARTS' && paint.parts.length === 0 ? 'اختر قطع الصبغ' : null;
}

export function ChoiceChips<K extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: Record<K, string>;
  value: K;
  onPick: (key: K) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(options) as [K, string][]).map(([key, text]) => (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            className={cn(
              'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
              value === key
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-[var(--line)] text-[var(--text-1)] hover:border-accent'
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function PaintFields({
  value,
  onChange,
  vehiclePaintCode,
}: {
  value: PaintState;
  onChange: (next: PaintState) => void;
  /** كود السيارة المسجّل — يُعرض ليُستعمل بضغطة لا ليُكتب من الذاكرة */
  vehiclePaintCode?: string | null;
}) {
  const set = (patch: Partial<PaintState>) => onChange({ ...value, ...patch });

  function togglePart(key: string) {
    set({
      parts: value.parts.includes(key) ? value.parts.filter((k) => k !== key) : [...value.parts, key],
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <ChoiceChips label="النطاق" options={PAINT_SCOPES} value={value.scope} onPick={(scope) => set({ scope })} />
        <ChoiceChips label="النوع" options={PAINT_TYPES} value={value.type} onPick={(type) => set({ type })} />
        <ChoiceChips
          label="التشطيب"
          options={PAINT_FINISHES}
          value={value.finish}
          onPick={(finish) => set({ finish })}
        />
      </div>

      {value.scope === 'PARTS' && (
        <Field
          label="القطع المصبوغة"
          hint={value.parts.length > 0 ? `${value.parts.length} قطعة` : 'اختر ما يُصبغ فعلاً — تُذكر على الشهادة'}
        >
          <div className="flex flex-wrap gap-1.5">
            {PAINT_PARTS.map((part) => {
              const on = value.parts.includes(part.key);
              return (
                <button
                  key={part.key}
                  type="button"
                  onClick={() => togglePart(part.key)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                    on
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]'
                  )}
                >
                  {part.label}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {value.scope === 'RIMS' && (
        <Field label="عدد الرنقات">
          <Select
            value={value.rimCount}
            className="max-w-28"
            onChange={(e) => set({ rimCount: e.target.value })}
          >
            {['1', '2', '3', '4'].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {value.scope === 'FULL' && (
        <p className="text-[11px] text-[var(--text-2)]">
          {PAINT_PARTS.length} لوحة تُنشأ للتوزيع على الفنيين · اللون أدناه يصير لون السيارة عند تسليمها
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={value.scope === 'FULL' ? 'اللون الجديد' : 'اسم اللون'}>
          <Input
            value={value.colorName}
            onChange={(e) => set({ colorName: e.target.value })}
            placeholder="أسود لؤلؤي"
          />
        </Field>
        <Field
          label="كود اللون"
          hint={value.type === 'PERMANENT' ? 'مطلوب قبل تسليم السيارة' : undefined}
        >
          <Input
            value={value.paintCode}
            onChange={(e) => set({ paintCode: e.target.value })}
            dir="ltr"
            className="tnum text-start"
            placeholder="LY9T"
          />
          {vehiclePaintCode && !value.paintCode && (
            <button
              type="button"
              className="mt-1 text-[11px] text-accent hover:underline"
              onClick={() => set({ paintCode: vehiclePaintCode })}
            >
              استعمل كود السيارة{' '}
              <span className="tnum" dir="ltr">
                {vehiclePaintCode}
              </span>
            </button>
          )}
        </Field>
        <Field label="خلطة Glasurit">
          <Input
            value={value.formula}
            onChange={(e) => set({ formula: e.target.value })}
            dir="ltr"
            className="tnum text-start"
            placeholder="رقم الخلطة"
          />
        </Field>
      </div>

      <Field label="الدعمات والخدوش" hint="ما يُعاين قبل التسعير — اختياري">
        <Textarea
          rows={2}
          value={value.repairNotes}
          onChange={(e) => set({ repairNotes: e.target.value })}
        />
      </Field>
    </div>
  );
}
