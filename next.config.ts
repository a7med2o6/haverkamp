import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // الجذر صار صفحة Next حقيقية — لم يعد يحتاج rewrite للموقع الثابت.
  // صفحات الخدمات (protication.html …) ما زالت تُخدَم من public/
  // عبر scripts/sync-legacy.mjs حتى يكتمل نقلها.
};

export default nextConfig;
