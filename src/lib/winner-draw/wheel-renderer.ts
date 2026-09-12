import { soundManager } from './sound';
import { fitWheelLabel, type WheelLabelLayout } from './label-geometry';

export interface WheelColor {
  bg: string;
  text: string;
}

export const PALETTES: Record<string, WheelColor[]> = {
  vibrant: [
    { bg: '#E11D48', text: '#FFFFFF' }, // Crimson Red
    { bg: '#2563EB', text: '#FFFFFF' }, // Royal Blue
    { bg: '#059669', text: '#FFFFFF' }, // Emerald Green
    { bg: '#D97706', text: '#FFFFFF' }, // Warm Amber
    { bg: '#7C3AED', text: '#FFFFFF' }, // Amethyst Purple
    { bg: '#0891B2', text: '#FFFFFF' }, // Deep Turquoise
    { bg: '#DB2777', text: '#FFFFFF' }, // Rose Pink
    { bg: '#4F46E5', text: '#FFFFFF' }, // Indigo
  ],
  duotone: [
    { bg: '#0F172A', text: '#38BDF8' }, // Dark Slate
    { bg: '#1E293B', text: '#F8FAFC' }, // Navy Slate
    { bg: '#334155', text: '#38BDF8' }, // Medium Slate
    { bg: '#475569', text: '#F8FAFC' }, // Light Slate
  ],
  pastel: [
    { bg: '#F43F5E', text: '#FFFFFF' }, // Soft Rose
    { bg: '#10B981', text: '#FFFFFF' }, // Soft Emerald
    { bg: '#3B82F6', text: '#FFFFFF' }, // Soft Blue
    { bg: '#F59E0B', text: '#FFFFFF' }, // Soft Amber
    { bg: '#8B5CF6', text: '#FFFFFF' }, // Soft Violet
  ],
};

export interface WheelRendererOptions {
  items?: string[];
  duration?: number; // ms
  styleMode?: string;
  wheelFontSize?: number;
  onWin?: (winner: string, index: number) => void;
  onTick?: () => void;
}

const TAU = Math.PI * 2;

export class WheelRenderer {
  public canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public items: string[];
  private palette: WheelColor[];
  private styleMode: string;
  public wheelFontSize: number;

  public currentAngle = 0;
  public isSpinning = false;
  public duration: number;

  private pointerDeflection = 0;
  private pointerElasticity = 0.22;
  private pointerDamping = 0.78;

  private onWin: (winner: string, index: number) => void;
  private onTick: () => void;

  private lastSectorIndex = -1;
  private animId: number | null = null;
  private colorMap: number[] = [];
  /*
    تخطيط الأسماء لا يتغيّر بالدوران: يتبع النصّ ومقاس العجلة وحجم الخط
    وحدها. وحسابه في كل إطارٍ يعني ضبط ctx.font عشرات المرّات لكل جائزة
    ستّين مرّة في الثانية — وضبط الخط أغلى ما في الرسم. فيُحسب مرّة
    ويُحفظ ببصمة مدخلاته، ويُعاد حسابه حين تتغيّر.
  */
  private labelCache: { sig: string; layouts: WheelLabelLayout[] } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private displaySize = 300;
  private center = 150;
  private radius = 130;

  constructor(canvas: HTMLCanvasElement, options: WheelRendererOptions = {}) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2d context not supported');
    }
    this.ctx = context;
    this.items = options.items || [];
    this.styleMode = options.styleMode || 'vibrant';
    this.palette = PALETTES[this.styleMode] || PALETTES.vibrant;
    this.wheelFontSize = typeof options.wheelFontSize === 'number' && Number.isFinite(options.wheelFontSize) ? options.wheelFontSize : 18;
    this.duration = options.duration || 5000;
    this.onWin = options.onWin || (() => {});
    this.onTick = options.onTick || (() => {});

    this.colorMap = this.buildColorMap(this.items.length, this.palette);
    this.initResizeObserver();
  }

  private initResizeObserver() {
    this.resize();
    if (typeof window !== 'undefined' && window.ResizeObserver && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  }

  public destroy() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  public setItems(items: string[]) {
    this.items = items;
    this.colorMap = this.buildColorMap(items.length, this.palette);
    this.draw();
  }

  private buildColorMap(count: number, palette: WheelColor[]): number[] {
    if (count === 0) return [];
    const n = palette.length;
    const map = new Array<number>(count);

    for (let i = 0; i < count; i++) {
      const stride = n <= 2 ? 1 : Math.ceil(n / 2);
      let candidate = (i * stride) % n;

      if (i > 0 && candidate === map[i - 1]) {
        candidate = (candidate + 1) % n;
      }
      if (i === count - 1 && count > 2 && candidate === map[0]) {
        candidate = (candidate + 1) % n;
        if (candidate === map[i - 1]) candidate = (candidate + 1) % n;
      }

      map[i] = candidate;
    }
    return map;
  }

  public setStyleMode(mode: string) {
    this.styleMode = mode;
    this.palette = PALETTES[mode] || PALETTES.vibrant;
    this.colorMap = this.buildColorMap(this.items.length, this.palette);
    this.draw();
  }

  public setWheelFontSize(size: number) {
    if (typeof size === 'number' && Number.isFinite(size) && size >= 10 && size <= 32) {
      this.wheelFontSize = size;
      this.draw();
    }
  }

  public resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const availableWidth = rect.width || 300;
    const availableHeight = rect.height || 300;

    const size = Math.max(120, Math.floor(Math.min(availableWidth, availableHeight)));
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.displaySize = size;
    this.center = size / 2;
    this.radius = size / 2 - Math.max(18, size * 0.045);

    this.colorMap = this.buildColorMap(this.items.length, this.palette);
    this.draw();
  }

  public draw() {
    const { ctx, center, radius, displaySize, items, currentAngle, palette } = this;
    if (!items.length) {
      this.drawEmptyState();
      return;
    }

    ctx.clearRect(0, 0, displaySize, displaySize);

    // 1. Outer Rim
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.lineWidth = Math.max(4, displaySize * 0.012);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();

    const sliceAngle = (Math.PI * 2) / items.length;

    // 2. Color Slices
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(currentAngle);

    items.forEach((item, index) => {
      const startAngle = index * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const colorIdx =
        this.colorMap && this.colorMap.length === items.length
          ? this.colorMap[index]
          : index % palette.length;
      const colorObj = palette[colorIdx];

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = colorObj.bg;
      ctx.fill();

      ctx.lineWidth = Math.max(1.8, displaySize * 0.0045);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.stroke();

      // Rim Bulb Pin
      const dotX = Math.cos(startAngle) * (radius - 7);
      const dotY = Math.sin(startAngle) * (radius - 7);
      ctx.beginPath();
      ctx.arc(dotX, dotY, Math.max(3, displaySize * 0.007), 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

    });

    ctx.restore();

    /*
      3. الأسماء على أضلاع القطاعات.

      النصّ الأفقي كان يأخذ أقصر بُعدَي القطاع — وترَه — ويهدر طوله
      الشعاعي، فيتكرمش الاسم في سطرين ويُقصّ. وبعجلة ذات اثنتي عشرة
      جائزة يبلغ الوتر نحو خُمسِ نصف القطر، والطول الشعاعي نحو ثلاثة
      أخماسه: ثلاثة أضعافٍ تُهدر.

      فيُكتب النصّ على ضلع القطاع: طولُه للحروف، ووترُه لارتفاع أسطره.
      ويُقلب مئةً وثمانين حين يقع القطاع في النصف الأيسر، فلا يُقرأ
      اسمٌ مقلوباً رأساً على عقب.
    */
    const hubRadius = Math.max(24, Math.round(radius * 0.22));
    const innerRadius = hubRadius + Math.max(8, displaySize * 0.018);
    const outerRadius = radius - Math.max(12, displaySize * 0.03);
    const midRadius = (innerRadius + outerRadius) / 2;
    const sliceChordWidth = 2 * midRadius * Math.sin(sliceAngle / 2);
    // الطول الشعاعي هو مدى الحروف الآن، والوتر هو ما يتّسع له ارتفاع الأسطر
    const maxLabelWidth = (outerRadius - innerRadius) * 0.92;
    const maxTransverseHeight = sliceChordWidth * 0.82;
    const baseFont =
      typeof this.wheelFontSize === 'number' && Number.isFinite(this.wheelFontSize)
        ? Math.max(10, Math.min(32, this.wheelFontSize))
        : 18;
    const scale = Math.min(1.35, displaySize / 480);
    const preferredFontSize = Math.max(8, Math.round(baseFont * scale));
    const minFontSize = Math.max(7, Math.round(8 * scale));

    const sig = `${maxLabelWidth}|${maxTransverseHeight}|${preferredFontSize}|${minFontSize}|${items.join('\u0000')}`;
    if (!this.labelCache || this.labelCache.sig !== sig) {
      const measure = (str: string, fSize: number) => {
        ctx.font = `800 ${fSize}px "IBM Plex Sans Arabic", "Tajawal", "Readex Pro", sans-serif`;
        return ctx.measureText(str).width;
      };
      this.labelCache = {
        sig,
        layouts: items.map((item) =>
          fitWheelLabel(
            measure,
            item,
            maxLabelWidth,
            maxTransverseHeight,
            preferredFontSize,
            minFontSize
          )
        ),
      };
    }
    const layouts = this.labelCache.layouts;

    items.forEach((item, index) => {
      const colorIdx =
        this.colorMap && this.colorMap.length === items.length
          ? this.colorMap[index]
          : index % palette.length;
      const colorObj = palette[colorIdx];
      const screenAngle = index * sliceAngle + sliceAngle / 2 + currentAngle;

      ctx.save();
      const layout = layouts[index];

      ctx.translate(center, center);
      ctx.rotate(screenAngle);
      ctx.translate(midRadius, 0);
      // النصف الأيسر يُقرأ مقلوباً لولا القلب — والزاوية تُردّ إلى دورة واحدة أولاً
      const turn = ((screenAngle % TAU) + TAU) % TAU;
      if (turn > Math.PI / 2 && turn < (3 * Math.PI) / 2) {
        ctx.rotate(Math.PI);
      }

      ctx.font = `800 ${layout.fontSize}px "IBM Plex Sans Arabic", "Tajawal", "Readex Pro", sans-serif`;
      ctx.fillStyle = colorObj.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = /[\u0600-\u06ff]/.test(item) ? 'rtl' : 'ltr';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.68)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;

      const totalHeight = (layout.lines.length - 1) * layout.lineHeight;
      layout.lines.forEach((line, lineIdx) => {
        ctx.fillText(line, 0, -totalHeight / 2 + lineIdx * layout.lineHeight);
      });
      ctx.restore();
    });

    // 4. Center Hub Socket (Clean Dark Luxury Framing for the Haverkamp Logo button)
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, hubRadius + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#081220';
    ctx.fill();

    // Outer sleek dark rim (no gold color)
    ctx.lineWidth = Math.max(2.5, displaySize * 0.007);
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // Subtle soft white accent ring
    ctx.beginPath();
    ctx.arc(center, center, hubRadius, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.stroke();
    ctx.restore();

    // 5. Pointer Arrow
    this.drawPointer();
  }

  private drawPointer() {
    const { ctx, center, displaySize } = this;
    const pointerTopY = Math.max(4, displaySize * 0.015);
    const pointerHeight = Math.max(36, displaySize * 0.095);
    const pointerWidth = Math.max(26, displaySize * 0.065);

    ctx.save();
    ctx.translate(center, pointerTopY);
    ctx.rotate(this.pointerDeflection);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.moveTo(0, pointerHeight);
    ctx.lineTo(-pointerWidth / 2, 0);
    ctx.lineTo(pointerWidth / 2, 0);
    ctx.closePath();

    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pointerHeight - 8);
    ctx.lineTo(-pointerWidth / 4, 4);
    ctx.lineTo(pointerWidth / 4, 4);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, Math.max(4.5, displaySize * 0.014), 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    ctx.restore();
  }

  private drawEmptyState() {
    const { ctx, center, displaySize } = this;
    ctx.clearRect(0, 0, displaySize, displaySize);

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    const fontSize = Math.max(14, displaySize * 0.035);
    ctx.font = `bold ${fontSize}px "Tajawal", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('أدخل الأسماء للبدء في القرعة', center, center);
    ctx.restore();
  }

  public spinToWinner(targetIndex: number, totalRounds = 8) {
    if (this.isSpinning || !this.items.length) return;

    this.isSpinning = true;
    soundManager.playSpinStart();
    const sliceAngle = (Math.PI * 2) / this.items.length;

    const targetSectorCenter = targetIndex * sliceAngle + sliceAngle / 2;
    const jitter = (Math.random() - 0.5) * (sliceAngle * 0.7);
    const finalAngle = Math.PI * 1.5 - targetSectorCenter + jitter;

    const fullRotations = Math.PI * 2 * totalRounds;

    const normalizedCurrent = this.currentAngle % (Math.PI * 2);
    let totalTargetAngle = this.currentAngle + fullRotations + (finalAngle - normalizedCurrent);
    if (totalTargetAngle <= this.currentAngle) {
      totalTargetAngle += Math.PI * 2;
    }

    const startTime = performance.now();
    const startAngle = this.currentAngle;
    const targetDistance = totalTargetAngle - startAngle;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / this.duration, 1);

      const easeOut = 1 - Math.pow(1 - progress, 5);

      this.currentAngle = startAngle + targetDistance * easeOut;
      const speedRatio = 1 - progress;

      this.checkSectorCrossing(speedRatio);
      this.updatePointerPhysics();
      this.draw();

      if (progress < 1) {
        this.animId = requestAnimationFrame(animate);
      } else {
        this.isSpinning = false;
        this.currentAngle = totalTargetAngle;
        this.draw();
        this.onWin(this.items[targetIndex], targetIndex);
      }
    };

    this.animId = requestAnimationFrame(animate);
  }

  private checkSectorCrossing(speedRatio: number) {
    if (!this.items.length) return;
    const sliceAngle = (Math.PI * 2) / this.items.length;

    const pointerAngle = (Math.PI * 1.5 - this.currentAngle) % (Math.PI * 2);
    const positivePointerAngle = (pointerAngle + Math.PI * 2) % (Math.PI * 2);

    const currentSector = Math.floor(positivePointerAngle / sliceAngle);

    if (currentSector !== this.lastSectorIndex) {
      if (this.lastSectorIndex !== -1) {
        soundManager.playTick(speedRatio);
        this.pointerDeflection = 0.32 * Math.min(speedRatio + 0.2, 1);
        this.onTick();
      }
      this.lastSectorIndex = currentSector;
    }
  }

  private updatePointerPhysics() {
    const force = -this.pointerElasticity * this.pointerDeflection;
    this.pointerDeflection += force;
    this.pointerDeflection *= this.pointerDamping;
  }
}
