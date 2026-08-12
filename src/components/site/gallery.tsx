'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Item {
  id: string;
  src: string;
  caption: string;
}

/**
 * شبكة المعرض مع العرض المكبّر.
 * بُني في React بدل الاعتماد على lightbox.js القديم الذي يربط الحدث
 * عبر onclick نصي في HTML — وهو ما لا يصل إليه التصيير من الخادم.
 * أسماء الأصناف مطابقة لـ css/styles.css حتى يبقى الشكل واحداً.
 */
export function GalleryGrid({ items }: { items: Item[] }) {
  const [active, setActive] = useState<Item | null>(null);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [active]);

  return (
    <>
      <div className="gallery-grid">
        {items.map((g) => (
          <button
            key={g.id}
            type="button"
            className="gallery-item"
            onClick={() => setActive(g)}
            aria-label={g.caption || 'عرض الصورة'}
            style={{ border: 0, padding: 0, background: 'none', width: '100%' }}
          >
            <Image
              src={g.src}
              alt={g.caption}
              width={640}
              height={440}
              loading="lazy"
              className="gallery-img"
            />
          </button>
        ))}
      </div>

      {active && (
        <div
          className="lb-overlay open"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
          aria-label={active.caption}
        >
          <div className="lb-img-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lb-close"
              onClick={() => setActive(null)}
              aria-label="إغلاق"
            >
              ✕
            </button>
            <Image
              src={active.src}
              alt={active.caption}
              width={1600}
              height={1100}
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
