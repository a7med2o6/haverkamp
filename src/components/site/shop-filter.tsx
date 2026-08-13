'use client';

import { useState } from 'react';

/**
 * أزرار تصفية أقسام المتجر.
 * الأقسام كلها مُصيَّرة من الخادم — نُخفي غير المطابق بالـ CSS بدل
 * إعادة الجلب، فالقائمة صغيرة والتنقّل يبقى فورياً.
 */
export function ShopFilter({
  all,
  sections,
}: {
  all: string;
  sections: { id: string; nav: string }[];
}) {
  const [active, setActive] = useState('all');

  function pick(value: string) {
    setActive(value);
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) el.style.display = value === 'all' || value === s.id ? '' : 'none';
    }
  }

  return (
    <div className="filter-bar">
      {[{ id: 'all', nav: all }, ...sections].map((s) => (
        <button
          key={s.id}
          type="button"
          className={`filter-btn${active === s.id ? ' active' : ''}`}
          onClick={() => pick(s.id)}
        >
          {s.nav}
        </button>
      ))}
    </div>
  );
}
