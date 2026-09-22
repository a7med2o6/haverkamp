/*
  تحليل إحداثيات موقع غسيل السيارة وتحويلها إلى نقطة جغرافية دقيقة.

  نحفظ النقطة كـ Decimal بست خانات عشرية تعطي دقة ~0.1m وهي أسبغ من حاجة
  موقف السيارة، وتحفظ القيمة دقيقة دون انحراف الفاصلة العائمة.
*/

/** تحويل الأرقام والفواصل العربية والشرقية إلى الصيغة اللاتينية القياسية */
function normalizeArabicNumbers(str: string): string {
  return str
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9')
    .replace(/٫/g, '.')
    .replace(/،/g, ',');
}

export function parseLatLng(raw: string): { lat: number; lng: number } | { error: string } {
  if (!raw || !raw.trim()) {
    return { error: 'لم يتم إدخال إحداثيات' };
  }

  const normalized = normalizeArabicNumbers(raw.trim());

  /*
    نرفض الروابط المختصرة فوراً بدلاً من تتبعها لأن الخادم لا ينبغي أن
    يجري طلبات خارجية بناءً على مدخلات المستخدم.
  */
  if (
    /maps\.app\.goo\.gl/i.test(normalized) ||
    /goo\.gl\/maps/i.test(normalized) ||
    /goo\.gl/i.test(normalized)
  ) {
    return {
      error:
        'الروابط المختصرة (مثل maps.app.goo.gl) غير مدعومة مباشرة — افتح الرابط في المتصفح أولاً ثم انسخ الرابط الكامل أو الإحداثيات',
    };
  }

  let lat: number | null = null;
  let lng: number | null = null;

  // رابط Google Maps الكامل بكل أشكاله (@lat,lng)
  const atMatch = normalized.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    lat = Number(atMatch[1]);
    lng = Number(atMatch[2]);
  }

  // معاملات الاستعلام في الروابط (q=, query=, destination=, ll=, center=, c=)
  if (lat === null || lng === null) {
    const queryMatch = normalized.match(
      /[?&](?:q|query|destination|ll|center|c)=(?:loc:)?(-?\d+(?:\.\d+)?)(?:%2C|[,+])+?(-?\d+(?:\.\d+)?)/i
    );
    if (queryMatch) {
      lat = Number(queryMatch[1]);
      lng = Number(queryMatch[2]);
    }
  }

  // زوج إحداثيات مجرد: "29.3375, 47.9744" أو "29.3375 47.9744"
  if (lat === null || lng === null) {
    const pairMatch = normalized.match(/(-?\d+(?:\.\d+)?)[, \t]+(-?\d+(?:\.\d+)?)/);
    if (pairMatch) {
      lat = Number(pairMatch[1]);
      lng = Number(pairMatch[2]);
    }
  }

  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      error:
        'لم نتمكن من التعرف على الإحداثيات — يرجى لصق رابط Google Maps الكامل أو الرقمين (مثل: 29.3375, 47.9744)',
    };
  }

  /*
    حدود الكويت الجغرافية تحمي من الخطأ الأشهر: عكس خطي الطول والعرض
    أثناء النسخ، فيقع 47.97 في خانة خط العرض.
  */
  if (lat >= 46.4 && lat <= 48.6 && lng >= 28.4 && lng <= 30.2) {
    return {
      error:
        'الإحداثيات معكوسة (خط الطول مكان خط العرض) — يُرجى كتابة خط العرض أولاً ثم خط الطول',
    };
  }

  if (lat < 28.4 || lat > 30.2 || lng < 46.4 || lng > 48.6) {
    return {
      error: 'الموقع يقع خارج حدود الكويت الجغرافية',
    };
  }

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

export function directionsUrl(lat: number | string, lng: number | string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
