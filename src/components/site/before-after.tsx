'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/**
 * مقارنة قبل/بعد بمقبض سحب.
 * بديل js/before-after.js — نُبقي المنطق داخل React بدل سكربت خارجي
 * يعدّل عقداً يملكها التصيير.
 */
export function BeforeAfter({
  before,
  after,
  beforeLabel,
  afterLabel,
  ariaLabel,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(50);
  const dragging = useRef(false);

  const setFromClientX = useCallback((x: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPct(Math.min(100, Math.max(0, ((x - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => dragging.current && setFromClientX(e.clientX);
    const onTouch = (e: TouchEvent) => dragging.current && setFromClientX(e.touches[0].clientX);
    const stop = () => (dragging.current = false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', stop);
    };
  }, [setFromClientX]);

  return (
    <div
      ref={ref}
      className="ba-slider"
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      onMouseDown={(e) => {
        dragging.current = true;
        setFromClientX(e.clientX);
        e.preventDefault();
      }}
      onTouchStart={(e) => {
        dragging.current = true;
        setFromClientX(e.touches[0].clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') setPct((p) => Math.min(100, p + 2));
        else if (e.key === 'ArrowLeft') setPct((p) => Math.max(0, p - 2));
        else return;
        e.preventDefault();
      }}
    >
      <Image src={after} alt={afterLabel} width={1200} height={800} className="ba-after" />
      <Image
        src={before}
        alt={beforeLabel}
        width={1200}
        height={800}
        className="ba-before"
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
      />

      <div className="ba-divider" style={{ left: `${pct}%` }}>
        <div className="ba-handle glass">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" transform="rotate(180 12 12)" />
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>
      </div>

      <span className="ba-label ba-label-before">{beforeLabel}</span>
      <span className="ba-label ba-label-after">{afterLabel}</span>
    </div>
  );
}
