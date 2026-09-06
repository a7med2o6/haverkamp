export interface WinnerRecord {
  name: string;
  prize?: string;
  time: string;
}

export type CelebrationStyle = 'fireworks' | 'golden_stars' | 'confetti' | 'none';
export type CelebrationDuration = '5000' | '10000' | '15000' | 'until_closed';
export type VictorySound = 'fanfare' | 'applause' | 'chimes';
export type WheelStyleMode = 'vibrant' | 'duotone' | 'pastel';

export interface WinnerDrawState {
  customers: string[];
  contestTitleCustomers: string;
  targetPrize: string;
  prizes: string[];
  prizeWeights: number[];
  contestTitlePrizes: string;
  isPrizeMode: boolean;
  duration: number; // in seconds
  rotations: number;
  autoRemove: boolean;
  styleMode: WheelStyleMode;
  celebrationStyle: CelebrationStyle;
  celebrationDuration: CelebrationDuration;
  victorySound: VictorySound;
}

export const PRESETS = {
  employees: [
    'أحمد علي',
    'محمد الإبراهيم',
    'عبدالله العتيبي',
    'سارة الكويتي',
    'فهد الشمري',
    'خالد المطيري',
    'فاطمة العنزي',
    'عمر الهاجري',
    'مريم الدوسري',
    'يوسف الكندري',
  ],
  numbers50: Array.from({ length: 50 }, (_, i) => `كوبون رقم ${i + 1001}`),
  prizes_default: [
    'عازل حراري كامل',
    'حماية نانو سيراميك',
    'تظليل زجاج أمامي',
    'غسيل داخلي شامل',
    'غسيل وتلميع خارجي',
    'عطر H1 الفاخر',
    'عطر H2 الفاخر',
    'ميدالية هافركامب',
    'خصم 10٪ على الحماية',
    'خصم 25٪ على العازل',
    'حظ سعيد المرة القادمة',
  ],
  prizes_discounts: [
    'خصم 50% على الحماية',
    'خصم 30% على العازل',
    'قسيمة شراء بقيمة 20 د.ك',
    'غسيل وتلميع مجاني',
    'تظليل حراري للجام الأمامي',
    'معطر سيارات فاخر',
  ],
};

export const DEFAULT_WINNER_DRAW_STATE: WinnerDrawState = {
  customers: [...PRESETS.employees],
  contestTitleCustomers: 'سحب عشوائي للعملاء',
  targetPrize: 'عازل حراري كامل',
  prizes: [...PRESETS.prizes_default],
  prizeWeights: PRESETS.prizes_default.map(() => 10),
  contestTitlePrizes: 'عجلة الجوائز الفورية',
  isPrizeMode: false,
  duration: 5,
  rotations: 8,
  autoRemove: false,
  styleMode: 'vibrant',
  celebrationStyle: 'fireworks',
  celebrationDuration: '10000',
  victorySound: 'fanfare',
};

export const STORAGE_KEYS = {
  STATE: 'haverkamp_winner_draw_state_v1',
  SESSION_WINNERS: 'haverkamp_winner_draw_session_winners_v1',
} as const;

export const BROADCAST_CHANNEL_NAME = 'haverkamp_win_kw_channel';

function cloneDefaultState(): WinnerDrawState {
  return {
    ...DEFAULT_WINNER_DRAW_STATE,
    customers: [...DEFAULT_WINNER_DRAW_STATE.customers],
    prizes: [...DEFAULT_WINNER_DRAW_STATE.prizes],
    prizeWeights: [...DEFAULT_WINNER_DRAW_STATE.prizeWeights],
  };
}

/**
 * Defensive normalizer for WinnerDrawState to prevent crashes from invalid or legacy storage.
 */
export function normalizeWinnerDrawState(raw: unknown): WinnerDrawState {
  if (!raw || typeof raw !== 'object') {
    return cloneDefaultState();
  }

  const obj = raw as Record<string, unknown>;

  const customers = Array.isArray(obj.customers)
    ? obj.customers.map((item) => String(item).trim()).filter(Boolean)
    : [...DEFAULT_WINNER_DRAW_STATE.customers];

  const prizes = Array.isArray(obj.prizes)
    ? obj.prizes.map((item) => String(item).trim()).filter(Boolean)
    : [...DEFAULT_WINNER_DRAW_STATE.prizes];

  // Defensive weight normalization matching prizes length
  const rawWeights = Array.isArray(obj.prizeWeights) ? obj.prizeWeights : [];
  const prizeWeights = prizes.map((_, i) => {
    const w = Number(rawWeights[i]);
    return !Number.isFinite(w) || w < 0 ? 10 : w;
  });

  const duration = typeof obj.duration === 'number' && Number.isFinite(obj.duration) && obj.duration >= 3 && obj.duration <= 30
    ? Math.round(obj.duration)
    : DEFAULT_WINNER_DRAW_STATE.duration;

  const rotations = typeof obj.rotations === 'number' && Number.isFinite(obj.rotations) && obj.rotations >= 3 && obj.rotations <= 20
    ? Math.round(obj.rotations)
    : DEFAULT_WINNER_DRAW_STATE.rotations;

  const styleMode: WheelStyleMode =
    obj.styleMode === 'duotone' || obj.styleMode === 'pastel' || obj.styleMode === 'vibrant'
      ? obj.styleMode
      : 'vibrant';

  const celebrationStyle: CelebrationStyle =
    obj.celebrationStyle === 'golden_stars' ||
    obj.celebrationStyle === 'confetti' ||
    obj.celebrationStyle === 'none' ||
    obj.celebrationStyle === 'fireworks'
      ? obj.celebrationStyle
      : 'fireworks';

  const celebrationDuration: CelebrationDuration =
    obj.celebrationDuration === '5000' ||
    obj.celebrationDuration === '15000' ||
    obj.celebrationDuration === 'until_closed' ||
    obj.celebrationDuration === '10000'
      ? obj.celebrationDuration
      : '10000';

  const victorySound: VictorySound =
    obj.victorySound === 'applause' || obj.victorySound === 'chimes' || obj.victorySound === 'fanfare'
      ? obj.victorySound
      : 'fanfare';

  return {
    customers,
    contestTitleCustomers: typeof obj.contestTitleCustomers === 'string' && obj.contestTitleCustomers.trim()
      ? obj.contestTitleCustomers
      : DEFAULT_WINNER_DRAW_STATE.contestTitleCustomers,
    targetPrize: typeof obj.targetPrize === 'string' ? obj.targetPrize : DEFAULT_WINNER_DRAW_STATE.targetPrize,
    prizes,
    prizeWeights,
    contestTitlePrizes: typeof obj.contestTitlePrizes === 'string' && obj.contestTitlePrizes.trim()
      ? obj.contestTitlePrizes
      : DEFAULT_WINNER_DRAW_STATE.contestTitlePrizes,
    isPrizeMode: typeof obj.isPrizeMode === 'boolean' ? obj.isPrizeMode : DEFAULT_WINNER_DRAW_STATE.isPrizeMode,
    duration,
    rotations,
    autoRemove: typeof obj.autoRemove === 'boolean' ? obj.autoRemove : DEFAULT_WINNER_DRAW_STATE.autoRemove,
    styleMode,
    celebrationStyle,
    celebrationDuration,
    victorySound,
  };
}

/**
 * Defensive normalizer for session winners history array.
 */
export function normalizeSessionWinners(raw: unknown): WinnerRecord[] {
  if (!Array.isArray(raw)) return [];
  const result: WinnerRecord[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      if (typeof rec.name === 'string' && rec.name.trim()) {
        result.push({
          name: rec.name.trim(),
          prize: typeof rec.prize === 'string' && rec.prize.trim() ? rec.prize.trim() : undefined,
          time: typeof rec.time === 'string' ? rec.time : '',
        });
      }
    }
  }
  return result;
}

/**
 * Defensive normalizer for timer personal best attempt difference.
 */
export function normalizeBestDiff(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

/** Returns an unbiased random integer in [0, upperBound) when Web Crypto is available. */
export function getRandomIndex(upperBound: number): number {
  if (!Number.isInteger(upperBound) || upperBound <= 0) return 0;

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const maxUint = 0x1_0000_0000;
    const limit = maxUint - (maxUint % upperBound);
    const buffer = new Uint32Array(1);
    do {
      crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);
    return buffer[0] % upperBound;
  }

  return Math.floor(Math.random() * upperBound);
}

function getRandomUnit(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] / 0x1_0000_0000;
  }
  return Math.random();
}

/**
 * Defensive weighted random selection.
 * Safely computes weighted random index bounded within [0, prizes.length - 1].
 */
export function getWeightedRandomIndex(prizes: string[], weights: number[]): number {
  if (!prizes || prizes.length === 0) return 0;

  const normalizedWeights = prizes.map((_, i) => {
    const w = weights && typeof weights[i] === 'number' ? weights[i] : 10;
    return !Number.isFinite(w) || w < 0 ? 10 : w;
  });

  const totalWeight = normalizedWeights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    return getRandomIndex(prizes.length);
  }

  let random = getRandomUnit() * totalWeight;
  for (let i = 0; i < normalizedWeights.length; i++) {
    random -= normalizedWeights[i];
    if (random <= 0) {
      return Math.min(i, prizes.length - 1);
    }
  }

  return prizes.length - 1;
}
