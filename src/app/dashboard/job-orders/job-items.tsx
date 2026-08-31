'use client';

import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { formatKWD } from '@/lib/utils';
import { JobItemActions } from './job-client';

export interface JobItemRow {
  id: string;
  parentId: string | null;
  label: string;
  spec: string | null;
  unitPrice: number;
  total: number;
  /** درجات العزل الفريدة تحت هذه الخدمة — «شفاف · 30%» */
  grades: string[];
}

/**
 * بنود أمر الشغل — ما اختاره العميل.
 *
 * القطع لا تظهر هنا إطلاقاً.
 * أمر الشغل يجيب عن سؤال واحد: ماذا طلب العميل وبكم؟ والقطع ليست طلباً
 * — «بدي كامل» يعني البدي كلّه، وتعداد أربع عشرة قطعة تحته يعيد قول ما
 * قالته كلمتان. مكانها «توزيع الشغل» حيث تُسنَد لفنييها، وهناك وحدها
 * تعني شيئاً.
 */
export function JobItems({
  items,
  jobOrderId,
  canWrite,
}: {
  items: JobItemRow[];
  jobOrderId: string;
  canWrite: boolean;
}) {
  const parents = items.filter((i) => i.parentId === null);
  const partsOf = new Map<string, JobItemRow[]>();
  for (const i of items) {
    if (!i.parentId) continue;
    partsOf.set(i.parentId, [...(partsOf.get(i.parentId) ?? []), i]);
  }

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

              return (
                <Tr key={item.id}>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="font-medium text-[var(--text-0)]"
                      >
                        {item.label}
                      </span>
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
                  </Td>
                  <Td className="tnum font-semibold">{formatKWD(item.total)}</Td>
                  {canWrite && (
                    <Td>
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
