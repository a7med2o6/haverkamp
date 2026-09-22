'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { checkGeolocationSupport, getGeolocationErrorMessage } from '@/lib/geo';
import { saveWashCardLocation } from './actions';

/**
 * مكون التقاط موقع سيارة العميل من صفحة متابعة الاشتراك (/w/[token]).
 *
 * يتيح للعميل تحديد موقع سيارته مباشرة وهو واقف بجانبها لسهولة وصول
 * فريق الغسيل، ويُتيح تحديثه مستقبلاً إذا غير موقفها.
 */
export function SetLocation({
  token,
  lat,
  lng,
}: {
  token: string;
  lat: number | null;
  lng: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);

  const hasPoint = lat !== null && lng !== null;

  function handleCapture() {
    const supportError = checkGeolocationSupport();
    if (supportError) {
      toast.error(supportError);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        startTransition(async () => {
          try {
            const res = await saveWashCardLocation(
              token,
              position.coords.latitude,
              position.coords.longitude
            );
            if (res.error) {
              toast.error(res.error);
              return;
            }
            const accuracy = Math.round(position.coords.accuracy);
            toast.success(`حُفظ الموقع — دقّة ±${accuracy} م`);
            router.refresh();
          } finally {
            setLocating(false);
          }
        });
      },
      (error) => {
        setLocating(false);
        toast.error(getGeolocationErrorMessage(error));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  if (hasPoint) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] px-5 py-3 text-[13px]">
        <span className="text-[var(--text-2)]">موقع السيارة على الخريطة محدّد</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCapture}
          disabled={pending || locating}
          className="gap-1.5 text-accent hover:text-accent font-semibold"
        >
          {locating || pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MapPin className="size-4" />
          )}
          تحديث موقع سيارتي
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-5 space-y-3">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 size-5 shrink-0 text-accent" />
        <div>
          <h3 className="text-sm font-bold text-[var(--text-0)]">موقع سيارتك غير محدّد</h3>
          <p className="mt-1 text-[13px] leading-6 text-[var(--text-1)]">
            تحديد موقع السيارة وأنت واقف بجانبها يساعد فريق الغسيل على الوصول إليها بسرعة ودقة.
          </p>
        </div>
      </div>
      <Button
        variant="secondary"
        onClick={handleCapture}
        disabled={pending || locating}
        className="w-full h-11 text-sm font-bold gap-2 text-accent"
      >
        {locating || pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MapPin className="size-4" />
        )}
        احفظ موقع سيارتي الآن
      </Button>
    </div>
  );
}
