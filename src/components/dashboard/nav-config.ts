import type { ModuleKey } from '@/lib/rbac';

export interface NavLink {
  href: string;
  label: string;
  icon: string; // اسم أيقونة من lucide-react
  module: ModuleKey;
  exact?: boolean;
  /** لم تُبنَ بعد — تُخفى من القائمة حتى لا يوجد رابط مكسور */
  soon?: boolean;
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

export const NAV: NavGroup[] = [
  {
    label: 'عام',
    links: [
      { href: '/dashboard', label: 'نظرة عامة', icon: 'LayoutDashboard', module: 'dashboard', exact: true },
      { href: '/dashboard/pos', label: 'نقطة البيع', icon: 'ScanBarcode', module: 'pos' },
    ],
  },
  {
    label: 'العمليات',
    links: [
      { href: '/dashboard/bookings', label: 'الحجوزات', icon: 'CalendarClock', module: 'crm' },
      { href: '/dashboard/job-orders', label: 'أوامر الشغل', icon: 'Wrench', module: 'workshop' },
      { href: '/dashboard/customers', label: 'العملاء', icon: 'Users', module: 'crm' },
      { href: '/dashboard/vehicles', label: 'السيارات', icon: 'Car', module: 'crm', soon: true },
      { href: '/dashboard/warranties', label: 'الكفالات', icon: 'ShieldCheck', module: 'crm', soon: true },
    ],
  },
  {
    label: 'المبيعات والمخزون',
    links: [
      { href: '/dashboard/invoices', label: 'الفواتير', icon: 'Receipt', module: 'pos' },
      { href: '/dashboard/products', label: 'المنتجات', icon: 'Package', module: 'inventory' },
      { href: '/dashboard/stock', label: 'حركة المخزون', icon: 'ArrowLeftRight', module: 'inventory', soon: true },
      { href: '/dashboard/purchases', label: 'أوامر الشراء', icon: 'Truck', module: 'inventory', soon: true },
      { href: '/dashboard/suppliers', label: 'المورّدون', icon: 'Building2', module: 'inventory', soon: true },
    ],
  },
  {
    label: 'الموارد البشرية',
    links: [
      { href: '/dashboard/hr/employees', label: 'الموظفون', icon: 'IdCard', module: 'hr' },
      { href: '/dashboard/hr/attendance', label: 'الحضور والانصراف', icon: 'Clock', module: 'hr' },
      { href: '/dashboard/hr/leaves', label: 'الإجازات', icon: 'CalendarOff', module: 'hr' },
      { href: '/dashboard/hr/payroll', label: 'الرواتب', icon: 'Banknote', module: 'hr' },
      { href: '/dashboard/hr/advances', label: 'السلف', icon: 'HandCoins', module: 'hr' },
      { href: '/dashboard/hr/reviews', label: 'تقييم الأداء', icon: 'Star', module: 'hr' },
    ],
  },
  {
    label: 'المحتوى',
    links: [
      { href: '/dashboard/cms/home', label: 'الصفحة الرئيسية', icon: 'Home', module: 'cms' },
      { href: '/dashboard/cms/services', label: 'الخدمات', icon: 'Layers', module: 'cms' },
      { href: '/dashboard/cms/settings', label: 'إعدادات الموقع', icon: 'Globe', module: 'cms' },
      { href: '/dashboard/cms/gallery', label: 'معرض الصور', icon: 'Images', module: 'cms' },
      { href: '/dashboard/cms/testimonials', label: 'آراء العملاء', icon: 'MessageSquareQuote', module: 'cms' },
      { href: '/dashboard/cms/pages', label: 'الصفحات', icon: 'FileText', module: 'cms' },
      // آخر القائمة عمداً: المحتوى يُحرَّر من صفحاته، وهذه للحالات النادرة
      { href: '/dashboard/cms/translations', label: 'كل النصوص', icon: 'Languages', module: 'cms' },
    ],
  },
  {
    label: 'النظام',
    links: [
      { href: '/dashboard/reports', label: 'التقارير', icon: 'ChartColumn', module: 'reports', soon: true },
      { href: '/dashboard/settings', label: 'الإعدادات', icon: 'Settings', module: 'settings', soon: true },
      { href: '/dashboard/settings/users', label: 'المستخدمون', icon: 'UserCog', module: 'settings' },
    ],
  },
];
