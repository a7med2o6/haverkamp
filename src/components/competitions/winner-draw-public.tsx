'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  Sparkles,
  Camera,
  CheckCircle2,
  UserMinus,
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
      customDuration ??
      (currentState.celebrationDuration === 'until_closed'
        ? 10000
        : Math.min(parseInt(currentState.celebrationDuration, 10) || 10000, 12000));
    const animationEnd = Date.now() + durationMs;
    const brandColors = ['#FBBF24', '#FDE68A', '#38BDF8', '#0EA5E9', '#FFFFFF'];
    const celebrationColors = [...brandColors, '#EC4899', '#10B981', '#F43F5E'];

    const repeatUntilEnd = (effect: () => void, cadence: number) => {
      celebrationIntervalRef.current = setInterval(() => {
        if (Date.now() >= animationEnd) {
          if (celebrationIntervalRef.current) {
            clearInterval(celebrationIntervalRef.current);
            celebrationIntervalRef.current = null;
          }
          return;
        }
        effect();
      }, cadence);
    };

    if (currentState.celebrationStyle === 'fireworks') {
      const launchFirework = (x = 0.18 + Math.random() * 0.64) => {
        myConfetti({
          particleCount: 44,
          spread: 360,
          startVelocity: 34,
          gravity: 0.82,
          decay: 0.92,
          ticks: 170,
          scalar: 0.92,
          origin: { x, y: 0.2 + Math.random() * 0.22 },
          shapes: ['star', 'circle'],
          colors: celebrationColors,
        });
      };

      launchFirework(0.26);
      launchFirework(0.5);
      launchFirework(0.74);
      repeatUntilEnd(() => launchFirework(), 520);
    } else if (currentState.celebrationStyle === 'golden_stars') {
      myConfetti({
        particleCount: 90,
        spread: 115,
        startVelocity: 38,
        gravity: 0.72,
        decay: 0.94,
        ticks: 210,
        scalar: 1.15,
        origin: { x: 0.5, y: 0.35 },
        shapes: ['star'],
        colors: ['#F59E0B', '#FBBF24', '#FDE68A', '#FFFFFF'],
      });

      repeatUntilEnd(() => {
        myConfetti({
          particleCount: 10,
          angle: 270,
          spread: 65,
          startVelocity: 8,
          gravity: 0.45,
          drift: (Math.random() - 0.5) * 0.8,
          ticks: 240,
          scalar: 0.9 + Math.random() * 0.35,
          origin: { x: 0.1 + Math.random() * 0.8, y: -0.04 },
          shapes: ['star'],
          colors: ['#F59E0B', '#FBBF24', '#FDE68A', '#FFFFFF'],
        });
      }, 320);
    } else {
      const fireSideCannon = (fromLeft: boolean) => {
        myConfetti({
          particleCount: 58,
          angle: fromLeft ? 56 : 124,
          spread: 68,
          startVelocity: 48,
          gravity: 0.88,
          decay: 0.93,
          ticks: 190,
          scalar: 0.98,
          origin: { x: fromLeft ? 0.04 : 0.96, y: 0.76 },
          colors: celebrationColors,
        });
      };

      fireSideCannon(true);
      fireSideCannon(false);
      repeatUntilEnd(() => {
        fireSideCannon(Math.random() > 0.5);
      }, 720);
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
    <div className="hk-game-view min-h-dvh w-full overflow-x-hidden overflow-y-auto flex flex-col justify-between bg-[#050912] text-white select-none relative">
      {/* Hide floating WhatsApp widget on dedicated winner draw page */}
      <style>{`.wa-float { display: none !important; }`}</style>

      {/* Ambient Radial Lighting in Center Behind Wheel */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(94vw,94vh,700px)] h-[min(94vw,94vh,700px)] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12)_0%,rgba(14,34,61,0.06)_45%,transparent_70%)] pointer-events-none blur-3xl z-0"
        aria-hidden="true"
      />

      {/* Top Header HUD Bar */}
      <header className="hk-draw-toolbar min-h-[68px] grid grid-cols-[minmax(44px,1fr)_auto_minmax(132px,1fr)] items-center gap-2 sm:gap-4 border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-md z-30 shrink-0">
        {/* Back to Competitions Button */}
        <Link
          href={isRtl ? '/competitions' : '/en/competitions'}
          aria-label={isRtl ? 'العودة للمسابقات' : 'Back to Competitions'}
          className="hk-draw-back justify-self-start inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/55 text-xs font-bold text-slate-300 transition-[color,background-color,border-color,transform] hover:border-slate-500 hover:bg-slate-800/90 hover:text-white active:scale-[0.97] sm:text-sm"
        >
          <ArrowIcon className="size-4 shrink-0" />
          <span className="hidden md:inline">
            {isRtl ? 'العودة للمسابقات' : 'Back to Competitions'}
          </span>
        </Link>

        {/* Center Mode / Target Prize Heading */}
        <div className="min-w-0 justify-self-center overflow-hidden text-center sm:max-w-[48vw]">
          <h1 className="my-0 flex w-full min-w-0 items-center justify-center gap-2 text-sm font-extrabold text-white sm:text-base">
            {state.isPrizeMode ? (
              <Gift className="size-4.5 shrink-0 text-amber-400" />
            ) : (
              <Trophy className="size-4.5 shrink-0 text-amber-400" />
            )}
            <span className="hidden min-w-0 truncate sm:inline">{currentTitle}</span>
            {!state.isPrizeMode && state.targetPrize && (
              <span className="text-amber-300 font-bold hidden lg:inline shrink-0">
                • {isRtl ? 'الجائزة:' : 'Prize:'} {state.targetPrize}
              </span>
            )}
          </h1>
        </div>

        {/* Controls: Winners Drawer + Sound + Fullscreen */}
        <div className="hk-draw-controls justify-self-end flex shrink-0 items-center gap-1 rounded-xl border border-slate-800/80 bg-slate-900/55">
          {/* Winners Archive Trigger */}
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setShowWinnersDrawer(true);
            }}
            className="hk-draw-winners-trigger group flex h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-lg text-xs font-bold text-slate-200 transition-[color,background-color,transform] hover:bg-white/[0.06] hover:text-amber-200 active:scale-[0.96] sm:text-sm"
            aria-label={isRtl ? 'عرض سجل الفائزين' : 'View winners archive'}
            title={isRtl ? 'سجل الفائزين' : 'Winners History'}
          >
            <Trophy className="size-4 shrink-0 text-amber-400" />
            <span className="hidden lg:inline">{isRtl ? 'الفائزون' : 'Winners'}</span>
            {sessionWinners.length > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-black leading-none text-black">
                {sessionWinners.length}
              </span>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-[color,background-color,transform] active:scale-[0.96] ${
              isMuted
                ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
            type="button"
            onClick={toggleFullscreen}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-[color,background-color,transform] hover:bg-slate-800 hover:text-white active:scale-[0.96]"
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

      {/* Main Wheel Center Stage */}
      <main className="flex-1 w-full flex flex-col items-center justify-center relative p-3 sm:p-4 z-10">
        <div className="relative w-[min(84vw,calc(100dvh-240px),520px)] h-[min(84vw,calc(100dvh-240px),520px)] flex items-center justify-center">
          {/* Wheel Canvas */}
          <canvas
            ref={canvasRef}
            className="rounded-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] transition-transform"
            role="img"
            aria-label={isRtl ? 'عجلة السحب التفاعلية' : 'Interactive draw wheel'}
          />

          {/* Haverkamp logo is the single spin control at the center of the wheel. */}
          <button
            type="button"
            onClick={spin}
            disabled={isSpinning || !activeItems.length || showWinnerModal}
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
              w-[20%] h-[20%] min-w-[52px] min-h-[52px] rounded-full select-none
              flex flex-col items-center justify-center gap-0.5
              transition-[transform,border-color,box-shadow,opacity] duration-200
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
                className="hk-wheel-spin-halo absolute inset-[-3px] animate-spin rounded-full border-2 border-transparent border-r-white/80 border-t-sky-400"
                aria-hidden="true"
              />
            )}

            {/* Subtle Idle Breathing Aura */}
            {!isSpinning && activeItems.length > 0 && (
              <span
                className="hk-wheel-idle-aura pointer-events-none absolute inset-[-4px] animate-pulse rounded-full border border-sky-400/20 group-hover:border-sky-400/40"
                aria-hidden="true"
              />
            )}

            <div className="relative flex w-[82%] flex-col items-center justify-center pointer-events-none">
              <Image
                src="/assets/logo.png"
                alt=""
                width={245}
                height={42}
                className="h-auto w-full brightness-0 invert drop-shadow-[0_1px_4px_rgba(255,255,255,0.42)]"
              />
              <span className="mt-1 text-[9px] font-black leading-none text-sky-200 drop-shadow sm:text-[10px]">
                {isSpinning ? (isRtl ? 'جاري...' : 'Spinning...') : isRtl ? 'ابدأ' : 'Spin'}
              </span>
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
          aria-labelledby="session-winners-title"
          className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/75 p-0 backdrop-blur-sm animate-fade-in sm:p-4"
          onClick={() => setShowWinnersDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full flex-col overflow-hidden border-slate-800 bg-[#081322] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] sm:h-[calc(100dvh-2rem)] sm:max-h-[760px] sm:w-[420px] sm:rounded-2xl sm:border"
          >
            <div className="hk-winners-panel-header flex items-center justify-between gap-4 border-b border-slate-800">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
                  <Trophy className="size-5" />
                </span>
                <div className="hk-winners-heading-copy flex min-w-0 flex-col">
                  <h2 id="session-winners-title" className="truncate text-base font-extrabold text-white">
                    {isRtl ? 'سجل فائزي الجلسة' : 'Session Winners'}
                  </h2>
                  <p className="text-xs font-medium text-slate-400">
                    {isRtl
                      ? `${sessionWinners.length} فائز في هذه الجلسة`
                      : `${sessionWinners.length} winners this session`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWinnersDrawer(false)}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label={isRtl ? 'إغلاق السجل' : 'Close history'}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="hk-winners-list min-h-0 flex-1 overflow-y-auto">
              {sessionWinners.length === 0 ? (
                <div className="hk-winners-empty flex h-full min-h-72 flex-col items-center justify-center text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-900 text-slate-500">
                    <Trophy className="size-6" />
                  </span>
                  <p className="text-base font-bold text-slate-200">
                    {isRtl ? 'لا يوجد فائزون حتى الآن' : 'No winners yet'}
                  </p>
                  <p className="max-w-64 text-sm leading-6 text-slate-400">
                    {isRtl
                      ? 'سيظهر هنا سجل الفائزين والجوائز بعد أول عملية سحب.'
                      : 'Winner names and prizes will appear here after the first draw.'}
                  </p>
                </div>
              ) : (
                <ol className="divide-y divide-slate-800/90">
                  {sessionWinners.map((w, idx) => (
                    <li key={idx} className="hk-winners-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-xs font-black text-amber-300">
                        {sessionWinners.length - idx}
                      </span>
                      <div className="hk-winners-row-copy flex min-w-0 flex-col">
                        <div className="truncate text-sm font-bold text-white">{w.name}</div>
                        {w.prize && <div className="truncate text-xs text-amber-200/90">{w.prize}</div>}
                      </div>
                      <time className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500">
                        {w.time}
                      </time>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="hk-winners-panel-footer flex items-center justify-between gap-3 border-t border-slate-800">
              {sessionWinners.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearWinners}
                  className="hk-winners-clear inline-flex min-h-11 items-center gap-2 rounded-xl text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                >
                  <Trash2 className="size-4" />
                  <span>{isRtl ? 'مسح السجل' : 'Clear History'}</span>
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setShowWinnersDrawer(false)}
                className="hk-winners-close inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 text-xs font-extrabold text-slate-950 transition-colors hover:bg-white"
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Winner Celebration */}
      {showWinnerModal && activeWinner && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="winner-card-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeWinnerModal();
          }}
          className="hk-winner-celebration fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        >
          <canvas
            ref={modalCanvasRef}
            className="fixed inset-0 pointer-events-none w-full h-full"
          />

          <div
            ref={modalDialogRef}
            onClick={(e) => e.stopPropagation()}
            className="hk-winner-card relative z-10 my-auto flex h-[min(92vh,780px)] w-[min(92vw,500px)] cursor-default flex-col items-center justify-between overflow-hidden rounded-[2.5rem] border-2 border-[#b8860b]/85 bg-[#0a101d] px-5 text-center shadow-[0_0_80px_rgba(184,134,11,0.25),0_30px_90px_rgba(0,0,0,0.95)] sm:rounded-[3rem] sm:px-8"
          >
            <div className="hk-winner-card-light" aria-hidden="true" />

            {/* Circular Close Button (Top-Left in Reference Design) */}
            <button
              ref={modalCloseBtnRef}
              type="button"
              onClick={closeWinnerModal}
              className="absolute left-5 top-5 z-20 flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-[#38bdf8] bg-[#0c1527] text-[#38bdf8] shadow-lg transition-[transform,background-color,border-color] duration-150 hover:bg-[#131f38] hover:scale-105 active:scale-95 sm:left-6 sm:top-6"
              aria-label={isRtl ? 'إغلاق النافذة' : 'Close window'}
            >
              <X className="size-5 text-[#38bdf8] stroke-[2.5]" />
            </button>

            <div className="hk-winner-hero flex w-full flex-col items-center">
              <div className="hk-winner-trophy-stage pointer-events-none relative flex items-center justify-center">
                <span className="hk-winner-trophy-ring" aria-hidden="true" />
                <Sparkles className="hk-winner-spark hk-winner-spark-start absolute size-6 text-amber-300" aria-hidden="true" />
                <Sparkles className="hk-winner-spark hk-winner-spark-end absolute size-5 text-sky-300" aria-hidden="true" />
                <Image
                  src="/assets/trophy-3d.png"
                  alt={isRtl ? 'كأس الفوز' : 'Winner trophy'}
                  width={320}
                  height={320}
                  className="hk-winner-trophy h-28 w-auto select-none object-contain drop-shadow-[0_14px_28px_rgba(251,191,36,0.38)] sm:h-32 md:h-36"
                />
              </div>

              <h3
                id="winner-card-title"
                className="mt-2 px-2 text-xl font-black leading-snug tracking-tight text-white sm:text-2xl"
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

              <div className="hk-winner-flourish mt-3 flex items-center justify-center gap-2 text-amber-300" aria-hidden="true">
                <span />
                <Sparkles className="size-4" />
                <span />
              </div>
            </div>

            <div className="hk-winner-name max-w-full break-words px-1 text-3xl font-black leading-tight text-[#FACC15] drop-shadow-[0_2px_16px_rgba(250,204,21,0.55)] sm:text-4xl md:text-5xl">
              {activeWinner.name}
            </div>

            <div className="hk-winner-prize inline-flex max-w-[90%] items-center justify-center gap-2 rounded-full border border-[#b8860b]/75 bg-[#1c150e] px-6 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] sm:px-7 sm:py-2.5">
              <Gift className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
              <span className="text-[#FACC15] text-sm sm:text-base md:text-lg font-bold truncate">
                {state.isPrizeMode
                  ? isRtl
                    ? 'جائزة فورية معتمدة من هافركامب'
                    : 'Haverkamp Certified Instant Prize'
                  : isRtl
                  ? `الجائزة: ${activeWinner.prize || 'جائزة هافركامب'}`
                  : `Prize: ${activeWinner.prize || 'Haverkamp Prize'}`}
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
                className="hk-winner-download flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#b8860b]/75 bg-[#151b27]/90 px-4 py-3 text-sm font-bold text-[#FACC15] shadow-sm transition-[transform,background-color,border-color] duration-150 hover:bg-[#1e2638] active:scale-[0.98] sm:rounded-2xl sm:text-base"
              >
                <Camera className="size-4.5 shrink-0" aria-hidden="true" />
                <span>
                  {isRtl
                    ? 'تحميل بطاقة الفوز (لإنستغرام وواتساب)'
                    : 'Download Winner Card (Instagram & WhatsApp)'}
                </span>
              </button>

              {/* Two Action Buttons Row: Left Green, Right Burgundy */}
              <div className="flex items-center gap-2.5 sm:gap-3 w-full" dir="ltr">
                {/* Left: Green Button */}
                <button
                  type="button"
                  onClick={closeWinnerModal}
                  className="hk-winner-action flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#059669] px-3 py-3 text-sm font-black text-white shadow-md transition-[transform,background-color] duration-150 hover:bg-[#047857] active:scale-95 sm:rounded-2xl sm:text-base"
                >
                  <CheckCircle2 className="size-4.5 shrink-0" aria-hidden="true" />
                  <span>
                    {isRtl
                      ? state.isPrizeMode
                        ? 'متابعة'
                        : 'إبقاء الفائز'
                      : 'Keep Winner'}
                  </span>
                </button>

                {/* Right: Dark Burgundy / Red Button */}
                {!state.isPrizeMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      excludeWinner(activeWinner.index);
                      closeWinnerModal();
                    }}
                    className="hk-winner-action flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#e11d48]/50 bg-[#2a131b] px-3 py-3 text-sm font-black text-[#fb7185] shadow-md transition-[transform,background-color,color] duration-150 hover:bg-[#381a24] hover:text-white active:scale-95 sm:rounded-2xl sm:text-base"
                  >
                    <UserMinus className="size-4.5 shrink-0" aria-hidden="true" />
                    <span>{isRtl ? 'استبعاد الفائز' : 'Exclude Winner'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeWinnerModal}
                    className="hk-winner-action flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#e11d48]/50 bg-[#2a131b] px-3 py-3 text-sm font-black text-[#fb7185] shadow-md transition-[transform,background-color,color] duration-150 hover:bg-[#381a24] hover:text-white active:scale-95 sm:rounded-2xl sm:text-base"
                  >
                    <X className="size-4.5 shrink-0" aria-hidden="true" />
                    <span>{isRtl ? 'إغلاق النافذة' : 'Close Window'}</span>
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
