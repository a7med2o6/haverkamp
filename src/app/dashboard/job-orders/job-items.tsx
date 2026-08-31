'use client';

import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { cn, formatKWD } from '@/lib/utils';
import { JobItemActions } from './job-client';

export interface JobItemRow {
  id: string;
  parentId: string | null;
  label: string;
  spec: string | null;
  unitPrice: number;
  total: number;
  isDone: boolean;
  techs: string[];
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
      <Table>
        <thead>
          <tr>
            <Th>ما طلبه العميل</Th>
            <Th>الفنيون</Th>
            <Th>السعر</Th>
            <Th>التقدّم</Th>
            {canWrite && <Th />}
          </tr>
        </thead>
        <tbody>
          {parents.length === 0 ? (
            <EmptyState
              title="لا توجد بنود"
              description="أنشئ بيان تشغيل أو أضف بنداً"
              colSpan={5}
            />
          ) : (
            parents.map((item) => {
              const parts = partsOf.get(item.id) ?? [];
              const done = parts.filter((p) => p.isDone).length;
              // فنيّو الخدمة هم مجموع من اشتغلوا على قطعها
              const techs = [...new Set(parts.flatMap((p) => p.techs))];

              return (
                <Tr key={item.id}>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'font-medium',
                          item.isDone
                            ? 'text-[var(--text-2)] line-through'
                            : 'text-[var(--text-0)]'
                        )}
                      >
                        {item.label}
                      </span>
                      {item.spec && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                          {item.spec}
                        </span>
                      )}
                      {item.grades.length > 0 && (
                        <span className="text-[11px] text-[var(--text-1)]">
                          {item.grades.join(' · ')}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <TechList names={techs} />
                  </Td>
                  <Td className="tnum font-semibold">{formatKWD(item.total)}</Td>
                  <Td className="tnum text-[12px] text-[var(--text-2)]">
                    {parts.length > 0
                      ? `${done} / ${parts.length}`
                      : item.isDone
                        ? 'منجز'
                        : '—'}
                  </Td>
                  {canWrite && (
                    <Td>
                      <JobItemActions
                        id={item.id}
                        jobOrderId={jobOrderId}
                        isDone={item.isDone}
                        label={item.label}
                        childCount={parts.length}
                        hideCheckbox={parts.length > 0}
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

function TechList({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <span className="text-[11px] text-[var(--text-2)]">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((n) => (
        <span
          key={n}
          className="rounded-full bg-[var(--glass-strong)] px-2 py-0.5 text-[11px] text-[var(--text-1)]"
        >
          {n}
        </span>
      ))}
    </div>
  );
}
