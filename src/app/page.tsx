import Link from 'next/link';
import Image from 'next/image';

// صفحة مؤقتة — تُستبدل بالموقع العام في المرحلة التالية
export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <Image
          src="/assets/logo.png"
          alt="هافركامب"
          width={180}
          height={60}
          priority
          className="mx-auto h-14 w-auto object-contain"
        />
        <h1 className="mt-8 text-2xl font-bold">هافركامب الكويت</h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          الموقع العام قيد النقل إلى المنصة الجديدة
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-11 items-center rounded-[var(--radius-sm)] bg-accent px-6 text-sm font-semibold text-[#04121f] hover:bg-accent-soft"
        >
          لوحة التحكم
        </Link>
      </div>
    </main>
  );
}
