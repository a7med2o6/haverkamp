'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Trophy,
  Gift,
  ArrowRight,
  ArrowLeft,
  X,
  Users,
  Trash2,
} from 'lucide-react';
import type { Locale } from '@/lib/site-data';
import { soundManager } from '@/lib/winner-draw/sound';
import { WheelRenderer } from '@/lib/winner-draw/wheel-renderer';
import { generateWinnerCardImage } from '@/lib/winner-draw/card-generator';
import {
  type WinnerDrawState,
  type WinnerRecord,
  DEFAULT_WINNER_DRAW_STATE,
  STORAGE_KEYS,
  BROADCAST_CHANNEL_NAME,
  normalizeWinnerDrawState,
  normalizeSessionWinners,
  getRandomIndex,
  getWeightedRandomIndex,
} from '@/lib/winner-draw/types';

/**
 * Official Haverkamp German Geometric Emblem
 * Pure vector representation matching brand identity.
 */
function HaverkampEmblem({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 2048 2048"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Outer Square Frame with Cutout */}
      <path
        fillRule="evenodd"
        d="M335 168 H1713 V1546 H335 Z M612 445 V1269 H1436 V445 Z"
      />
      {/* Inner Solid Square */}
      <rect x="726" y="559" width="596" height="596" />
      {/* Bottom Stem */}
      <rect x="833" y="1546" width="383" height="334" />
    </svg>
  );
}

export function WinnerDrawPublicView({ locale }: { locale: Locale }) {
  const isRtl = locale === 'ar';
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelRef = useRef<WheelRenderer | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalDialogRef = useRef<HTMLDivElement | null>(null);
  const modalCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  // Deterministic hydration initializers
  const [state, setState] = useState<WinnerDrawState>(DEFAULT_WINNER_DRAW_STATE);
  const [sessionWinners, setSessionWinners] = useState<WinnerRecord[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWinnersDrawer, setShowWinnersDrawer] = useState(false);

  // Ref holding latest state for safe out-of-render access
  const stateRef = useRef<WinnerDrawState>(state);
  const sessionWinnersRef = useRef<WinnerRecord[]>(sessionWinners);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    sessionWinnersRef.current = sessionWinners;
  }, [sessionWinners]);

  // Winner Modal state
  const [activeWinner, setActiveWinner] = useState<{
    name: string;
    index: number;
    prize: string;
  } | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [timerRatio, setTimerRatio] = useState(1);

  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const celebrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const celebrationDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load and normalize storage safely on client
  const syncFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STATE);
      if (raw) {
        const parsed = normalizeWinnerDrawState(JSON.parse(raw));
        queueMicrotask(() => setState(parsed));
      }
      const rawWinners = localStorage.getItem(STORAGE_KEYS.SESSION_WINNERS);
      if (rawWinners) {
        const parsedWinners = normalizeSessionWinners(JSON.parse(rawWinners));
        queueMicrotask(() => {
          sessionWinnersRef.current = parsedWinners;
          setSessionWinners(parsedWinners);
        });
      }
    } catch (e) {
      console.warn('Error loading storage in winner draw public view:', e);
    }
  }, []);

  useEffect(() => {
    syncFromStorage();

    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'STATE_UPDATED') {
          syncFromStorage();
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.STATE || e.key === STORAGE_KEYS.SESSION_WINNERS) {
        syncFromStorage();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [syncFromStorage]);

  const closeWinnerModal = useCallback(() => {
    soundManager.stopSpinDrumroll();
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    if (animTimerRef.current) {
      clearInterval(animTimerRef.current);
      animTimerRef.current = null;
    }
    if (celebrationIntervalRef.current) {
      clearInterval(celebrationIntervalRef.current);
      celebrationIntervalRef.current = null;
    }
    if (celebrationDelayRef.current) {
      clearTimeout(celebrationDelayRef.current);
      celebrationDelayRef.current = null;
    }
    setShowWinnerModal(false);
    setActiveWinner(null);
  }, []);

  // Fire celebration respecting prefers-reduced-motion
  const fireCelebration = useCallback((customDuration?: number) => {
    if (typeof window === 'undefined' || !modalCanvasRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const currentState = stateRef.current;
    if (currentState.celebrationStyle === 'none') return;

    if (celebrationIntervalRef.current) {
      clearInterval(celebrationIntervalRef.current);
      celebrationIntervalRef.current = null;
    }

    const myConfetti = confetti.create(modalCanvasRef.current, {
      resize: true,
      useWorker: true,
      disableForReducedMotion: true,
    });

    const durationMs =
      customDuration ||
      (currentState.celebrationDuration === 'until_closed'
        ? 8000
        : Math.min(parseInt(currentState.celebrationDuration, 10), 8000));
    const animationEnd = Date.now() + durationMs;

    if (currentState.celebrationStyle === 'fireworks') {
      myConfetti({
        particleCount: 150,
        spread: 360,
        startVelocity: 55,
        origin: { x: 0.5, y: 0.4 },
        shapes: ['star', 'circle'],
        colors: ['#FBBF24', '#38BDF8', '#EC4899', '#10B981', '#F43F5E', '#FFFFFF'],
      });

      celebrationIntervalRef.current = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          if (celebrationIntervalRef.current) {
            clearInterval(celebrationIntervalRef.current);
            celebrationIntervalRef.current = null;
          }
          return;
        }

        myConfetti({
          particleCount: 18,
          angle: 60,
          spread: 80,
          origin: { x: 0, y: 0.75 },
          colors: ['#FBBF24', '#38BDF8', '#EC4899', '#10B981', '#FFFFFF'],
        });

        myConfetti({
          particleCount: 18,
          angle: 120,
          spread: 80,
          origin: { x: 1, y: 0.75 },
          colors: ['#FBBF24', '#38BDF8', '#EC4899', '#10B981', '#FFFFFF'],
        });
      }, 200);
    } else {
      myConfetti({
        particleCount: 160,
        spread: 120,
        startVelocity: 48,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#FBBF24', '#38BDF8', '#10B981', '#FFFFFF'],
      });
    }
  }, []);

  const excludeWinner = useCallback((winnerIndex: number) => {
    const currentState = stateRef.current;
    if (currentState.isPrizeMode) return;
    if (winnerIndex >= 0 && winnerIndex < currentState.customers.length) {
      const updatedCustomers = [...currentState.customers];
      updatedCustomers.splice(winnerIndex, 1);
      const newState = { ...currentState, customers: updatedCustomers };

      setState(newState);
      if (wheelRef.current) {
        wheelRef.current.setItems(updatedCustomers);
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(newState));
          if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
            channel.postMessage({ type: 'STATE_UPDATED' });
            channel.close();
          }
        } catch (e) {
          console.warn('Error saving state on excludeWinner:', e);
        }
      }
    }
  }, []);

  // Clean, pure handleWin callback executing side-effects outside state updaters
  const handleWin = useCallback(
    (winnerName: string, winnerIndex: number) => {
      setIsSpinning(false);

      const currentState = stateRef.current;
      const prize = currentState.isPrizeMode
        ? winnerName
        : currentState.targetPrize || (isRtl ? 'جائزة هافركامب' : 'Haverkamp Prize');

      setActiveWinner({ name: winnerName, index: winnerIndex, prize });

      if (!currentState.isPrizeMode) {
        const winnerRecord: WinnerRecord = {
          name: winnerName,
          prize,
          time: new Date().toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        const nextWinners = [winnerRecord, ...sessionWinnersRef.current];
        sessionWinnersRef.current = nextWinners;
        setSessionWinners(nextWinners);
        try {
          localStorage.setItem(STORAGE_KEYS.SESSION_WINNERS, JSON.stringify(nextWinners));
        } catch {}
      }

      soundManager.playWinFanfare(currentState.victorySound);
      setShowWinnerModal(true);

      if (celebrationDelayRef.current) clearTimeout(celebrationDelayRef.current);
      celebrationDelayRef.current = setTimeout(() => {
        fireCelebration();
        celebrationDelayRef.current = null;
      }, 50);

      if (currentState.celebrationDuration !== 'until_closed') {
        const displayDurationMs = parseInt(currentState.celebrationDuration, 10) || 10000;
        setTimerRatio(1);
        const startTime = Date.now();

        if (animTimerRef.current) clearInterval(animTimerRef.current);
        animTimerRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, 1 - elapsed / displayDurationMs);
          setTimerRatio(remaining);
        }, 50);

        if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = setTimeout(() => {
          if (currentState.autoRemove && !currentState.isPrizeMode) {
            excludeWinner(winnerIndex);
          }
          closeWinnerModal();
        }, displayDurationMs);
      }
    },
    [isRtl, fireCelebration, excludeWinner, closeWinnerModal]
  );

  useEffect(() => {
    if (!showWinnerModal) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = requestAnimationFrame(() => modalCloseBtnRef.current?.focus());

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeWinnerModal();
        return;
      }

      if (event.key !== 'Tab' || !modalDialogRef.current) return;
      const focusable = Array.from(
        modalDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleDialogKeyDown);
      previouslyFocused?.focus();
    };
  }, [showWinnerModal, closeWinnerModal]);

  const activeItems = state.isPrizeMode ? state.prizes : state.customers;
  const currentTitle = state.isPrizeMode
    ? state.contestTitlePrizes || (isRtl ? 'عجلة الجوائز الفورية' : 'Instant Prizes Wheel')
    : state.contestTitleCustomers || (isRtl ? 'سحب عشوائي للعملاء' : 'Customer Lucky Draw');

  // Initialize Canvas Wheel Renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    const wheel = new WheelRenderer(canvasRef.current, {
      items: activeItems,
      duration: state.duration * 1000,
      styleMode: state.styleMode,
      wheelFontSize: state.wheelFontSize,
      onWin: (winner, index) => handleWin(winner, index),
    });
    wheelRef.current = wheel;

    return () => {
      wheel.destroy();
      wheelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update wheel items/palette/duration/fontSize when state changes
  useEffect(() => {
    if (!wheelRef.current) return;
    wheelRef.current.setItems(activeItems);
    wheelRef.current.setStyleMode(state.styleMode);
    wheelRef.current.setWheelFontSize(state.wheelFontSize ?? 18);
    wheelRef.current.duration = state.duration * 1000;
  }, [activeItems, state.styleMode, state.duration, state.wheelFontSize]);

  // Fullscreen listener & cleanup
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      if (celebrationIntervalRef.current) clearInterval(celebrationIntervalRef.current);
      if (celebrationDelayRef.current) clearTimeout(celebrationDelayRef.current);
      soundManager.stopSpinDrumroll();
    };
  }, []);

  const toggleSound = () => {
    soundManager.playClick();
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const toggleFullscreen = () => {
    soundManager.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const spin = useCallback(() => {
    const currentState = stateRef.current;
    const items = currentState.isPrizeMode ? currentState.prizes : currentState.customers;
    if (!items.length || isSpinning || (wheelRef.current && wheelRef.current.isSpinning))
      return;

    setIsSpinning(true);
    soundManager.init();
    soundManager.startSpinDrumroll();

    if (!wheelRef.current) return;

    const targetIndex = currentState.isPrizeMode
      ? getWeightedRandomIndex(currentState.prizes, currentState.prizeWeights)
      : getRandomIndex(items.length);

    wheelRef.current.spinToWinner(targetIndex, currentState.rotations || 8);
  }, [isSpinning]);

  // Global Keyboard shortcut: Space or Enter triggers spin
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showWinnerModal || showWinnersDrawer) return;
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        spin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showWinnerModal, showWinnersDrawer, spin]);

  const handleClearWinners = () => {
    soundManager.playClick();
    sessionWinnersRef.current = [];
    setSessionWinners([]);
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSION_WINNERS);
    } catch {}
  };

  return (
    <div className="hk-game-view !min-h-[100dvh] !h-[100dvh] !max-h-[100dvh] w-full overflow-hidden flex flex-col justify-between bg-[#050912] text-white select-none relative">
      {/* Ambient Radial Lighting in Center Behind Wheel */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(94vw,94vh,700px)] h-[min(94vw,94vh,700px)] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12)_0%,rgba(14,34,61,0.06)_45%,transparent_70%)] pointer-events-none blur-3xl z-0"
        aria-hidden="true"
      />

      {/* Top Header HUD Bar */}
      <header className="h-16 px-4 sm:px-8 flex items-center justify-between border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-md z-30 shrink-0">
        {/* Back to Competitions Button */}
        <Link
          href={isRtl ? '/competitions' : '/en/competitions'}
          className="h-10 px-3.5 sm:px-4 rounded-xl bg-slate-900/90 border border-slate-700/70 hover:border-slate-500 hover:bg-slate-800/90 text-slate-200 hover:text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm group"
        >
          <ArrowIcon className="size-4 text-slate-400 group-hover:text-white transition-colors" />
          <span>{isRtl ? 'العودة للمسابقات' : 'Back to Competitions'}</span>
        </Link>

        {/* Center Mode / Target Prize Badge */}
        <div className="flex items-center gap-2 max-w-[50%] sm:max-w-[60%] overflow-hidden">
          <div className="h-10 px-4 sm:px-5 rounded-full bg-slate-900/95 border border-sky-500/35 text-sky-300 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(56,189,248,0.15)] truncate backdrop-blur-md">
            {state.isPrizeMode ? (
              <Gift className="size-4 text-amber-400 shrink-0" />
            ) : (
              <Trophy className="size-4 text-amber-400 shrink-0" />
            )}
            <span className="truncate">{currentTitle}</span>
            {!state.isPrizeMode && state.targetPrize && (
              <span className="text-amber-300 font-extrabold hidden md:inline shrink-0">
                • {isRtl ? 'الجائزة:' : 'Prize:'} {state.targetPrize}
              </span>
            )}
          </div>
        </div>

        {/* Controls: Winners Drawer + Sound + Fullscreen */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Winners Archive Trigger */}
          <button
            onClick={() => {
              soundManager.playClick();
              setShowWinnersDrawer(true);
            }}
            className="h-10 px-3 sm:px-3.5 rounded-xl bg-slate-900/90 border border-slate-700/70 hover:border-amber-500/60 hover:bg-slate-800/90 text-slate-200 hover:text-amber-300 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm group"
            aria-label={isRtl ? 'عرض سجل الفائزين' : 'View winners archive'}
            title={isRtl ? 'سجل الفائزين' : 'Winners History'}
          >
            <Trophy className="size-4 text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
            <span className="hidden sm:inline">{isRtl ? 'الفائزون' : 'Winners'}</span>
            {sessionWinners.length > 0 && (
              <span className="px-1.5 py-0.5 min-w-[20px] h-5 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black flex items-center justify-center leading-none">
                {sessionWinners.length}
              </span>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`size-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm ${
              isMuted
                ? 'bg-rose-500/15 border border-rose-500/50 text-rose-400 hover:bg-rose-500/25'
                : 'bg-slate-900/90 border border-slate-700/70 text-slate-300 hover:text-white hover:border-slate-500 hover:bg-slate-800/90'
            }`}
            aria-label={
              isMuted
                ? isRtl
                  ? 'تفعيل الصوت'
                  : 'Unmute sound'
                : isRtl
                ? 'كتم الصوت'
                : 'Mute sound'
            }
            title={isMuted ? (isRtl ? 'تشغيل الصوت' : 'Unmute') : (isRtl ? 'كتم الصوت' : 'Mute')}
          >
            {isMuted ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="size-10 rounded-xl bg-slate-900/90 border border-slate-700/70 hover:border-slate-500 hover:bg-slate-800/90 text-slate-300 hover:text-white flex items-center justify-center transition-all active:scale-95 shadow-sm"
            aria-label={
              isFullscreen
                ? isRtl
                  ? 'إنهاء ملء الشاشة'
                  : 'Exit fullscreen'
                : isRtl
                ? 'ملء الشاشة'
                : 'Fullscreen'
            }
            title={isFullscreen ? (isRtl ? 'إنهاء ملء الشاشة' : 'Exit Fullscreen') : (isRtl ? 'ملء الشاشة' : 'Fullscreen')}
          >
            {isFullscreen ? (
              <Minimize2 className="size-4.5" />
            ) : (
              <Maximize2 className="size-4.5" />
            )}
          </button>
        </div>
      </header>

      {/* Main Wheel Center Stage (100% Mathematically Centered Across All Viewports) */}
      <main className="flex-1 w-full flex items-center justify-center relative p-2 sm:p-4 overflow-hidden z-10">
        <div className="relative w-[min(88vw,calc(100dvh-135px),580px)] h-[min(88vw,calc(100dvh-135px),580px)] flex items-center justify-center">
          {/* Wheel Canvas */}
          <canvas
            ref={canvasRef}
            className="rounded-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] transition-transform"
            role="img"
            aria-label={isRtl ? 'عجلة السحب التفاعلية' : 'Interactive draw wheel'}
          />

          {/* The Haverkamp Brand Center Hub Spin Button */}
          <button
            type="button"
            onClick={spin}
            disabled={isSpinning || !activeItems.length}
            aria-label={
              isSpinning
                ? isRtl
                  ? 'جاري السحب...'
                  : 'Drawing winner...'
                : isRtl
                ? 'اضغط لبدء السحب'
                : 'Click to spin wheel'
            }
            title={
              !activeItems.length
                ? isRtl
                  ? 'لا توجد عناصر مسجلة'
                  : 'No registered items'
                : isRtl
                ? 'انقر لبدء السحب'
                : 'Click to start spin'
            }
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 
              w-[27%] h-[27%] rounded-full select-none
              flex items-center justify-center
              transition-all duration-200
              border border-white/20
              bg-gradient-to-b from-[#0e1f38] via-[#081324] to-[#040a14]
              shadow-[0_10px_35px_rgba(0,0,0,0.85),inset_0_2px_8px_rgba(255,255,255,0.15)]
              ${
                isSpinning
                  ? 'cursor-not-allowed scale-95 shadow-[0_0_30px_rgba(56,189,248,0.5)] border-sky-400/80'
                  : activeItems.length
                  ? 'cursor-pointer hover:scale-105 active:scale-95 hover:border-white/50 hover:shadow-[0_0_30px_rgba(56,189,248,0.35)] group'
                  : 'opacity-60 cursor-not-allowed'
              }`}
          >
            {/* Outer Spinning Energy Halo during spin */}
            {isSpinning && (
              <span
                className="absolute inset-[-4px] rounded-full border-2 border-transparent border-t-sky-400 border-r-white/80 animate-spin"
                aria-hidden="true"
              />
            )}

            {/* Subtle Idle Breathing Aura */}
            {!isSpinning && activeItems.length > 0 && (
              <span
                className="absolute inset-[-5px] rounded-full border border-sky-400/20 group-hover:border-sky-400/40 animate-pulse pointer-events-none"
                aria-hidden="true"
              />
            )}

            {/* Haverkamp Brand Emblem Only (Pure White, Enlarged, Centered, No Words) */}
            <div className="relative flex items-center justify-center w-[64%] h-[64%] pointer-events-none">
              <HaverkampEmblem className="w-full h-full text-white fill-current filter drop-shadow-[0_2px_14px_rgba(255,255,255,0.65)] transition-transform duration-200 group-hover:scale-110" />
            </div>
          </button>
        </div>
      </main>

      {/* Bottom Minimal HUD Bar */}
      <footer className="h-11 sm:h-12 px-4 sm:px-8 flex items-center justify-between border-t border-slate-800/40 bg-slate-950/60 backdrop-blur-md z-20 text-xs text-slate-400 shrink-0">
        {/* Items Counter */}
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <Users className="size-3.5 text-sky-400" />
          <span>{isRtl ? 'عدد المسجلين:' : 'Participants:'}</span>
          <span className="font-mono text-white font-bold">{activeItems.length}</span>
        </div>

        {/* Keyboard Quick Tip (Desktop) */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400">
          <span>{isRtl ? 'يمكنك الضغط على شعار هافركامب أو زر' : 'Click the logo or press'}</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-amber-300 shadow-sm">
            Space
          </kbd>
          <span>{isRtl ? 'للسحب' : 'to spin'}</span>
        </div>

        {/* Recent Winner Link or Brand Tag */}
        <div>
          {sessionWinners.length > 0 ? (
            <button
              onClick={() => {
                soundManager.playClick();
                setShowWinnersDrawer(true);
              }}
              className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-semibold transition-colors"
            >
              <Trophy className="size-3.5 text-amber-400" />
              <span className="hidden sm:inline">{isRtl ? 'آخر فائز:' : 'Latest:'}</span>
              <span className="font-bold underline decoration-amber-400/50 underline-offset-2">
                {sessionWinners[0].name}
              </span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">
              {isRtl ? 'هافركامب الكويت' : 'Haverkamp Kuwait'}
            </span>
          )}
        </div>
      </footer>

      {/* Floating Session Winners Drawer */}
      {showWinnersDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowWinnersDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[85vh] sm:rounded-3xl bg-[#0a1424] border border-slate-800 shadow-2xl flex flex-col p-6 overflow-hidden"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Trophy className="size-5 text-amber-400" />
                <span>{isRtl ? 'سجل فائزو الجلسة' : 'Session Winners History'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                  {sessionWinners.length}
                </span>
              </div>
              <button
                onClick={() => setShowWinnersDrawer(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                aria-label={isRtl ? 'إغلاق السجل' : 'Close history'}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2.5 max-h-[60vh]">
              {sessionWinners.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-12">
                  {isRtl ? 'لم يتم إجراء أي سحب بعد في هذه الجلسة' : 'No winners yet in this session'}
                </p>
              ) : (
                sessionWinners.map((w, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                        #{sessionWinners.length - idx}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-white">{w.name}</div>
                        {w.prize && <div className="text-xs text-amber-300/90">{w.prize}</div>}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 shrink-0">{w.time}</div>
                  </div>
                ))
              )}
            </div>

            {sessionWinners.length > 0 && (
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  onClick={handleClearWinners}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 py-2 px-3 rounded-xl hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  <span>{isRtl ? 'مسح السجل' : 'Clear History'}</span>
                </button>
                <button
                  onClick={() => setShowWinnersDrawer(false)}
                  className="text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 py-2 px-4 rounded-xl transition-colors"
                >
                  {isRtl ? 'إغلاق' : 'Close'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Winner Celebration Modal (Exact Replica of Reference Design Image 2) */}
      {showWinnerModal && activeWinner && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="winner-card-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeWinnerModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <canvas
            ref={modalCanvasRef}
            className="fixed inset-0 pointer-events-none w-full h-full"
          />

          {/* Winner Card Container (Tall Portrait matching reference design) */}
          <div
            ref={modalDialogRef}
            onClick={(e) => e.stopPropagation()}
            style={{ paddingTop: '32px', paddingBottom: '68px' }}
            className="relative w-[min(92vw,500px)] h-[min(92vh,780px)] my-auto bg-[#0a101d] border-2 border-[#b8860b]/85 rounded-[2.5rem] sm:rounded-[3rem] px-5 sm:px-8 text-center shadow-[0_0_80px_rgba(184,134,11,0.25),0_30px_90px_rgba(0,0,0,0.95)] z-10 flex flex-col justify-between items-center cursor-default overflow-hidden"
          >
            {/* Circular Close Button (Top-Left in Reference Design) */}
            <button
              ref={modalCloseBtnRef}
              onClick={closeWinnerModal}
              className="absolute top-5 left-5 sm:top-6 sm:left-6 w-11 h-11 rounded-full border-2 border-[#38bdf8] bg-[#0c1527] text-[#38bdf8] flex items-center justify-center hover:bg-[#131f38] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg z-20"
              aria-label={isRtl ? 'إغلاق النافذة' : 'Close window'}
            >
              <X className="size-5 text-[#38bdf8] stroke-[2.5]" />
            </button>

            {/* 1. TOP HEADER: 3D Gold Trophy + Title + Emoji */}
            <div className="flex flex-col items-center w-full">
              <div className="flex items-center justify-center pointer-events-none">
                <img
                  src="/assets/trophy-3d.png"
                  alt="Trophy"
                  className="h-32 sm:h-36 md:h-40 w-auto object-contain drop-shadow-[0_12px_28px_rgba(251,191,36,0.4)] pointer-events-none select-none"
                />
              </div>

              <h3
                id="winner-card-title"
                className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug px-2 mt-2 mb-1"
              >
                {state.isPrizeMode
                  ? isRtl
                    ? currentTitle
                      ? `مبارك الجائزة بـ ${currentTitle}!`
                      : 'مبارك الجائزة بـ عجلة الجوائز الفورية!'
                    : 'Congratulations on the Instant Prize Wheel!'
                  : isRtl
                  ? currentTitle
                    ? `مبارك الفائز بـ ${currentTitle}!`
                    : 'مبارك الفائز بـ عجلة الجوائز الفورية!'
                  : 'Congratulations on the Lucky Draw!'}
              </h3>

              <div className="text-2xl sm:text-3xl my-0.5" aria-hidden="true">
                🎉
              </div>
            </div>

            {/* 2. WINNER NAME / PRIZE */}
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-[#FACC15] drop-shadow-[0_2px_16px_rgba(250,204,21,0.55)] leading-tight px-1 break-words max-w-full">
              {activeWinner.name}
            </div>

            {/* 3. PRIZE PILL BADGE */}
            <div className="inline-flex items-center justify-center px-6 sm:px-7 py-2 sm:py-2.5 rounded-full bg-[#1c150e] border border-[#b8860b]/75 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] max-w-[90%]">
              <span className="text-[#FACC15] text-sm sm:text-base md:text-lg font-bold truncate">
                {state.isPrizeMode
                  ? isRtl
                    ? '🎁 جائزة فورية معتمدة من هافركامب'
                    : '🎁 Haverkamp Certified Instant Prize'
                  : isRtl
                  ? `🎁 الجائزة: ${activeWinner.prize || 'جائزة هافركامب'}`
                  : `🎁 Prize: ${activeWinner.prize || 'Haverkamp Prize'}`}
              </span>
            </div>

            {/* 4. HINT TEXT & TIMER BAR */}
            <div className="flex flex-col items-center gap-2 w-full">
              <p className="text-xs sm:text-sm text-slate-300 font-normal tracking-wide">
                {isRtl
                  ? 'اضغط في أي مكان أو على أي خيار لإغلاق النافذة'
                  : 'Click anywhere or select an option to close window'}
              </p>

              <div className="w-4/5 max-w-xs mx-auto h-2 bg-slate-800/90 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-transform duration-75 origin-left"
                  style={{
                    transform: `scaleX(${
                      state.celebrationDuration !== 'until_closed' ? timerRatio : 1
                    })`,
                  }}
                />
              </div>
            </div>

            {/* 5. BUTTONS SECTION: Download Button + Two Action Buttons Row */}
            <div className="w-full max-w-[410px] mx-auto flex flex-col gap-2.5 sm:gap-3">
              {/* Full Width Download Button */}
              <button
                type="button"
                onClick={() =>
                  generateWinnerCardImage(
                    activeWinner.name,
                    currentTitle,
                    activeWinner.prize,
                    state.isPrizeMode
                  )
                }
                className="w-full py-3 px-4 rounded-xl sm:rounded-2xl border border-[#b8860b]/75 bg-[#151b27]/90 hover:bg-[#1e2638] active:scale-[0.98] text-[#FACC15] font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <span>
                  {isRtl
                    ? 'تحميل بطاقة الفوز (لإنستغرام وواتساب)'
                    : 'Download Winner Card (Instagram & WhatsApp)'}
                </span>
                <span className="text-base sm:text-lg">📸</span>
              </button>

              {/* Two Action Buttons Row: Left Green, Right Burgundy */}
              <div className="flex items-center gap-2.5 sm:gap-3 w-full" dir="ltr">
                {/* Left: Green Button */}
                <button
                  type="button"
                  onClick={closeWinnerModal}
                  className="flex-1 py-3 px-3 rounded-xl sm:rounded-2xl bg-[#059669] hover:bg-[#047857] active:scale-95 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <span>
                    {isRtl
                      ? state.isPrizeMode
                        ? 'متابعة'
                        : 'إبقاء الفائز'
                      : 'Keep Winner'}
                  </span>
                  <span className="text-base sm:text-lg">✅</span>
                </button>

                {/* Right: Dark Burgundy / Red Button */}
                {!state.isPrizeMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      excludeWinner(activeWinner.index);
                      closeWinnerModal();
                    }}
                    className="flex-1 py-3 px-3 rounded-xl sm:rounded-2xl bg-[#2a131b] hover:bg-[#381a24] border border-[#e11d48]/50 active:scale-95 text-[#fb7185] hover:text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <span>{isRtl ? 'استبعاد الفائز' : 'Exclude Winner'}</span>
                    <span className="text-base sm:text-lg">❌</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeWinnerModal}
                    className="flex-1 py-3 px-3 rounded-xl sm:rounded-2xl bg-[#2a131b] hover:bg-[#381a24] border border-[#e11d48]/50 active:scale-95 text-[#fb7185] hover:text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <span>{isRtl ? 'إغلاق النافذة' : 'Close Window'}</span>
                    <span className="text-base sm:text-lg">❌</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

