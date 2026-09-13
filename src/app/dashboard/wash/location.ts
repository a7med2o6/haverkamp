/*
  موضع السيارة في سطرٍ واحد — للبطاقة التي يقرؤها الغسّيل واقفاً ولصفحة العقد.

  الحقل يُكتب بيد الموظف: منهم من يكتب «10» ومنهم «شارع 10». فإلحاق
  الوسم دائماً يُخرج «شارع شارع 10». يُلحق إذن حيث لا يبدأ به النصّ.
*/
function labelled(label: string, value: string | null): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text.startsWith(label) ? text : `${label} ${text}`;
}

export function washLocationLine(subscription: {
  area: string;
  block: string | null;
  street: string | null;
  building: string | null;
}): string {
  return [
    subscription.area,
    labelled('قطعة', subscription.block),
    labelled('شارع', subscription.street),
    labelled('مبنى', subscription.building),
  ]
    .filter(Boolean)
    .join('، ');
}
