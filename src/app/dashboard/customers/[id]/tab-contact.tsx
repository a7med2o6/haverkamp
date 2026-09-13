import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { CUSTOMER_NOTE_TYPE } from '@/lib/labels';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { EmptyPanel, Panel } from '@/app/dashboard/_profile/parts';
import { AddNoteButton, DeleteNoteButton, FollowUpToggle } from './notes-client';

/** مئة قيد تغطّي سنوات من تواصل عميل واحد؛ الحدّ يمنع صفحةً بلا قاع */
const NOTES_SHOWN = 100;

export async function ContactTab({
  customerId,
  canWrite,
  now,
}: {
  customerId: string;
  canWrite: boolean;
  now: Date;
}) {
  const [notes, total] = await Promise.all([
    db.customerNote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: NOTES_SHOWN,
      select: {
        id: true,
        type: true,
        body: true,
        followUpAt: true,
        doneAt: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    }),
    db.customerNote.count({ where: { customerId } }),
  ]);

  if (notes.length === 0) {
    return (
      <EmptyPanel
        text="لا يوجد سجل تواصل بعد."
        action={canWrite ? <AddNoteButton customerId={customerId} /> : null}
      />
    );
  }

  return (
    <Panel
      title="سجل التواصل"
      count={total}
      action={canWrite ? <AddNoteButton customerId={customerId} /> : null}
    >
      <ul className="divide-y divide-[var(--line)]">
        {notes.map((note) => {
          const overdue = Boolean(note.followUpAt && !note.doneAt && note.followUpAt < now);
          return (
            <li key={note.id} className={cn('px-4 py-3.5 sm:px-5', overdue && 'bg-danger/5')}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={CUSTOMER_NOTE_TYPE[note.type].tone}>
                  {CUSTOMER_NOTE_TYPE[note.type].label}
                </Badge>
                <span className="tnum text-[11px] text-[var(--text-2)]">
                  {formatDateTime(note.createdAt)}
                </span>
                {note.author && (
                  <span className="text-[11px] text-[var(--text-2)]">— {note.author.name}</span>
                )}
                {canWrite && (
                  <span className="ms-auto">
                    <DeleteNoteButton id={note.id} />
                  </span>
                )}
              </div>

              <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-1)]">
                {note.body}
              </p>

              {note.followUpAt && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2">
                  <span
                    className={cn(
                      'tnum text-[11px]',
                      note.doneAt ? 'text-ok' : overdue ? 'font-semibold text-danger' : 'text-warn'
                    )}
                  >
                    {note.doneAt
                      ? `تمّت المتابعة ${formatDate(note.doneAt)}`
                      : `متابعة ${formatDate(note.followUpAt)}${overdue ? ' — فات موعدها' : ''}`}
                  </span>
                  {canWrite && <FollowUpToggle id={note.id} done={Boolean(note.doneAt)} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {total > notes.length && (
        <p className="border-t border-[var(--line)] px-4 py-2.5 text-center text-[12px] text-[var(--text-2)] sm:px-5">
          يُعرض أحدث {notes.length} من {total} قيداً
        </p>
      )}
    </Panel>
  );
}
