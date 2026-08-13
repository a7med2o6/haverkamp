'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { Sidebar } from './sidebar';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS } from '@/lib/rbac';
import type { Role } from '@/generated/prisma/enums';

const THEME_KEY = 'hk_theme';

/** المشتركون في تغيّر الوضع — التبديل يحدث من زر واحد فنبلّغهم يدوياً */
const themeListeners = new Set<() => void>();

function subscribeTheme(cb: () => void) {
  themeListeners.add(cb);
  return () => themeListeners.delete(cb);
}

/**
 * السمة على <html> هي مصدر الحقيقة لا حالة React: السكربت في التخطيط
 * الجذري يضعها قبل أول رسم، فقراءتها منه تُبقي أيقونة الزر مطابقة
 * للمعروض من أول لحظة بلا وميض.
 */
function readTheme(): 'dark' | 'light' {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function useTheme() {
  // الخادم لا يعرف تفضيل الزائر — الداكن هو الافتراضي في التنسيقات
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'dark' as const);

  const toggle = useCallback(() => {
    const next = readTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // التصفّح الخاص قد يمنع التخزين — التبديل يبقى فعّالاً لهذه الجلسة
    }
    for (const cb of themeListeners) cb();
  }, []);

  return { theme, toggle };
}

export function DashboardShell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null; role: Role };
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggle } = useTheme();

  // إغلاق الدرج بمفتاح Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const initials = (user.name || user.email || '؟').trim().charAt(0);

  return (
    <div className="flex min-h-dvh bg-[var(--surface-0)]">
      {/* الشريط الجانبي — سطح المكتب */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-s-0 border-e border-[var(--line)] bg-[var(--surface-1)] lg:block">
        <Sidebar role={user.role} />
      </aside>

      {/* الدرج — الجوال */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          {/* الدرج يفتح من نفس جهة زر القائمة (يمين في RTL) */}
          <aside className="absolute inset-y-0 start-0 w-72 border-e border-[var(--line)] bg-[var(--surface-1)] shadow-2xl">
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="إغلاق القائمة"
              className="absolute end-3 top-5 z-10 rounded-full p-1.5 text-[var(--text-2)] hover:bg-[var(--glass-strong)] hover:text-[var(--text-0)]"
            >
              <X className="size-5" />
            </button>
            <Sidebar role={user.role} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* المحتوى */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-1)]/85 px-4 backdrop-blur-xl">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="فتح القائمة"
            className="rounded-[var(--radius-sm)] p-2 text-[var(--text-1)] hover:bg-[var(--glass-strong)] lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>

          <div className="flex items-center gap-2.5 border-s border-[var(--line)] ps-3">
            <div className="hidden text-end sm:block">
              <p className="text-[13px] font-semibold leading-tight text-[var(--text-0)]">
                {user.name}
              </p>
              <p className="text-[11px] leading-tight text-[var(--text-2)]">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <div className="grid size-8 place-items-center rounded-full bg-accent/20 text-[13px] font-bold text-accent-soft">
              {initials}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
            >
              <LogOut />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
