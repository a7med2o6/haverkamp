'use client';

import { useEffect } from 'react';

/**
 * عقود الشهر قد تبدأ في آخره، فتفتح الشبكة على أيامٍ فارغة وتختبئ غسلاتها
 * خلف الحافّة. فتُمرَّر إلى عمود اليوم عند التحميل.
 *
 * يُحرَّك الإطارُ الأفقي وحده: scrollIntoView يحرّك كل آبائه ومعهم الصفحة،
 * فتقفز الشاشة إلى الشبكة قبل أن يقرأ المشرف العدّادات. والإزاحة تُحسب
 * فرقاً بين موضعين لا قيمةً مطلقة، فتصحّ في اتجاه RTL كما في LTR.
 */
export function ScrollToToday() {
  useEffect(() => {
    const cell = document.querySelector<HTMLElement>('[data-today="true"]');
    const frame = cell?.closest<HTMLElement>('[data-coverage-scroll]');
    if (!cell || !frame) return;
    const cellBox = cell.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    // عمود الاشتراك الثابت يغطّي جزءاً من الإطار؛ يُتوسَّط ما يبقى مكشوفاً لا الإطار كلّه
    const sticky = frame.querySelector<HTMLElement>('[data-coverage-sticky]')?.getBoundingClientRect();
    let start = frameBox.left;
    let end = frameBox.right;
    if (sticky) {
      if (sticky.left + sticky.width / 2 > frameBox.left + frameBox.width / 2) end = sticky.left;
      else start = sticky.right;
    }
    frame.scrollLeft += cellBox.left + cellBox.width / 2 - (start + end) / 2;
  }, []);

  return null;
}
