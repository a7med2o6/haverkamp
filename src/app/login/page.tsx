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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      {/* خلفية متدرّجة */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 25% 10%, rgba(94,184,255,0.10), transparent 60%), radial-gradient(ellipse 50% 45% at 80% 90%, rgba(94,184,255,0.06), transparent 60%), linear-gradient(140deg, #050912 0%, #0a1424 50%, #050912 100%)',
        }}
      />

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
          <p className="mt-1.5 text-[13px] text-[var(--text-2)]">
            سجّل الدخول للمتابعة إلى نظام الإدارة
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--glass)] p-6 shadow-[var(--shadow-card)] backdrop-blur-2xl">
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
