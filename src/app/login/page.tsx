import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="login-page relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      {/* هالة لونية خفيفة فوق خلفية اللوحة — تتبع الوضع الفاتح والداكن */}
      <div aria-hidden className="login-glow pointer-events-none absolute inset-0 -z-10" />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/assets/logo.png"
            alt="هافركامب"
            width={140}
            height={48}
            priority
            className="h-12 w-auto object-contain"
          />
          <h1 className="mt-6 text-xl font-bold text-[var(--text-0)]">لوحة تحكم هافركامب</h1>
          <p className="mt-1.5 text-[13px] text-[var(--text-1)]">
            سجّل الدخول للمتابعة إلى نظام الإدارة
          </p>
        </div>

        <div className="login-card rounded-[var(--radius-lg)] p-6">
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-2)]">
          © {new Date().getFullYear()} هافركامب الكويت — نظام إدارة داخلي
        </p>
      </div>
    </main>
  );
}
