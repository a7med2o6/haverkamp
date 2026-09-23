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

/**
  حدود الكويت الجغرافية تحمي من الخطأ الأشهر: عكس خطي الطول والعرض
  أثناء النسخ أو الإدخال، فيقع 47.97 في خانة خط العرض.
*/
export function checkLatLng(lat: number, lng: number): { error: string } | null {
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

  return null;
}

/**
  تقريب الإحداثيات إلى ست خانات عشرية لتوحيد دقة الحفظ بين الإدخال اليدوي
  والتقاط جهاز الجوال.
*/
export function roundPoint(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
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

  const check = checkLatLng(lat, lng);
  if (check) return check;

  return roundPoint(lat, lng);
}

export function directionsUrl(lat: number | string, lng: number | string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/*
  بناء رابط اتجاهات Google Maps لجولة كاملة تضم عدة محطات مرتبة.

  يُسقف العدد عند 10 نقاط كحد أقصى (9 وسيطة + الوجهة الأخيرة) لأن خرائط
  غوغل ترفض الروابط الطويلة المباشرة ولتجنب الإسقاط الصامت الذي قد يوجّه
  الغسّيل إلى جولة ناقصة دون أن يعلم.
*/
export function routeUrl(points: Array<{ lat: number; lng: number }>): string | null {
  if (!points || points.length < 2) return null;
  const stops = points.slice(0, 10);
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, stops.length - 1);
  const waypointsStr = waypoints.map((p) => `${p.lat},${p.lng}`).join('|');

  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}${
    waypointsStr ? `&waypoints=${waypointsStr}` : ''
  }&travelmode=driving`;
}


/**
 * التحقق من دعم المتصفح والسياق الآمن للخدمات الجغرافية.
 */
export function checkGeolocationSupport(): string | null {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'يتطلب تحديد الموقع اتصالاً آمناً (HTTPS) — افتح الصفحة عبر رابط آمن';
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'متصفحك لا يدعم تحديد الموقع الجغرافي — استخدم متصفحاً أحدث';
  }
  return null;
}

/**
 * تحويل حالات تعذر تحديد الموقع في المتصفح إلى رسائل عربية تفاعلية توضح ما يجب فعله.
 */
export function getGeolocationErrorMessage(error: unknown): string {
  const supportError = checkGeolocationSupport();
  if (supportError && !(typeof GeolocationPositionError !== 'undefined' && error instanceof GeolocationPositionError)) {
    return supportError;
  }
  if (typeof GeolocationPositionError !== 'undefined' && error instanceof GeolocationPositionError) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'اسمَح للموقع بالوصول إلى موقعك الجغرافي من إعدادات المتصفح ثم أعد المحاولة';
      case error.POSITION_UNAVAILABLE:
        return 'تعذّر الاتصال بأقمار الموقع — تأكّد من تفعيل الـ GPS وجرّب الانتقال إلى مكان مكشوف';
      case error.TIMEOUT:
        return 'انتهت مهلة البحث عن الموقع — أعد المحاولة في مكان أفضل أو خارج المواقف المغلقة';
    }
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: number }).code;
    if (code === 1) {
      return 'اسمَح للموقع بالوصول إلى موقعك الجغرافي من إعدادات المتصفح ثم أعد المحاولة';
    }
    if (code === 2) {
      return 'تعذّر الاتصال بأقمار الموقع — تأكّد من تفعيل الـ GPS وجرّب الانتقال إلى مكان مكشوف';
    }
    if (code === 3) {
      return 'انتهت مهلة البحث عن الموقع — أعد المحاولة في مكان أفضل أو خارج المواقف المغلقة';
    }
  }
  return 'تعذّر تحديد الموقع — تأكّد من تفعيل الـ GPS وإعدادات المتصفح وأعد المحاولة';
}
