export interface WheelLabelLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
}

export type TextWidthMeasurer = (text: string, fontSize: number) => number;

/**
 * Fits a text label within an annular wheel sector.
 *
 * Requirements:
 * 1. Radial constraint: text length must fit inside [innerRadius, outerRadius] (maxRadialWidth).
 * 2. Transverse constraint: text height (1 or 2 lines) must fit inside sector wedge width (maxTransverseHeight).
 * 3. Wraps long labels by word boundaries into at most 2 lines.
 * 4. Reduces font size only as needed, bounded by user's wheelFontSize preferred size down to minFontSize.
 * 5. Truncates with '...' as a last resort.
 */
export function fitWheelLabel(
  measureText: TextWidthMeasurer,
  text: string,
  maxRadialWidth: number,
  maxTransverseHeight: number,
  preferredFontSize: number,
  minFontSize = 8
): WheelLabelLayout {
  const trimmed = text.trim();
  if (!trimmed) {
    return { lines: [''], fontSize: preferredFontSize, lineHeight: preferredFontSize * 1.15 };
  }

  const safePrefFont = Math.max(minFontSize, Math.round(preferredFontSize));
  const safeMinFont = Math.min(safePrefFont, Math.max(6, Math.round(minFontSize)));

  // Helper to split text into 2 lines at the best word boundary
  const splitWordsIntoTwoLines = (str: string): [string, string] => {
    const words = str.split(/\s+/);
    if (words.length <= 1) {
      return [str, ''];
    }
    let bestK = 1;
    let minDiff = Infinity;
    for (let k = 1; k < words.length; k++) {
      const l1 = words.slice(0, k).join(' ');
      const l2 = words.slice(k).join(' ');
      const diff = Math.abs(l1.length - l2.length);
      if (diff < minDiff) {
        minDiff = diff;
        bestK = k;
      }
    }
    return [words.slice(0, bestK).join(' '), words.slice(bestK).join(' ')];
  };

  // 1. Try 1 line at preferred font size
  const pref1LineWidth = measureText(trimmed, safePrefFont);
  if (pref1LineWidth <= maxRadialWidth && safePrefFont <= maxTransverseHeight) {
    return {
      lines: [trimmed],
      fontSize: safePrefFont,
      lineHeight: safePrefFont * 1.15,
    };
  }

  // 2 & 3. Try 1 line or 2 lines while reducing font size from preferred down to min
  const [line1Draft, line2Draft] = splitWordsIntoTwoLines(trimmed);
  const canWrap = line2Draft.length > 0;

  /*
    القطاع ضيّق عرضاً حين تكثر الجوائز، فسطران لا يسعان فيه مهما صغر
    الخط. والسطر الواحد يسع حيث لا يسع سطران، فيُجرَّب معه في كل مقاس:
    السطران أولاً لأنهما يُبقيان الاسم كاملاً، فإن لم يسعا ارتفاعاً
    سقطا إلى سطر. وبغير هذا يُرسَم سطران خارج حدّ قطاعهما فيركبان
    على جارَيهما.
  */
  for (let fSize = safePrefFont; fSize >= safeMinFont; fSize -= 1) {
    const lHeight = fSize * 1.15;

    if (canWrap && fSize + lHeight <= maxTransverseHeight) {
      const w1 = measureText(line1Draft, fSize);
      const w2 = measureText(line2Draft, fSize);
      if (w1 <= maxRadialWidth && w2 <= maxRadialWidth) {
        return { lines: [line1Draft, line2Draft], fontSize: fSize, lineHeight: lHeight };
      }
    }

    if (fSize <= maxTransverseHeight && measureText(trimmed, fSize) <= maxRadialWidth) {
      return { lines: [trimmed], fontSize: fSize, lineHeight: lHeight };
    }
  }

  // 4. Fallback at minFontSize with truncation
  const finalFont = safeMinFont;
  const finalLHeight = finalFont * 1.15;
  // لا يُقصّ إلى سطرين إلا إن وسعهما القطاع؛ وإلا فسطرٌ واحد مقصوص
  const isTwoLines = canWrap && finalFont + finalLHeight <= maxTransverseHeight;

  if (!isTwoLines) {
    let trunc = trimmed;
    while (trunc.length > 1 && measureText(trunc + '...', finalFont) > maxRadialWidth) {
      trunc = trunc.slice(0, -1);
    }
    return {
      lines: [trunc.length < trimmed.length && trunc !== trimmed ? trunc + '...' : trunc],
      fontSize: finalFont,
      lineHeight: finalLHeight,
    };
  }

  let l1 = line1Draft;
  if (measureText(l1, finalFont) > maxRadialWidth) {
    while (l1.length > 1 && measureText(l1 + '...', finalFont) > maxRadialWidth) {
      l1 = l1.slice(0, -1);
    }
    l1 = l1 + '...';
  }

  let l2 = line2Draft;
  if (measureText(l2, finalFont) > maxRadialWidth) {
    while (l2.length > 1 && measureText(l2 + '...', finalFont) > maxRadialWidth) {
      l2 = l2.slice(0, -1);
    }
    l2 = l2 + '...';
  }

  return {
    lines: [l1, l2],
    fontSize: finalFont,
    lineHeight: finalLHeight,
  };
}
