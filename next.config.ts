import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // مؤقت: الجذر يعرض الصفحة الرئيسية للموقع الثابت القديم من public/
      // (ينسخها scripts/sync-legacy.mjs عند تشغيل npm run dev).
      // احذف هذه القاعدة بمجرد بناء الصفحة الرئيسية في Next.js.
      beforeFiles: [{ source: '/', destination: '/index.html' }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
