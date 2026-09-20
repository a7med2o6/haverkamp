import { cache } from 'react';
import QRCode from 'qrcode';

/**
 * رمز الاستجابة SVG — يُولَّد على الخادم لا من خدمة خارجية: الفاتورة تُطبع
 * في الفرع بلا إنترنت، ولا تخرج روابط العملاء إلى طرفٍ ثالث.
 *
 * ومستوى التصحيح M: الورق يُطوى ويتّسخ، فيُقرأ الرمز وإن تلف بعضه.
 */
export const qrSvg = cache(async (text: string): Promise<string | null> => {
  if (!text) return null;
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 200,
    });
  } catch {
    // رمزٌ تعذّر توليده لا يمنع طباعة الفاتورة
    return null;
  }
});
