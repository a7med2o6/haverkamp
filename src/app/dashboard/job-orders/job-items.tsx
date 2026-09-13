'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import {
  PAINT_TYPES,
  PRICE_APPROVAL_METHODS,
  type PaintFinish,
  type PaintType,
  type PriceApprovalMethod,
} from '@/lib/intake';
import { formatDate, formatKWD } from '@/lib/utils';
import { EditPaintButton, JobItemActions, PriceItemButton } from './job-client';

export interface JobItemRow {
  id: string;
  parentId: string | null;
  label: string;
  spec: string | null;
  unitPrice: number;
  total: number;
  /** درجات العزل الفريدة تحت هذه الخدمة — «شفاف · 30%» */
  grades: string[];
  isPriced: boolean;
  approval: { at: Date; method: PriceApprovalMethod | null; note: string | null } | null;
  paint: {
    type: PaintType;
    finish: PaintFinish;
    colorName: string | null;
    paintCode: string | null;
    formula: string | null;
    repairNotes: string | null;
  } | null;
  /** لوحات الصبغ أو رنقاته — تُذكر تحت البند لأن الشهادة تذكرها */
  partLabels: string[];
}

/**
 * بنود أمر الشغل — ما اختاره العميل.
 *
 * قطع الحماية والعازل لا تظهر هنا: «بدي كامل» يعني البدي كلّه، وتعداد
 * أربع عشرة قطعة تحته يعيد قول ما قالته كلمتان.
 *
 * أمّا الصبغ فتُذكر لوحاته: «قطع بدي» لا تقول أيّ باب، والسعر بعد
 * المعاينة يُفهم بها. ومعها كوده وخلطته — ما يُطلب يوم تعود السيارة.
 */
export function JobItems({
  items,
  jobOrderId,
  canWrite,
  hasInvoice,
  delivered,
}: {
  items: JobItemRow[];
  jobOrderId: string;
  canWrite: boolean;
  /** بعد الفاتورة لا يُسعَّر بند — الفاتورة نسخت أسعارها */
  hasInvoice: boolean;
  /** بعد التسليم يصير سجلّ الصبغ تاريخاً */
  delivered: boolean;
}) {
  const parents = items.filter((i) => i.parentId === null);
  const partsOf = new Map<string, JobItemRow[]>();
  for (const i of items) {
    if (!i.parentId) continue;
    partsOf.set(i.parentId, [...(partsOf.get(i.parentId) ?? []), i]);
  }
  const canPrice = canWrite && !hasInvoice;

  return (
    <TableWrap className="rounded-none border-0">
      {/*
        `min-w-max` الافتراضي يجعل عرض الجدول عرضَ محتواه الأقصى، وأسماء
        الفنيين شرائح تلتفّ — فيحسبها المتصفّح في سطر واحد ويمدّ الجدول
        حتى يخرج عمود السعر من الشاشة. بعرض أدنى ثابت تلتفّ
        الشرائح داخل عمودها.
      */}
      <Table className="min-w-0">
        <thead>
          <tr>
            <Th>ما طلبه العميل</Th>
            <Th>السعر</Th>
            {canWrite && <Th />}
          </tr>
        </thead>
        <tbody>
          {parents.length === 0 ? (
            <EmptyState
              title="لا توجد بنود"
              description="أنشئ بيان تشغيل أو أضف بنداً"
              colSpan={3}
            />
          ) : (
            parents.map((item) => {
              const parts = partsOf.get(item.id) ?? [];
              const paint = item.paint;
              const needsCode = paint?.type === 'PERMANENT' && !paint.paintCode;

              return (
                <Tr key={item.id}>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--text-0)]">{item.label}</span>
                      {item.spec && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                          {item.spec}
                        </span>
                      )}
                      {/*
                        نحذف من المواصفات ما يقوله اسم البند أصلاً:
                        «حماية البدي — بدي كامل» قطعُها كلّها «كامل»، فعرضها
                        تكرارٌ للاسم. ودرجات العزل («شفاف»، «٣٠٪») لا يقولها
                        الاسم فتبقى.
                      */}
                      {(() => {
                        const grades = item.grades.filter((g) => !item.label.includes(g));
                        if (grades.length === 0) return null;
                        return (
                          <span className="text-[11px] text-[var(--text-1)]">
                            {grades.join(' · ')}
                          </span>
                        );
                      })()}
                    </div>

                    {paint && (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-[12px] text-[var(--text-1)]">
                          {[
                            paint.colorName,
                            paint.formula ? `خلطة ${paint.formula}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || `صبغ ${PAINT_TYPES[paint.type]}`}
                          {needsCode && (
                            <span className="ms-2 text-[11px] font-semibold text-warn">
                              بلا كود لون — مطلوب قبل التسليم
                            </span>
                          )}
                        </p>
                        {item.partLabels.length > 0 && (
                          <p className="text-[11px] text-[var(--text-2)]">{item.partLabels.join('، ')}</p>
                        )}
                        {paint.repairNotes && (
                          <p className="whitespace-pre-line text-[11px] text-[var(--text-2)]">
                            {paint.repairNotes}
                          </p>
                        )}
                        {canWrite && !delivered && (
                          <EditPaintButton
                            itemId={item.id}
                            jobOrderId={jobOrderId}
                            detail={{
                              finish: paint.finish,
                              colorName: paint.colorName,
                              paintCode: paint.paintCode,
                              formula: paint.formula,
                              repairNotes: paint.repairNotes,
                            }}
                          />
                        )}
                      </div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap align-top">
                    {item.isPriced ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="tnum font-semibold">{formatKWD(item.total)}</span>
                          {canPrice && (
                            <PriceItemButton
                              itemId={item.id}
                              jobOrderId={jobOrderId}
                              label={item.label}
                              price={item.unitPrice}
                              isPriced
                            />
                          )}
                        </div>
                        {item.approval && (
                          <p className="mt-0.5 text-[11px] text-ok">
                            وافق العميل
                            {item.approval.method && ` · ${PRICE_APPROVAL_METHODS[item.approval.method]}`}
                            {` · ${formatDate(item.approval.at)}`}
                            {item.approval.note && (
                              <span className="block text-[var(--text-2)]">{item.approval.note}</span>
                            )}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-start gap-1.5">
                        <Badge tone="warn">بانتظار التسعير</Badge>
                        {canPrice && (
                          <PriceItemButton
                            itemId={item.id}
                            jobOrderId={jobOrderId}
                            label={item.label}
                            price={0}
                            isPriced={false}
                          />
                        )}
                      </div>
                    )}
                  </Td>
                  {canWrite && (
                    <Td className="align-top">
                      <JobItemActions
                        id={item.id}
                        jobOrderId={jobOrderId}
                        label={item.label}
                        childCount={parts.length}
                      />
                    </Td>
                  )}
                </Tr>
              );
            })
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}
