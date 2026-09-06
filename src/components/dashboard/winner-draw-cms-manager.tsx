'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Gift,
  Users,
  Settings,
  Shuffle,
  Trash2,
  Upload,
  Download,
  Plus,
  Eye,
  CheckCircle2,
  Scale,
  Ticket,
  ExternalLink,
} from 'lucide-react';
import {
  type WinnerDrawState,
  DEFAULT_WINNER_DRAW_STATE,
  PRESETS,
  STORAGE_KEYS,
  BROADCAST_CHANNEL_NAME,
  normalizeWinnerDrawState,
} from '@/lib/winner-draw/types';

export function WinnerDrawCmsManager({ isWriteable }: { isWriteable: boolean }) {
  const [activeTab, setActiveTab] = useState<'customers' | 'prizes' | 'settings'>('customers');

  // Hydration-safe initial state
  const [state, setState] = useState<WinnerDrawState>(DEFAULT_WINNER_DRAW_STATE);
  const [customersText, setCustomersText] = useState<string>(DEFAULT_WINNER_DRAW_STATE.customers.join('\n'));

  const [newPrizeName, setNewPrizeName] = useState('');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState(false);

  // Load and normalize storage on client mount
  const loadState = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STATE);
      if (raw) {
        const parsed = normalizeWinnerDrawState(JSON.parse(raw));
        queueMicrotask(() => {
          setState(parsed);
          setCustomersText(parsed.customers.join('\n'));
        });
      }
    } catch (e) {
      console.warn('Error loading state in CMS:', e);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const saveStateToStorage = (newState: WinnerDrawState) => {
    if (!isWriteable || typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(newState));
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.postMessage({ type: 'STATE_UPDATED' });
        channel.close();
      }
      setSavedSuccessMsg(true);
      setTimeout(() => setSavedSuccessMsg(false), 2500);
    } catch (e) {
      console.warn('Error saving state in CMS:', e);
    }
  };

  const updateState = (updates: Partial<WinnerDrawState>) => {
    if (!isWriteable) return;
    const nextState = { ...state, ...updates };
    setState(nextState);
    saveStateToStorage(nextState);
  };

  // Customers tab handlers
  const handleCustomersTextChange = (val: string) => {
    setCustomersText(val);
    const lines = val
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    updateState({ customers: lines });
  };

  const handleShuffleCustomers = () => {
    if (!isWriteable) return;
    const shuffled = [...state.customers].sort(() => Math.random() - 0.5);
    setCustomersText(shuffled.join('\n'));
    updateState({ customers: shuffled });
  };

  const handleClearCustomers = () => {
    if (!isWriteable) return;
    setCustomersText('');
    updateState({ customers: [] });
  };

  const handleLoadPresetCustomers = (key: 'employees' | 'numbers50') => {
    if (!isWriteable) return;
    const presetData = PRESETS[key] || [];
    setCustomersText(presetData.join('\n'));
    updateState({ customers: [...presetData] });
  };

  const handleImportCustomers = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isWriteable || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;
      let names: string[] = [];
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) names = parsed.map((x) => String(x).trim()).filter(Boolean);
        } catch {}
      } else {
        names = content.split('\n').map((s) => s.trim()).filter(Boolean);
      }
      setCustomersText(names.join('\n'));
      updateState({ customers: names });
    };
    reader.readAsText(file);
  };

  const handleExportCustomers = () => {
    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(state.customers.join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'أسماء-المشاركين-هافركامب.txt');
    downloadAnchor.click();
  };

  // Prizes tab handlers
  const handleAddPrize = () => {
    if (!isWriteable || !newPrizeName.trim()) return;
    const updatedPrizes = [...state.prizes, newPrizeName.trim()];
    const updatedWeights = [...state.prizeWeights, 10];
    setNewPrizeName('');
    updateState({ prizes: updatedPrizes, prizeWeights: updatedWeights });
  };

  const handleDeletePrize = (index: number) => {
    if (!isWriteable) return;
    const updatedPrizes = state.prizes.filter((_, i) => i !== index);
    const updatedWeights = state.prizeWeights.filter((_, i) => i !== index);
    updateState({ prizes: updatedPrizes, prizeWeights: updatedWeights });
  };

  const handlePrizeWeightChange = (index: number, weight: number) => {
    if (!isWriteable) return;
    const updatedWeights = [...state.prizeWeights];
    updatedWeights[index] = weight;
    updateState({ prizeWeights: updatedWeights });
  };

  const handleResetWeights = () => {
    if (!isWriteable) return;
    const reset = state.prizes.map(() => 10);
    updateState({ prizeWeights: reset });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <Trophy className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-1)]">إدارة مسابقة السحب (Winner Draw)</h1>
            <p className="text-xs text-[var(--text-2)] mt-0.5">
              تعديل أسماء المشاركين والجوائز الفورية والسرعة وإعدادات الاحتفال مباشرة على شاشة الفرع
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/competitions/winner-draw"
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <ExternalLink className="size-3.5" />
            <span>عرض الشاشة الحية بالفرع</span>
          </Link>

          {/* Read-Only Badge Notice */}
          {!isWriteable ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-semibold">
              <Eye className="size-4" />
              <span>صلاحية العرض فقط (التعديلات معطّلة)</span>
            </div>
          ) : savedSuccessMsg ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-semibold animate-fade-in">
              <CheckCircle2 className="size-4" />
              <span>تم التحديث والحفظ على الشاشة!</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Mode Switcher Banner */}
      <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-[var(--text-2)] uppercase">نمط السحب النشط حالياً:</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              state.isPrizeMode
                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
            }`}
          >
            {state.isPrizeMode ? <Gift className="size-3.5" /> : <Users className="size-3.5" />}
            <span>{state.isPrizeMode ? 'سحب الجوائز الفورية' : 'سحب العملاء والأسماء'}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => updateState({ isPrizeMode: false })}
            disabled={!isWriteable}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              !state.isPrizeMode
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)]'
            }`}
          >
            <Users className="size-3.5" />
            <span>تفعيل سحب العملاء</span>
          </button>
          <button
            onClick={() => updateState({ isPrizeMode: true })}
            disabled={!isWriteable}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              state.isPrizeMode
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)]'
            }`}
          >
            <Gift className="size-3.5" />
            <span>تفعيل عجلة الجوائز</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2">
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'customers'
              ? 'border-sky-500 text-sky-500'
              : 'border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]'
          }`}
        >
          <Users className="size-4" />
          <span>سحب العملاء والأسماء</span>
        </button>

        <button
          onClick={() => setActiveTab('prizes')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'prizes'
              ? 'border-purple-500 text-purple-500'
              : 'border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]'
          }`}
        >
          <Gift className="size-4" />
          <span>الجوائز الفورية والأوزان</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]'
          }`}
        >
          <Settings className="size-4" />
          <span>إعدادات العجلة والاحتفال</span>
        </button>
      </div>

      {/* Tab 1: Customers */}
      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--text-1)]">
                قائمة أسماء المشاركين في السحب (اسم في كل سطر)
              </label>
              <span className="text-xs font-bold text-sky-500">
                العدد: {state.customers.length}
              </span>
            </div>

            <textarea
              rows={12}
              value={customersText}
              onChange={(e) => handleCustomersTextChange(e.target.value)}
              disabled={!isWriteable}
              placeholder="أدخل الأسماء هنا، اسم في كل سطر..."
              className="w-full p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm font-mono focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-60"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShuffleCustomers}
                  disabled={!isWriteable || !state.customers.length}
                  className="px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-xs font-semibold hover:bg-[var(--border)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Shuffle className="size-3.5" />
                  <span>خلط عشوائي</span>
                </button>
                <button
                  onClick={handleClearCustomers}
                  disabled={!isWriteable || !state.customers.length}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold hover:bg-rose-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  <span>مسح الكل</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label
                  className={`px-3.5 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    !isWriteable ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <Upload className="size-3.5" />
                  <span>استيراد ملف</span>
                  <input
                    type="file"
                    accept=".txt,.json"
                    onChange={handleImportCustomers}
                    className="hidden"
                    disabled={!isWriteable}
                  />
                </label>
                <button
                  onClick={handleExportCustomers}
                  disabled={!state.customers.length}
                  className="px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-xs font-semibold hover:bg-[var(--border)] transition-colors flex items-center gap-1.5"
                >
                  <Download className="size-3.5" />
                  <span>تصدير ملف TXT</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--text-1)]">إعدادات سحب العملاء</h3>

              <div>
                <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
                  عنوان المسابقة (يظهر في أعلى شاشة السحب)
                </label>
                <input
                  type="text"
                  value={state.contestTitleCustomers}
                  onChange={(e) => updateState({ contestTitleCustomers: e.target.value })}
                  disabled={!isWriteable}
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-sky-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
                  اسم الجائزة المستهدفة
                </label>
                <input
                  type="text"
                  value={state.targetPrize}
                  onChange={(e) => updateState({ targetPrize: e.target.value })}
                  disabled={!isWriteable}
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-sky-500 disabled:opacity-60"
                />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-1)]">نماذج جاهزة للتحميل السريع</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleLoadPresetCustomers('employees')}
                  disabled={!isWriteable}
                  className="w-full text-right p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] border border-[var(--border)] text-xs font-semibold text-[var(--text-1)] transition-colors disabled:opacity-50 flex items-center justify-between"
                >
                  <span>قائمة موظفي هافركامب (10 أسماء)</span>
                  <Users className="size-4 text-sky-400" />
                </button>
                <button
                  onClick={() => handleLoadPresetCustomers('numbers50')}
                  disabled={!isWriteable}
                  className="w-full text-right p-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] border border-[var(--border)] text-xs font-semibold text-[var(--text-1)] transition-colors disabled:opacity-50 flex items-center justify-between"
                >
                  <span>50 كوبون سحب مرقّم (من 1001 إلى 1050)</span>
                  <Ticket className="size-4 text-amber-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Prizes */}
      {activeTab === 'prizes' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
                عنوان عجلة الجوائز
              </label>
              <input
                type="text"
                value={state.contestTitlePrizes}
                onChange={(e) => updateState({ contestTitlePrizes: e.target.value })}
                disabled={!isWriteable}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-purple-500 disabled:opacity-60"
              />
            </div>

            <div className="flex items-end justify-end gap-2">
              <button
                onClick={handleResetWeights}
                disabled={!isWriteable}
                className="px-4 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text-1)] hover:bg-[var(--border)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Scale className="size-4" />
                <span>إعادة تعادل الأوزان (10 للكل)</span>
              </button>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-1)]">إضافة جائزة جديدة</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newPrizeName}
                onChange={(e) => setNewPrizeName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPrize()}
                disabled={!isWriteable}
                placeholder="اسم الجائزة الجديدة..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-purple-500 disabled:opacity-60"
              />
              <button
                onClick={handleAddPrize}
                disabled={!isWriteable || !newPrizeName.trim()}
                className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-500 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="size-4" />
                <span>إضافة</span>
              </button>
            </div>
          </div>

          {/* Prizes List */}
          <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-1)]">
              الجوائز المسجلة والأوزان والاحتمالات ({state.prizes.length})
            </h3>

            <div className="space-y-3">
              {state.prizes.map((prize, idx) => {
                const weight = state.prizeWeights[idx] ?? 10;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 font-bold text-xs flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <span className="text-sm font-semibold text-[var(--text-1)]">{prize}</span>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="flex items-center gap-2 flex-1 md:w-64">
                        <span className="text-xs text-[var(--text-2)] font-mono w-16">
                          وزن: {weight}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={weight}
                          onChange={(e) => handlePrizeWeightChange(idx, parseInt(e.target.value, 10))}
                          disabled={!isWriteable}
                          className="flex-1 accent-purple-500"
                        />
                      </div>

                      <button
                        onClick={() => handleDeletePrize(idx)}
                        disabled={!isWriteable}
                        className="p-2 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                        title="حذف الجائزة"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Settings */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-1)]">إعدادات الدوران والعجلة</h3>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-2)] mb-1.5">
                <span>مدة الدوران (بالثواني)</span>
                <span className="font-mono text-sky-400">{state.duration} ثوانٍ</span>
              </div>
              <input
                type="range"
                min={3}
                max={20}
                value={state.duration}
                onChange={(e) => updateState({ duration: parseInt(e.target.value, 10) })}
                disabled={!isWriteable}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-2)] mb-1.5">
                <span>عدد اللفات (السرعة)</span>
                <span className="font-mono text-sky-400">{state.rotations} دورات</span>
              </div>
              <input
                type="range"
                min={4}
                max={15}
                value={state.rotations}
                onChange={(e) => updateState({ rotations: parseInt(e.target.value, 10) })}
                disabled={!isWriteable}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
                نمط التلوين والمظهر
              </label>
              <select
                value={state.styleMode}
                onChange={(e) =>
                  updateState({ styleMode: e.target.value as WinnerDrawState['styleMode'] })
                }
                disabled={!isWriteable}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-sky-500 disabled:opacity-60"
              >
                <option value="vibrant">زاهٍ فاخر (Vibrant)</option>
                <option value="duotone">كحلي وأزرق (Duotone Slate)</option>
                <option value="pastel">باستيل هادئ (Pastel Soft)</option>
              </select>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.autoRemove}
                  onChange={(e) => updateState({ autoRemove: e.target.checked })}
                  disabled={!isWriteable}
                  className="rounded border-[var(--border)] text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs font-semibold text-[var(--text-1)]">
                  استبعاد الفائز تلقائياً عند إغلاق النافذة (سحب العملاء فقط)
                </span>
              </label>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-1)]">إعدادات الصوت والاحتفال</h3>

            <div>
              <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
                نمط المؤثرات البصرية (Confetti Celebration)
              </label>
              <select
                value={state.celebrationStyle}
                onChange={(e) =>
                  updateState({
                    celebrationStyle: e.target.value as WinnerDrawState['celebrationStyle'],
                  })
                }
                disabled={!isWriteable}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-amber-500 disabled:opacity-60"
              >
                <option value="fireworks">ألعاب نارية وملونة (Fireworks)</option>
                <option value="golden_stars">نجوم ذهبية فاخرة (Golden Stars)</option>
                <option value="confetti">قصاصات ملونة (Classic Confetti)</option>
                <option value="none">بدون مؤثرات بصرية (None)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
                مدة عرض نافذة الفائز
              </label>
              <select
                value={state.celebrationDuration}
                onChange={(e) =>
                  updateState({
                    celebrationDuration: e.target.value as WinnerDrawState['celebrationDuration'],
                  })
                }
                disabled={!isWriteable}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-amber-500 disabled:opacity-60"
              >
                <option value="5000">5 ثوانٍ</option>
                <option value="10000">10 ثوانٍ (افتراضي)</option>
                <option value="15000">15 ثانية</option>
                <option value="until_closed">حتى الإغلاق اليدوي</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
                صوت الفوز والنصر (Web Audio Synth)
              </label>
              <select
                value={state.victorySound}
                onChange={(e) =>
                  updateState({
                    victorySound: e.target.value as WinnerDrawState['victorySound'],
                  })
                }
                disabled={!isWriteable}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-amber-500 disabled:opacity-60"
              >
                <option value="fanfare">معزوفة النصر (Fanfare)</option>
                <option value="applause">تصفيق وصياح الجماهير (Applause)</option>
                <option value="chimes">أجراس متلألئة (Chimes)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
