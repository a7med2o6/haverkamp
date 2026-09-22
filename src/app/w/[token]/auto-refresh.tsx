'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * تحديث تلقائي لكارت الغسيل: يُعطى العميل أحدث بيانات لغسلاته عندما
 * يفتح الصفحة أو عند عودته إلى التبويب بعد أن يُتِم الغسّيل مهمّته.
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 60_000);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [router]);

  return null;
}
