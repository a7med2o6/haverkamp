/**
 * نصوص الترجمة تحتوي وسوماً تنسيقية (<br/>, <b>, <span class="em">)
 * موروثة من الموقع الثابت. مصدرها قاعدتنا لا مدخلات المستخدمين،
 * فنعرضها كـ HTML بدل أن تظهر الوسوم حرفياً.
 */
export function Rich({
  html,
  as: Tag = 'span',
  ...props
}: { html: string; as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div' } & React.HTMLAttributes<HTMLElement>) {
  return <Tag {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}
