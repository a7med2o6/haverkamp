import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

const latin = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-latin',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://haverkampkw.com'),
  title: {
    default: 'هافركامب الكويت — أفضل شركة حماية سيارات',
    template: '%s | هافركامب الكويت',
  },
  description:
    'هافركامب الكويت — الوكيل الحصري لحماية هافركامب الألمانية وكلايف ديزاين الكورية. حماية بدي، عازل حراري، صبغ، بوليش وغسيل.',
  icons: {
    icon: [
      { url: '/assets/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/assets/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#050912',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      {/*
        الوضع المحفوظ يُطبَّق قبل أول رسم. بدونه تُرسم الصفحة داكنة
        (الافتراضي) ثم تقلب بعد الترطيب، فيرى مستخدم الوضع الفاتح ومضة
        سوداء في كل تنقّل.
        وسم script خام لا next/script: الأخير بـ beforeInteractive يدفع
        الشيفرة في طابور ينفّذه وقت التشغيل، وهو ما يأتي بعد أول رسم
        فتعود الومضة. السكربت المتزامن في الترويسة يوقف التحليل ويطبّق
        السمة قبل رسم أي شيء.
      */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('hk_theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}",
          }}
        />
      </head>
      <body className={`${arabic.variable} ${latin.variable}`}>
        {children}
        <Toaster
          position="top-center"
          richColors
          toastOptions={{ style: { fontFamily: 'var(--font-arabic)' } }}
        />
      </body>
    </html>
  );
}
