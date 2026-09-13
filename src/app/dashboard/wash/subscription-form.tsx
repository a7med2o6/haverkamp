'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { dateOnlyToInput, formatPhone, todayDateOnly } from '@/lib/utils';
import { customerVehicles } from '@/app/dashboard/job-orders/actions';
import { createWashSubscription, updateWashSubscription } from './actions';

export interface WashSubscriptionFormValues {
  id?: string;
  customerId: string;
  vehicleId: string;
  servicePackageId?: string | null;
  defaultWasherId?: string | null;
  area: string;
  block?: string | null;
  street?: string | null;
  building?: string | null;
  locationNotes?: string | null;
  startDate: string;
  monthlyPrice: string;
  notes?: string | null;
}

export interface WashVehicleOption {
  id: string;
  label: string;
  plateNo: string | null;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

interface PackageOption {
  id: string;
  label: string;
}

interface WasherOption {
  id: string;
  label: string;
}

const EMPTY: WashSubscriptionFormValues = {
  customerId: '',
  vehicleId: '',
  servicePackageId: '',
  defaultWasherId: '',
  area: '',
  block: '',
  street: '',
  building: '',
  locationNotes: '',
  startDate: dateOnlyToInput(todayDateOnly()),
  monthlyPrice: '',
  notes: '',
};

export function WashSubscriptionFormButton({
  customers,
  packages,
  washers,
  subscription,
  initialVehicles = [],
  compact = false,
}: {
  customers: CustomerOption[];
  packages: PackageOption[];
  washers: WasherOption[];
  subscription?: WashSubscriptionFormValues;
  initialVehicles?: WashVehicleOption[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!subscription?.id;

  return (
    <>
      <Button
        variant={isEdit ? 'ghost' : 'primary'}
        size={compact ? 'icon-sm' : 'md'}
        onClick={() => setOpen(true)}
        aria-label={compact ? 'تعديل اشتراك الغسيل' : undefined}
      >
        {isEdit ? <Pencil /> : <Plus />}
        {!compact && (isEdit ? 'تعديل الاشتراك' : 'اشتراك جديد')}
      </Button>
      {open && (
        <WashSubscriptionFormModal
          initial={subscription ?? EMPTY}
          customers={customers}
          packages={packages}
          washers={washers}
          initialVehicles={initialVehicles}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function WashSubscriptionFormModal({
  initial,
  customers,
  packages,
  washers,
  initialVehicles,
  onClose,
}: {
  initial: WashSubscriptionFormValues;
  customers: CustomerOption[];
  packages: PackageOption[];
  washers: WasherOption[];
  initialVehicles: WashVehicleOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingVehicles, startVehicleTransition] = useTransition();
  const [values, setValues] = useState<WashSubscriptionFormValues>(initial);
  const [vehicles, setVehicles] = useState<WashVehicleOption[]>(initialVehicles);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function set<K extends keyof WashSubscriptionFormValues>(
    key: K,
    value: WashSubscriptionFormValues[K]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const loadVehicles = useCallback((customerId: string) => {
    if (!customerId) {
      setVehicles([]);
      return;
    }

    startVehicleTransition(async () => {
      const result = await customerVehicles({ customerId });
      if (!result.ok) {
        setVehicles([]);
        toast.error(result.error);
        return;
      }
      const data = result.data as { vehicles?: WashVehicleOption[] } | undefined;
      setVehicles(data?.vehicles ?? []);
    });
  }, []);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = initial.id
        ? await updateWashSubscription({ ...values, id: initial.id })
        : await createWashSubscription(values);

      if (result.ok) {
        toast.success(result.message ?? 'تم الحفظ');
        onClose();
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'تعديل اشتراك الغسيل' : 'اشتراك غسيل جديد'}
      description="العقد لسيارة واحدة، وموقع الخدمة هو المكان الذي يذهب إليه الغسّيل"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button type="submit" form="wash-subscription-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            حفظ
          </Button>
        </>
      }
    >
      <form id="wash-subscription-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="العميل" error={errors.customerId?.[0]}>
          <Combobox
            value={values.customerId}
            onChange={(customerId) => {
              setValues((current) => ({ ...current, customerId, vehicleId: '' }));
              setVehicles([]);
              loadVehicles(customerId);
            }}
            placeholder="اكتب اسم العميل أو رقمه…"
            emptyLabel="لا يوجد عميل بهذا الاسم أو الرقم"
            options={customers.map((customer) => ({
              value: customer.id,
              label: customer.name,
              hint: formatPhone(customer.phone),
            }))}
          />
        </Field>

        <Field
          label="السيارة"
          error={errors.vehicleId?.[0]}
          hint={loadingVehicles ? 'جارٍ تحميل سيارات العميل…' : undefined}
        >
          <Select
            value={values.vehicleId}
            onChange={(event) => set('vehicleId', event.target.value)}
            disabled={!values.customerId || loadingVehicles}
            required
          >
            <option value="">{values.customerId ? 'اختر السيارة' : 'اختر العميل أولاً'}</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.label}
                {vehicle.plateNo ? ` — ${vehicle.plateNo}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="المنطقة" error={errors.area?.[0]}>
          <Input
            value={values.area}
            onChange={(event) => set('area', event.target.value)}
            placeholder="الأندلس، السالمية…"
            required
          />
        </Field>

        <Field label="القطعة" error={errors.block?.[0]}>
          <Input value={values.block ?? ''} onChange={(event) => set('block', event.target.value)} />
        </Field>

        <Field label="الشارع" error={errors.street?.[0]}>
          <Input value={values.street ?? ''} onChange={(event) => set('street', event.target.value)} />
        </Field>

        <Field label="المبنى" error={errors.building?.[0]}>
          <Input
            value={values.building ?? ''}
            onChange={(event) => set('building', event.target.value)}
          />
        </Field>

        <Field label="تاريخ البدء" error={errors.startDate?.[0]} hint="مرساة جدول يوم ويوم">
          <Input
            type="date"
            value={values.startDate}
            onChange={(event) => set('startDate', event.target.value)}
            dir="ltr"
            className="text-start tnum"
            required
          />
        </Field>

        <Field label="الاشتراك الشهري" error={errors.monthlyPrice?.[0]} hint="د.ك — 3 خانات عشرية">
          <Input
            type="number"
            min="0"
            step="0.001"
            value={values.monthlyPrice}
            onChange={(event) => set('monthlyPrice', event.target.value)}
            dir="ltr"
            className="text-start tnum"
            required
          />
        </Field>

        <Field label="الباقة" error={errors.servicePackageId?.[0]} hint="اختيارية">
          <Select
            value={values.servicePackageId ?? ''}
            onChange={(event) => set('servicePackageId', event.target.value)}
          >
            <option value="">بدون باقة مرتبطة</option>
            {packages.map((servicePackage) => (
              <option key={servicePackage.id} value={servicePackage.id}>
                {servicePackage.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="الغسّيل المعتاد" error={errors.defaultWasherId?.[0]} hint="اختياري — يُنسخ إلى جدول الغسلات">
          <Select
            value={values.defaultWasherId ?? ''}
            onChange={(event) => set('defaultWasherId', event.target.value)}
          >
            <option value="">بدون غسّيل محدد</option>
            {washers.map((washer) => (
              <option key={washer.id} value={washer.id}>
                {washer.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="وصف موقع الوقوف" className="sm:col-span-2" error={errors.locationNotes?.[0]}>
          <Textarea
            value={values.locationNotes ?? ''}
            onChange={(event) => set('locationNotes', event.target.value)}
            placeholder="مثلاً: خلف مبنى العمل، المواقف السفلية، اتصل قبل الوصول…"
          />
        </Field>

        <Field label="ملاحظات العقد" className="sm:col-span-2" error={errors.notes?.[0]}>
          <Textarea
            value={values.notes ?? ''}
            onChange={(event) => set('notes', event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
