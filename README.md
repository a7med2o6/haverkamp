# هافركامب الكويت — Haverkamp Kuwait

موقع رسمي لمركز هافركامب لحماية السيارات في الكويت.

**الرابط:** https://haverkampkw.com

---

## عن الموقع

موقع ثابت (Static HTML/CSS/JS) باللغة العربية من اليمين لليسار (RTL).  
يعرض خدمات مركز هافركامب الكويت — الوكيل الحصري لحماية هافركامب الألمانية وكلايف ديزاين الكورية في الشرق الأوسط.

---

## الصفحات

| الملف | الوصف | الرابط |
|-------|-------|--------|
| `index.html` | الصفحة الرئيسية | `/` |
| `protication.html` | حماية بدي PPF (نظرة عامة) | `/protication.html` |
| `haverkamp.html` | حماية هافركامب الألمانية | `/haverkamp.html` |
| `clif.html` | حماية كلايف ديزاين الكورية | `/clif.html` |
| `iron.html` | حماية أيرون شيلد الأمريكية | `/iron.html` |
| `tint.html` | عازل حراري وتظليل | `/tint.html` |
| `paint.html` | صبغ السيارات | `/paint.html` |
| `polish.html` | بوليش وتلميع | `/polish.html` |
| `wash.html` | غسيل متنقل | `/wash.html` |
| `accessories.html` | متجر الإكسسوارات | `/accessories.html` |
| `contactus.html` | تواصل معنا | `/contactus.html` |
| `terms.html` | البنود والشروط | `/terms.html` |
| `car-color.html` | مُكوّن اللون 3D (داخلي) | `/car-color.html` |

---

## هيكل المشروع

```
haverkamp/
├── index.html
├── protication.html
├── haverkamp.html
├── clif.html
├── iron.html
├── tint.html
├── paint.html
├── polish.html
├── wash.html
├── accessories.html
├── contactus.html
├── terms.html
├── car-color.html          ← أداة تغيير الألوان 3D (محظورة من Google)
├── body-protection.html    ← صفحة قديمة (محفوظة للتوافق)
├── sitemap.xml
├── robots.txt
├── site.webmanifest
├── favicon.ico
├── css/
│   └── styles.css          ← نظام التصميم الموحد
├── js/
│   └── lightbox.js         ← معرض الصور
└── assets/
    ├── logo.png
    ├── haverkamp.png
    ├── main.webp
    └── 3d/                 ← ملفات النماذج ثلاثية الأبعاد
```

---

## التقنيات

- **HTML5 / CSS3 / JavaScript** — بدون أي framework
- **RTL** — `dir="rtl"` و `lang="ar"` على جميع الصفحات
- **Glass Morphism** — نظام تصميم موحد في `css/styles.css`
- **Sketchfab Viewer API** — عارض السيارات ثلاثي الأبعاد في `car-color.html`
- **WhatsApp Deep Links** — ربط النماذج والمنتجات بواتساب الشركة
- **Google Fonts** — IBM Plex Sans Arabic + Plus Jakarta Sans

---

## SEO

كل صفحة عامة تحتوي على:
- Meta description + keywords
- Canonical tag
- Open Graph (Facebook / WhatsApp)
- Twitter Card
- JSON-LD Structured Data (Schema.org)
- Google Ads Tag (AW-16636917037)
- Google Site Verification
- Bing Verification (msvalidate.01)

ملفات SEO:
- `sitemap.xml` — 12 صفحة
- `robots.txt` — يحجب الصفحات الداخلية

---

## معلومات المركز

- **الاسم:** هافركامب — Haverkamp Kuwait
- **العنوان:** الري، قطعة 1، شارع 19، الكويت
- **واتساب:** +965 5111 1154
- **أوقات العمل:** السبت – الخميس، 10 صباحاً – 8 مساءً
- **إحداثيات:** 29.3092865, 47.9444435
