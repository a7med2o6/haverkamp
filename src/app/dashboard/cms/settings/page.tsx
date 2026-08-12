import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingRow } from './setting-row';

export const metadata: Metadata = { title: 'إعدادات الموقع' };
export const dynamic = 'force-dynamic';

/** أسماء مفهومة بدل مفاتيح تقنية */
const LABELS: Record<string, string> = {
  'site.name.ar': 'اسم المركز (عربي)',
  'site.name.en': 'اسم المركز (إنجليزي)',
  'site.url': 'رابط الموقع',
  'contact.phone': 'رقم الهاتف',
  'contact.whatsapp': 'رقم واتساب (بصيغة دولية بلا +)',
  'contact.address.ar': 'العنوان (عربي)',
  'contact.address.en': 'العنوان (إنجليزي)',
  'contact.hours.ar': 'ساعات العمل (عربي)',
  'contact.hours.en': 'ساعات العمل (إنجليزي)',
  'social.instagram': 'رابط انستجرام',
  'stats.years': 'سنوات الخبرة',
  'stats.clients': 'عدد العملاء',
  'stats.cars': 'عدد السيارات المحمية',
  'pos.receiptFooter.ar': 'نص أسفل الفاتورة',
  'hr.workDayStart': 'بداية الدوام',
  'hr.workDayEnd': 'نهاية الدوام',
  'hr.lateGraceMins': 'سماح التأخير (دقيقة)',
};

const GROUP_TITLES: Record<string, string> = {
  general: 'بيانات عامة',
  contact: 'التواصل',
  social: 'التواصل الاجتماعي',
  stats: 'الأرقام في الصفحة الرئيسية',
  pos: 'نقطة البيع',
  hr: 'الموارد البشرية',
  tracking: 'التتبّع والإعلانات',
};

/** إعدادات بنية معقّدة أو حسّاسة لا تُحرَّر كنص بسيط */
const READONLY = new Set(['contact.geo', 'hr.weekend', 'hr.doubleDeductionDays', 'hr.unpaidLeaveTypes']);

export default async function SiteSettingsPage() {
  const session = await requirePermission('cms:read');
  const canWrite = can(session.user.role, 'cms:write');

  const settings = await db.siteSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });

  const byGroup = new Map<string, typeof settings>();
  for (const s of settings) {
    const list = byGroup.get(s.group) ?? [];
    list.push(s);
    byGroup.set(s.group, list);
  }

  return (
    <>
      <PageHeader
        title="إعدادات الموقع"
        description="أرقام التواصل والعنوان والأرقام المعروضة — تظهر على الموقع فور الحفظ"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {[...byGroup.entries()].map(([group, items]) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle>{GROUP_TITLES[group] ?? group}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {items.map((s) => (
                <SettingRow
                  key={s.key}
                  settingKey={s.key}
                  label={LABELS[s.key] ?? s.key}
                  value={
                    typeof s.value === 'object' && s.value !== null
                      ? JSON.stringify(s.value)
                      : String(s.value ?? '')
                  }
                  canWrite={canWrite && !READONLY.has(s.key)}
                />
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
