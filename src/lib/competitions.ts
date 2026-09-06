import type { Locale } from '@/lib/site-data';

export type CompetitionId = 'winner-draw' | 'stop-at-10';

export interface Competition {
  id: CompetitionId;
  slug: string;
  title: {
    ar: string;
    en: string;
  };
  tagline: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
  badge: {
    ar: string;
    en: string;
  };
  iconName: string; // Lucide icon identifier ('Trophy', 'Timer', etc.)
  accentColor: string;
  href: {
    ar: string;
    en: string;
  };
  previewType: 'wheel' | 'timer';
}

export const COMPETITIONS: Competition[] = [
  {
    id: 'winner-draw',
    slug: 'winner-draw',
    title: {
      ar: 'برنامج سحب الفائزين',
      en: 'Winner Draw System',
    },
    tagline: {
      ar: 'سحب عشوائي تفاعلي لعملاء المعرض والجوائز الفورية',
      en: 'Interactive random draw for branch customers and instant prizes',
    },
    description: {
      ar: 'شاشة سحب دائرية مصممة للعرض الفاخر داخل الفرع. تتيح إجراء سحوبات العملاء وتوزيع الجوائز الفورية مع مؤثرات صوتية وبصرية مميزة.',
      en: 'A high-definition draw wheel crafted for branch presentation displays. Conduct customer lucky draws and instant prize giveaways with rich audio-visual celebration.',
    },
    badge: {
      ar: 'سحب الفائزين',
      en: 'Lucky Wheel',
    },
    iconName: 'Trophy',
    accentColor: '#5eb8ff',
    href: {
      ar: '/competitions/winner-draw',
      en: '/en/competitions/winner-draw',
    },
    previewType: 'wheel',
  },
  {
    id: 'stop-at-10',
    slug: 'stop-at-10',
    title: {
      ar: 'تحدي 10 ثوانٍ',
      en: 'Stop at 10 Seconds',
    },
    tagline: {
      ar: 'اختبر دقة توقيتك وأوقف الساعة عند 10.000 ثانية بالضبط',
      en: 'Test your timing precision and freeze the clock at exactly 10.000 seconds',
    },
    description: {
      ar: 'تحدٍ تفاعلي سريع ومباشر على شاشة الفرع. اضغط لبدء المؤقت ثم انقر لإيقافه بدقة أجزاء من الألف من الثانية واكتشف مدى قربك من الهدف.',
      en: 'A fast-paced interactive challenge on the branch display. Start the timer and lock it with millisecond precision to see how close you get to 10 seconds.',
    },
    badge: {
      ar: 'تحدي الدقة',
      en: 'Precision Clock',
    },
    iconName: 'Timer',
    accentColor: '#38bdf8',
    href: {
      ar: '/competitions/stop-at-10',
      en: '/en/competitions/stop-at-10',
    },
    previewType: 'timer',
  },
];

/** الحصول على جميع المسابقات منسّقة للغة المحددة */
export function getCompetitions(locale: Locale) {
  return COMPETITIONS.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title[locale],
    tagline: c.tagline[locale],
    description: c.description[locale],
    badge: c.badge[locale],
    iconName: c.iconName,
    accentColor: c.accentColor,
    href: c.href[locale],
    previewType: c.previewType,
  }));
}

/** الحصول على مسابقة واحدة حسب المعرّف أو الـ slug */
export function getCompetition(idOrSlug: string, locale: Locale) {
  const comp = COMPETITIONS.find((c) => c.id === idOrSlug || c.slug === idOrSlug);
  if (!comp) return null;
  return {
    id: comp.id,
    slug: comp.slug,
    title: comp.title[locale],
    tagline: comp.tagline[locale],
    description: comp.description[locale],
    badge: comp.badge[locale],
    iconName: comp.iconName,
    accentColor: comp.accentColor,
    href: comp.href[locale],
    previewType: comp.previewType,
  };
}
