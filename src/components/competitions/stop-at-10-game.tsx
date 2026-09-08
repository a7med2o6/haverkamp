'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Award,
  Sparkles,
  Volume2,
  VolumeX,
  Target,
} from 'lucide-react';
import type { Locale } from '@/lib/site-data';
import { soundManager } from '@/lib/winner-draw/sound';
import { normalizeBestDiff } from '@/lib/winner-draw/types';

const TARGET_TIME = 10.0; // 10.000 seconds
const TARGET_TIME_LABEL = TARGET_TIME.toFixed(3);
const BEST_ATTEMPT_STORAGE_KEY = 'haverkamp_stop_at_10_best_diff_v1';

function isExactDisplayedTarget(seconds: number) {
  return seconds.toFixed(3) === TARGET_TIME_LABEL;
}

type GameState = 'idle' | 'running' | 'stopped';

export function StopAt10GameView({ locale }: { locale: Locale }) {
  const isRtl = locale === 'ar';
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  // Hydration-safe initial states
  const [gameState, setGameState] = useState<GameState>('idle');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [capturedTime, setCapturedTime] = useState<number | null>(null);
  const [bestDiff, setBestDiff] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState<string>('');

  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const celebrationCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load personal best attempt safely after mount without sync setState in effect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(BEST_ATTEMPT_STORAGE_KEY);
      if (saved !== null) {
        const parsed = normalizeBestDiff(saved);
        queueMicrotask(() => setBestDiff(parsed));
      }
    } catch (e) {
      console.warn('Error loading best attempt:', e);
    }
  }, []);

  const startTimer = () => {
    soundManager.init();
    setGameState('running');
    setCapturedTime(null);
    setElapsedTime(0);
    setSrAnnouncement('');
    const now = performance.now();
    startTimeRef.current = now;

    const tick = () => {
      if (startTimeRef.current === null) return;
      const currentNow = performance.now();
      setElapsedTime((currentNow - startTimeRef.current) / 1000);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  const stopTimer = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    const finalNow = performance.now();
    const finalElapsed = startTimeRef.current !== null ? (finalNow - startTimeRef.current) / 1000 : elapsedTime;
    startTimeRef.current = null;

    setElapsedTime(finalElapsed);
    setCapturedTime(finalElapsed);
    setGameState('stopped');

    const diff = Math.abs(finalElapsed - TARGET_TIME);
    const signed = finalElapsed - TARGET_TIME;
    const isPerfectHit = isExactDisplayedTarget(finalElapsed);

    // Polite screen reader announcement on stop
    const announcementText = isRtl
      ? `النتيجة: ${finalElapsed.toFixed(3)} ثانية، الفارق ${signed > 0 ? '+' : ''}${signed.toFixed(3)} ثانية`
      : `Result: ${finalElapsed.toFixed(3)} seconds, difference ${signed > 0 ? '+' : ''}${signed.toFixed(3)} seconds`;
    setSrAnnouncement(announcementText);

    if (bestDiff === null || diff < bestDiff) {
      setBestDiff(diff);
      try {
        localStorage.setItem(BEST_ATTEMPT_STORAGE_KEY, diff.toString());
      } catch {}
    }

    if (isPerfectHit) {
      soundManager.playWinFanfare('fanfare');
      if (
        celebrationCanvasRef.current &&
        typeof window !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        const myConfetti = confetti.create(celebrationCanvasRef.current, {
          resize: true,
          disableForReducedMotion: true,
        });
        myConfetti({
          particleCount: 120,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#38bdf8', '#fbbf24', '#10b981', '#ffffff'],
        });
      }
    }
  };

  const resetTimer = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    startTimeRef.current = null;
    setGameState('idle');
    setElapsedTime(0);
    setCapturedTime(null);
    setSrAnnouncement('');
  };

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const toggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const absDiff = capturedTime !== null ? Math.abs(capturedTime - TARGET_TIME) : null;
  const signedDiff = capturedTime !== null ? capturedTime - TARGET_TIME : null;
  const isPerfectHit = capturedTime !== null && isExactDisplayedTarget(capturedTime);

  return (
    <div className="hk-game-view">
      <canvas ref={celebrationCanvasRef} className="fixed inset-0 pointer-events-none z-50 w-full h-full" />

      {/* Screen Reader Announcement (Polite status) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {srAnnouncement}
      </div>

      {/* Top Header */}
      <header className="hk-game-header">
        <Link href={isRtl ? '/competitions' : '/en/competitions'} className="hk-game-back-link">
          <ArrowIcon className="size-4" />
          <span>{isRtl ? 'العودة للمسابقات' : 'Back to Competitions'}</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hk-comp-badge !mb-0">
            <Sparkles className="size-4 text-[var(--hk-comp-accent-blue)]" />
            <span>{isRtl ? 'تحدي 10 ثوانٍ' : '10 Seconds Challenge'}</span>
          </span>

          <button
            onClick={toggleSound}
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-200 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            aria-label={isMuted ? (isRtl ? 'تفعيل الصوت' : 'Unmute sound') : (isRtl ? 'كتم الصوت' : 'Mute sound')}
          >
            {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        </div>
      </header>

      {/* Main Game Stage */}
      <main className="hk-timer-stage">
        <div className="hk-timer-card">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            {isRtl ? 'الهدف المطلوب: 10.000 ثانية' : 'Target: 10.000 Seconds'}
          </span>

          {/* Timer Visual Display (NO aria-live on 60fps text) */}
          <div
            className={`hk-timer-display ${
              gameState === 'running' ? 'running' : gameState === 'stopped' ? 'stopped' : ''
            }`}
            aria-hidden="true"
          >
            {elapsedTime.toFixed(3)}
            <span className="text-2xl font-sans font-semibold text-slate-400 ml-2">s</span>
          </div>

          {/* Primary Action Button */}
          {gameState === 'idle' && (
            <button
              onClick={startTimer}
              className="hk-timer-btn-primary hk-timer-btn-start"
              aria-label={isRtl ? 'بدء المؤقت' : 'Start Timer'}
            >
              <Play className="size-7 fill-current" />
              <span>{isRtl ? 'بدء المؤقت' : 'Start Timer'}</span>
            </button>
          )}

          {gameState === 'running' && (
            <button
              onClick={stopTimer}
              className="hk-timer-btn-primary hk-timer-btn-stop"
              aria-label={isRtl ? 'إيقاف المؤقت' : 'Stop Timer'}
            >
              <Square className="size-7 fill-current" />
              <span>{isRtl ? 'إيقاف الوقت الآن!' : 'Freeze Time Now!'}</span>
            </button>
          )}

          {gameState === 'stopped' && (
            <button
              onClick={resetTimer}
              className="hk-timer-btn-primary hk-timer-btn-reset"
              aria-label={isRtl ? 'إعادة المحاولة' : 'Try Again'}
            >
              <RotateCcw className="size-6" />
              <span>{isRtl ? 'محاولة جديدة' : 'Try Again'}</span>
            </button>
          )}

          {/* Captured Results Section */}
          {gameState === 'stopped' && capturedTime !== null && absDiff !== null && signedDiff !== null && (
            <div className="hk-timer-result">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                {isRtl ? 'الفارق عن الهدف (10.000s):' : 'Difference from target (10.000s):'}
              </div>
              <div className="hk-timer-diff-badge">
                {signedDiff > 0 ? `+${signedDiff.toFixed(3)}` : signedDiff.toFixed(3)}s
              </div>
              <div className="text-sm font-semibold text-slate-300 mt-2">
                {isRtl ? 'الفرق المطلق:' : 'Absolute difference:'} {absDiff.toFixed(3)}s
              </div>
              {isPerfectHit && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-extrabold">
                  <Target className="size-3.5" />
                  <span>{isRtl ? '10.000 بالضبط!' : 'Exact 10.000!'}</span>
                </div>
              )}
            </div>
          )}

          {/* Personal Best Attempt Box */}
          {bestDiff !== null && (
            <div className="hk-timer-best-box">
              <div className="flex items-center gap-2">
                <Award className="size-5 text-[var(--hk-comp-accent-gold)]" />
                <span className="font-bold">{isRtl ? 'أفضل محاولة محلية:' : 'Personal Best Attempt:'}</span>
              </div>
              <span className="font-mono font-extrabold text-[var(--hk-comp-text-primary)]">
                ±{bestDiff.toFixed(3)}s
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
