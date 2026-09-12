const ARABIC_INDIC_ZERO = '٠'.charCodeAt(0);
const EASTERN_ARABIC_INDIC_ZERO = '۰'.charCodeAt(0);

function toAsciiDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const value =
      code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9
        ? code - ARABIC_INDIC_ZERO
        : code - EASTERN_ARABIC_INDIC_ZERO;
    return String(value);
  });
}

/** يوحّد نص البحث: يحذف المسافات والشُّرَط ويحوّل الأرقام العربية إلى لاتينية */
export function normalizePlate(input: string): string {
  return toAsciiDigits(input).replace(/[\s\-_ـ]/g, '').toUpperCase();
}

export function digitsOnly(input: string): string {
  return toAsciiDigits(input).replace(/\D/g, '');
}
