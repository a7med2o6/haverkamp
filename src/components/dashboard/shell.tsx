'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { Sidebar } from './sidebar';
import { GlobalSearch } from './global-search';
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

  /*
    الغسّيل الميداني (WASHER) لا يملك سوى صلاحية wash:visit المقتصرة على صفحته الوحيدة.
    استبعاد البحث الشامل (globalSearch) يمنع الأخطاء الناتجة عن عدم امتلاكه crm:read،
    وحذف الشريط الجانبي يوفّر مساحة الشاشة كاملة لعمله الميداني على الجوال بلمسة واحدة.
  */
  const isWasher = user.role === 'WASHER';

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
      {/* الشريط الجانبي — سطح المكتب (مستبعد للغسّيل لتوفير المساحة) */}
      {!isWasher && (
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-s-0 border-e border-[var(--line)] bg-[var(--surface-1)] lg:block">
          <Sidebar role={user.role} />
        </aside>
      )}

      {/* الدرج — الجوال */}
      {!isWasher && drawerOpen && (
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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--surface-1)]/85 px-3 sm:px-4 backdrop-blur-xl">
          {!isWasher ? (
            <>
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="فتح القائمة"
                className="rounded-[var(--radius-sm)] p-2 text-[var(--text-1)] hover:bg-[var(--glass-strong)] lg:hidden shrink-0"
              >
                <Menu className="size-5" />
              </button>

              <div className="flex min-w-0 flex-1 justify-center">
                <GlobalSearch />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/dashboard/wash/today" className="flex items-center">
                <Image
                  src="/assets/logo.png"
                  alt="هافركامب"
                  width={100}
                  height={28}
                  className="h-7 w-auto object-contain"
                />
              </Link>
            </div>
          )}

          <div className="flex items-center gap-2 ms-auto min-w-0 shrink">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
              title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
              className="shrink-0"
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>

            <div className="flex items-center gap-2 border-s border-[var(--line)] ps-2.5 min-w-0 shrink">
              <div className="min-w-0 text-end max-w-[120px] sm:max-w-[200px]">
                <p className="truncate text-[13px] font-semibold leading-tight text-[var(--text-0)]" title={user.name ?? ''}>
                  {user.name}
                </p>
                <p className="truncate text-[11px] leading-tight text-[var(--text-2)]">
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/20 text-[13px] font-bold text-accent-soft">
                {initials}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => signOut({ callbackUrl: '/login' })}
                aria-label="تسجيل الخروج"
                title="تسجيل الخروج"
                className="shrink-0"
              >
                <LogOut />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
