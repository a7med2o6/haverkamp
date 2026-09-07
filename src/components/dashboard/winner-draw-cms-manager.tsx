'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  AlertCircle,
  Scale,
  Ticket,
  ExternalLink,
  Type,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  type WinnerDrawState,
  DEFAULT_WINNER_DRAW_STATE,
  PRESETS,
  STORAGE_KEYS,
  BROADCAST_CHANNEL_NAME,
  normalizeWinnerDrawState,
} from '@/lib/winner-draw/types';
import { WheelRenderer } from '@/lib/winner-draw/wheel-renderer';
import styles from './winner-draw-cms.module.css';

export function WinnerDrawCmsManager({ isWriteable }: { isWriteable: boolean }) {
  // Default to prizes tab
  const [activeTab, setActiveTab] = useState<'prizes' | 'customers' | 'settings'>('prizes');

  // Hydration-safe initial state
  const [state, setState] = useState<WinnerDrawState>(DEFAULT_WINNER_DRAW_STATE);
  const [customersText, setCustomersText] = useState<string>(DEFAULT_WINNER_DRAW_STATE.customers.join('\n'));
  const [newPrizeName, setNewPrizeName] = useState('');

  // Draft states for smooth, un-clamped typing
  const [prizeDrafts, setPrizeDrafts] = useState<string[]>(DEFAULT_WINNER_DRAW_STATE.prizes);
  const [weightDrafts, setWeightDrafts] = useState<string[]>(
    DEFAULT_WINNER_DRAW_STATE.prizeWeights.map(String)
  );
  const [fontDraftStr, setFontDraftStr] = useState<string>(
    String(DEFAULT_WINNER_DRAW_STATE.wheelFontSize)
  );

  // Status message persistence & timer
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatusMessage = useCallback((type: 'success' | 'error', message: string) => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    setSaveStatus({ type, message });

    // Success auto-dismisses after 3s; Error persists until recovery/action
    if (type === 'success') {
      statusTimerRef.current = setTimeout(() => {
        setSaveStatus(null);
        statusTimerRef.current = null;
      }, 3000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  // Load and normalize storage on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STATE);
      if (raw) {
        const parsed = normalizeWinnerDrawState(JSON.parse(raw));
        queueMicrotask(() => {
          setState(parsed);
          setCustomersText(parsed.customers.join('\n'));
          setPrizeDrafts(parsed.prizes);
          setWeightDrafts(parsed.prizeWeights.map((w) => String(w)));
          setFontDraftStr(String(parsed.wheelFontSize ?? 18));
        });
      }
    } catch (e) {
      console.warn('Error loading state in Winner Draw CMS:', e);
      queueMicrotask(() => {
        setStatusMessage('error', 'فشل في تحميل الإعدادات المحفوظة من التخزين المحلي');
      });
    }
  }, [setStatusMessage]);

  // Persistent state updates
  const saveStateToStorage = (newState: WinnerDrawState) => {
    if (!isWriteable || typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(newState));
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.postMessage({ type: 'STATE_UPDATED' });
        channel.close();
      }
      setStatusMessage('success', 'تم حفظ التعديلات وتحديث الشاشة الحية (على هذا المتصفح/الجهاز)');
    } catch (e) {
      console.warn('Error saving state in CMS:', e);
      setStatusMessage('error', 'تعذر حفظ التغييرات في التخزين المحلي للمتصفح');
    }
  };

  const updateState = (updates: Partial<WinnerDrawState>) => {
    if (!isWriteable) return;
    const nextState = { ...state, ...updates };
    setState(nextState);
    saveStateToStorage(nextState);
  };

  // Live Canvas Preview Refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewWheelRef = useRef<WheelRenderer | null>(null);

  // Preview follows currently edited tab
  const previewItems =
    activeTab === 'prizes'
      ? state.prizes
      : activeTab === 'customers'
      ? state.customers
      : state.isPrizeMode
      ? state.prizes
      : state.customers;

  const isPreviewMatchingLiveMode =
    (activeTab === 'prizes' && state.isPrizeMode) ||
    (activeTab === 'customers' && !state.isPrizeMode) ||
    activeTab === 'settings';

  useEffect(() => {
    if (!previewCanvasRef.current) return;
    const wheel = new WheelRenderer(previewCanvasRef.current, {
      items: previewItems,
      duration: state.duration * 1000,
      styleMode: state.styleMode,
      wheelFontSize: state.wheelFontSize,
    });
    previewWheelRef.current = wheel;

    return () => {
      wheel.destroy();
      previewWheelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!previewWheelRef.current) return;
    previewWheelRef.current.setItems(previewItems);
    previewWheelRef.current.setStyleMode(state.styleMode);
    previewWheelRef.current.setWheelFontSize(state.wheelFontSize ?? 18);
    previewWheelRef.current.duration = state.duration * 1000;
  }, [previewItems, state.styleMode, state.duration, state.wheelFontSize]);

  // Total weight calculation using committed valid weights
  const totalWeight = state.prizeWeights.reduce((sum, w) => {
    const valid = typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : 10;
    return sum + valid;
  }, 0);

  // Prizes Draft Handlers
  const handlePrizeDraftChange = (index: number, newDraft: string) => {
    if (!isWriteable) return;
    const updatedDrafts = [...prizeDrafts];
    updatedDrafts[index] = newDraft;
    setPrizeDrafts(updatedDrafts);

    const trimmed = newDraft.trim();
    if (trimmed.length > 0) {
      const updatedPrizes = [...state.prizes];
      updatedPrizes[index] = trimmed;
      updateState({ prizes: updatedPrizes });
    }
  };

  const handlePrizeDraftBlur = (index: number) => {
    if (!isWriteable) return;
    const currentDraft = prizeDrafts[index] ?? '';
    const trimmed = currentDraft.trim();

    if (trimmed.length === 0) {
      // Restore committed name if blanked
      const restored = [...prizeDrafts];
      restored[index] = state.prizes[index];
      setPrizeDrafts(restored);
      setStatusMessage('error', 'لا يمكن حفظ اسم جائزة خالٍ. تم استعادة الاسم السابق.');
    } else {
      const updatedDrafts = [...prizeDrafts];
      updatedDrafts[index] = trimmed;
      setPrizeDrafts(updatedDrafts);

      const updatedPrizes = [...state.prizes];
      updatedPrizes[index] = trimmed;
      updateState({ prizes: updatedPrizes });
    }
  };

  // Weight Draft Handlers
  const handleWeightDraftChange = (index: number, valStr: string) => {
    if (!isWriteable) return;
    const updated = [...weightDrafts];
    updated[index] = valStr;
    setWeightDrafts(updated);
  };

  const handleWeightDraftBlur = (index: number) => {
    if (!isWriteable) return;
    const valStr = weightDrafts[index] ?? '';
    const parsed = parseInt(valStr, 10);
    const validWeight = !Number.isFinite(parsed) || parsed < 0 ? 0 : Math.min(100, Math.round(parsed));

    const updatedDrafts = [...weightDrafts];
    updatedDrafts[index] = String(validWeight);
    setWeightDrafts(updatedDrafts);

    const updatedWeights = [...state.prizeWeights];
    updatedWeights[index] = validWeight;
    updateState({ prizeWeights: updatedWeights });
  };

  const handleWeightSliderChange = (index: number, val: number) => {
    if (!isWriteable) return;
    const validWeight = Math.max(0, Math.min(100, Math.round(val)));
    const updatedDrafts = [...weightDrafts];
    updatedDrafts[index] = String(validWeight);
    setWeightDrafts(updatedDrafts);

    const updatedWeights = [...state.prizeWeights];
    updatedWeights[index] = validWeight;
    updateState({ prizeWeights: updatedWeights });
  };

  const handleAddPrize = () => {
    if (!isWriteable || !newPrizeName.trim()) return;
    const name = newPrizeName.trim();
    const updatedPrizes = [...state.prizes, name];
    const updatedWeights = [...state.prizeWeights, 10];
    setPrizeDrafts([...prizeDrafts, name]);
    setWeightDrafts([...weightDrafts, '10']);
    setNewPrizeName('');
    updateState({ prizes: updatedPrizes, prizeWeights: updatedWeights });
  };

  const handleDeletePrize = (index: number) => {
    if (!isWriteable) return;
    const updatedPrizes = state.prizes.filter((_, i) => i !== index);
    const updatedWeights = state.prizeWeights.filter((_, i) => i !== index);
    setPrizeDrafts(prizeDrafts.filter((_, i) => i !== index));
    setWeightDrafts(weightDrafts.filter((_, i) => i !== index));
    updateState({ prizes: updatedPrizes, prizeWeights: updatedWeights });
  };

  const handleResetWeights = () => {
    if (!isWriteable) return;
    const reset = state.prizes.map(() => 10);
    setWeightDrafts(state.prizes.map(() => '10'));
    updateState({ prizeWeights: reset });
  };

  // Font Size Handlers
  const handleFontDraftChange = (valStr: string) => {
    if (!isWriteable) return;
    setFontDraftStr(valStr);
  };

  const handleFontDraftBlur = () => {
    if (!isWriteable) return;
    const parsed = parseInt(fontDraftStr, 10);
    const clamped = !Number.isFinite(parsed)
      ? state.wheelFontSize ?? 18
      : Math.max(10, Math.min(32, Math.round(parsed)));

    setFontDraftStr(String(clamped));
    updateState({ wheelFontSize: clamped });
  };

  const handleFontSliderChange = (val: number) => {
    if (!isWriteable) return;
    const clamped = Math.max(10, Math.min(32, Math.round(val)));
    setFontDraftStr(String(clamped));
    updateState({ wheelFontSize: clamped });
  };

  // Customers Handlers
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
      if (!content || !content.trim()) {
        setStatusMessage('error', 'الملف المستورد فارغ');
        return;
      }

      let names: string[] = [];
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            setStatusMessage('error', 'ملف JSON غير صالح: يجب أن يحتوي الملف على قائمة أسماء (Array)');
            return; // PRESERVE existing customer data!
          }
          names = parsed.map((x) => String(x).trim()).filter(Boolean);
        } catch {
          setStatusMessage('error', 'فشل في قراءة ملف JSON: تنسيق غير صحيح');
          return; // PRESERVE existing customer data!
        }
      } else {
        names = content.split('\n').map((s) => s.trim()).filter(Boolean);
      }

      if (names.length === 0) {
        setStatusMessage('error', 'لم يتم العثور على أسماء صالحة داخل الملف المستورد');
        return; // PRESERVE existing customer data!
      }

      setCustomersText(names.join('\n'));
      updateState({ customers: names });
    };

    reader.onerror = () => setStatusMessage('error', 'تعذر قراءة الملف. حاول اختيار الملف مرة أخرى.');
    reader.readAsText(file);
    e.target.value = ''; // Reset input to allow re-importing same file
  };

  const handleExportCustomers = () => {
    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(state.customers.join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'أسماء-المشاركين-هافركامب.txt');
    downloadAnchor.click();
  };

  return (
    <div className={styles.workspace}>
      {/* Header Banner */}
      <div className={styles.headerCard}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.headerIconBox}>
            <Trophy className="size-5" />
          </div>
          <div>
            <h1 className={styles.headerHeading}>إدارة عجلة السحب والجوائز</h1>
            <p className={styles.headerSubheading}>
              تعديل أسماء الجوائز، الأوزان والاحتمالات، وحجم الخط داخل العجلة للشاشة الحية
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Link href="/competitions/winner-draw" target="_blank" className={styles.publicLinkBtn}>
            <ExternalLink className="size-4" />
            <span>عرض الشاشة الحية</span>
          </Link>

          {!isWriteable ? (
            <div className={styles.readOnlyTag}>
              <Eye className="size-4" />
              <span>صلاحية العرض فقط (التعديل معطّل)</span>
            </div>
          ) : saveStatus ? (
            <div
              role={saveStatus.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={`${styles.statusToast} ${
                saveStatus.type === 'success' ? styles.statusSuccess : styles.statusError
              }`}
            >
              {saveStatus.type === 'success' ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              <span>{saveStatus.message}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Mode Switcher Banner */}
      <div className={styles.modeCard}>
        <div className={styles.modeLabelGroup}>
          <span className={styles.modeTitle}>النمط النشط بالفرع:</span>
          {state.isPrizeMode ? (
            <span className={styles.modeBadgePrize}>
              <Gift className="size-4" />
              <span>عجلة الجوائز الفورية</span>
            </span>
          ) : (
            <span className={styles.modeBadgeCustomer}>
              <Users className="size-4" />
              <span>سحب أسماء العملاء</span>
            </span>
          )}
        </div>

        <div className={styles.modeBtnGroup}>
          <button
            type="button"
            aria-pressed={state.isPrizeMode}
            onClick={() => updateState({ isPrizeMode: true })}
            disabled={!isWriteable}
            className={`${styles.modeBtn} ${
              state.isPrizeMode ? styles.modeBtnActivePrize : styles.modeBtnInactive
            }`}
          >
            <Gift className="size-4" />
            <span>تفعيل عجلة الجوائز</span>
          </button>
          <button
            type="button"
            aria-pressed={!state.isPrizeMode}
            onClick={() => updateState({ isPrizeMode: false })}
            disabled={!isWriteable}
            className={`${styles.modeBtn} ${
              !state.isPrizeMode ? styles.modeBtnActiveCustomer : styles.modeBtnInactive
            }`}
          >
            <Users className="size-4" />
            <span>تفعيل سحب العملاء</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabsNav} role="tablist" aria-label="تبويبات إدارة السحب"
        onKeyDown={(event) => {
          const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
          if (!keys.includes(event.key)) return;
          event.preventDefault();
          const tabs = ['prizes', 'customers', 'settings'] as const;
          const current = tabs.indexOf(activeTab);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2
            : (current + (event.key === 'ArrowLeft' ? 1 : 2)) % tabs.length;
          setActiveTab(tabs[next]);
          event.currentTarget.querySelector<HTMLButtonElement>(`#tab-${tabs[next]}`)?.focus();
        }}>
        <button
          type="button"
          role="tab"
          id="tab-prizes"
          tabIndex={activeTab === 'prizes' ? 0 : -1}
          aria-selected={activeTab === 'prizes'}
          aria-controls="tabpanel-prizes"
          onClick={() => setActiveTab('prizes')}
          className={`${styles.tabBtn} ${activeTab === 'prizes' ? styles.tabBtnActivePrize : ''}`}
        >
          <Gift className="size-4" />
          <span>الجوائز والأوزان</span>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-customers"
          tabIndex={activeTab === 'customers' ? 0 : -1}
          aria-selected={activeTab === 'customers'}
          aria-controls="tabpanel-customers"
          onClick={() => setActiveTab('customers')}
          className={`${styles.tabBtn} ${activeTab === 'customers' ? styles.tabBtnActiveCustomer : ''}`}
        >
          <Users className="size-4" />
          <span>أسماء المشاركين</span>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-settings"
          tabIndex={activeTab === 'settings' ? 0 : -1}
          aria-selected={activeTab === 'settings'}
          aria-controls="tabpanel-settings"
          onClick={() => setActiveTab('settings')}
          className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabBtnActiveSettings : ''}`}
        >
          <Settings className="size-4" />
          <span>إعدادات العجلة</span>
        </button>
      </div>

      {/* Main Workspace Grid */}
      <div className={styles.mainGrid}>
        {/* Tab Contents */}
        <div className={styles.contentArea}>
          {/* TAB 1: PRIZES */}
          {activeTab === 'prizes' && (
            <div id="tabpanel-prizes" role="tabpanel" aria-labelledby="tab-prizes" className="space-y-4">
              {/* Prize Title & Rebalance */}
              <div className={styles.card}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-2">
                    <label htmlFor="contest-title-prizes-input" className={styles.fieldLabel}>
                      عنوان عجلة الجوائز (يظهر للشاشة)
                    </label>
                    <input
                      id="contest-title-prizes-input"
                      type="text"
                      className={styles.input}
                      value={state.contestTitlePrizes}
                      onChange={(e) => updateState({ contestTitlePrizes: e.target.value })}
                      disabled={!isWriteable}
                      placeholder="عجلة الجوائز الفورية..."
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleResetWeights}
                      disabled={!isWriteable || !state.prizes.length}
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      title="تعادل الأوزان يمنح جميع الجوائز أوزاناً متساوية (10)"
                    >
                      <Scale className="size-4 text-purple-400" />
                      <span>تعادل الأوزان (10 للكل)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Font Size Control Card */}
              <div className={styles.fontSizeCard}>
                <div className={styles.sectionTitle}>
                  <span className="flex items-center gap-2">
                    <Type className="size-4 text-purple-400" />
                    <span>حجم النص داخل العجلة</span>
                  </span>
                  <span className={styles.fontSizeValueDisplay}>{state.wheelFontSize ?? 18} px</span>
                </div>

                <div className={styles.fontSizeControlsRow}>
                  <div className={styles.fontSizeSliderGroup}>
                    <span className="text-xs text-[var(--text-2)] font-mono">10px</span>
                    <input
                      type="range"
                      aria-label="شريط حجم النص داخل العجلة"
                      min={10}
                      max={32}
                      step={1}
                      value={state.wheelFontSize ?? 18}
                      onChange={(e) => handleFontSliderChange(parseInt(e.target.value, 10))}
                      disabled={!isWriteable}
                      className={styles.rangeInput}
                    />
                    <span className="text-xs text-[var(--text-2)] font-mono">32px</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label htmlFor="font-size-num-input" className="text-xs text-[var(--text-2)] font-bold">
                      القيمة (10-32):
                    </label>
                    <input
                      id="font-size-num-input"
                      type="number"
                      aria-label="القيمة الرقمية لحجم النص"
                      min={10}
                      max={32}
                      value={fontDraftStr}
                      onChange={(e) => handleFontDraftChange(e.target.value)}
                      onBlur={handleFontDraftBlur}
                      onKeyDown={(e) => e.key === 'Enter' && handleFontDraftBlur()}
                      disabled={!isWriteable}
                      className={styles.fontSizeNumberInput}
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--text-2)] margin-0 leading-relaxed">
                  يتحكم بحجم خط أسماء الجوائز داخل قطاعات العجلة على الشاشة المرجعية (480px)، ويكون مقياساً تناسبياً لأحجام الشاشات المختلفة مع قطع الأسماء الطويلة (...).
                </p>
              </div>

              {/* Add New Prize */}
              <div className={styles.card}>
                <label htmlFor="new-prize-input" className={styles.sectionTitle}>
                  إضافة جائزة جديدة
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="new-prize-input"
                    type="text"
                    className={styles.input}
                    value={newPrizeName}
                    onChange={(e) => setNewPrizeName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPrize()}
                    disabled={!isWriteable}
                    placeholder="أدخل اسم الجائزة..."
                  />
                  <button
                    type="button"
                    onClick={handleAddPrize}
                    disabled={!isWriteable || !newPrizeName.trim()}
                    className={`${styles.btn} ${styles.btnViolet}`}
                  >
                    <Plus className="size-4" />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>

              {/* Editable Prizes Table */}
              <div className={styles.card}>
                <div className={styles.sectionTitle}>
                  <span>جدول الجوائز والأوزان والاحتمالات</span>
                  <span className={styles.badgeCount}>العدد: {state.prizes.length}</span>
                </div>

                {state.prizes.length === 0 ? (
                  <p className="text-center text-sm text-[var(--text-2)] py-8">
                    لا توجد جوائز مسجلة. قم بإضافة جائزة جديدة أعلاه.
                  </p>
                ) : (
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th} style={{ width: '45px' }}>#</th>
                          <th className={styles.th}>اسم الجائزة</th>
                          <th className={styles.th} style={{ minWidth: '180px' }}>الوزن (0-100)</th>
                          <th className={styles.th} style={{ minWidth: '130px' }}>الاحتمالية المحسوبة</th>
                          <th className={styles.th} style={{ width: '60px' }}>حذف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.prizes.map((prize, idx) => {
                          const weight = state.prizeWeights[idx] ?? 10;
                          const probNum = totalWeight > 0 ? (weight / totalWeight) * 100 : 100 / state.prizes.length;
                          const probStr = probNum.toFixed(1);
                          const draftName = prizeDrafts[idx] ?? prize;
                          const draftWeight = weightDrafts[idx] ?? String(weight);
                          const isInvalidName = draftName.trim().length === 0;

                          return (
                            <tr key={idx} className={styles.tr}>
                              <td className={styles.td}>
                                <span className="font-bold text-xs text-purple-400 font-mono">#{idx + 1}</span>
                              </td>
                              <td className={styles.td}>
                                <input
                                  type="text"
                                  aria-label={`اسم الجائزة رقم ${idx + 1}`}
                                  className={`${styles.prizeNameInput} ${
                                    isInvalidName ? styles.prizeNameInputInvalid : ''
                                  }`}
                                  value={draftName}
                                  onChange={(e) => handlePrizeDraftChange(idx, e.target.value)}
                                  onBlur={() => handlePrizeDraftBlur(idx)}
                                  onKeyDown={(e) => e.key === 'Enter' && handlePrizeDraftBlur(idx)}
                                  disabled={!isWriteable}
                                  placeholder="اسم الجائزة..."
                                />
                              </td>
                              <td className={styles.td}>
                                <div className={styles.weightControls}>
                                  <input
                                    type="number"
                                    aria-label={`وزن الجائزة الرقمي رقم ${idx + 1}`}
                                    min={0}
                                    max={100}
                                    value={draftWeight}
                                    onChange={(e) => handleWeightDraftChange(idx, e.target.value)}
                                    onBlur={() => handleWeightDraftBlur(idx)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleWeightDraftBlur(idx)}
                                    disabled={!isWriteable}
                                    className={styles.weightNumberInput}
                                  />
                                  <input
                                    type="range"
                                    aria-label={`شريط وزن الجائزة رقم ${idx + 1}`}
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={weight}
                                    onChange={(e) =>
                                      handleWeightSliderChange(idx, parseInt(e.target.value, 10))
                                    }
                                    disabled={!isWriteable}
                                    className={styles.rangeInput}
                                  />
                                </div>
                              </td>
                              <td className={styles.td}>
                                <span
                                  className={`${styles.probBadge} ${
                                    totalWeight === 0 ? styles.probBadgeEqual : ''
                                  }`}
                                >
                                  {probStr}% {totalWeight === 0 ? '(متساوي)' : ''}
                                </span>
                              </td>
                              <td className={styles.td}>
                                <button
                                  type="button"
                                  aria-label={`حذف الجائزة رقم ${idx + 1}: ${prize}`}
                                  onClick={() => handleDeletePrize(idx)}
                                  disabled={!isWriteable}
                                  className={styles.btnDanger}
                                  style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)' }}
                                  title={`حذف ${prize}`}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Help & Zero-Weight Explanation */}
              <div className={styles.helpBox}>
                <HelpCircle className={styles.helpIcon} />
                <div>
                  <strong className="block font-bold text-[var(--text-0)] mb-1">
                    طريقة حساب الاحتمالات وسلوك الوزن صفر (0):
                  </strong>
                  تُحسب احتمالية كل جائزة بقسمة وزنها الخاص على مجموع أوزان الجوائز. الوزن (0) يمنح الجائزة فرصة فوز (0%) طالما توجد جوائز بأوزان أكبر من الصفر. وعند ضبط كافة الأوزان إلى الصفر، تعود العجلة تلقائياً للتوزيع المتساوي الموحد.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOMERS */}
          {activeTab === 'customers' && (
            <div id="tabpanel-customers" role="tabpanel" aria-labelledby="tab-customers" className="space-y-4">
              <div className={styles.card}>
                <h3 className={styles.sectionTitle}>إعدادات سحب العملاء</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contest-title-customers-input" className={styles.fieldLabel}>
                      عنوان المسابقة (يظهر في أعلى الشاشة)
                    </label>
                    <input
                      id="contest-title-customers-input"
                      type="text"
                      className={styles.input}
                      value={state.contestTitleCustomers}
                      onChange={(e) => updateState({ contestTitleCustomers: e.target.value })}
                      disabled={!isWriteable}
                      placeholder="سحب عشوائي للعملاء..."
                    />
                  </div>
                  <div>
                    <label htmlFor="target-prize-input" className={styles.fieldLabel}>
                      اسم الجائزة المستهدفة
                    </label>
                    <input
                      id="target-prize-input"
                      type="text"
                      className={styles.input}
                      value={state.targetPrize}
                      onChange={(e) => updateState({ targetPrize: e.target.value })}
                      disabled={!isWriteable}
                      placeholder="عازل حراري كامل..."
                    />
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.sectionTitle}>
                  <label htmlFor="customers-textarea">أسماء المشاركين (اسم في كل سطر)</label>
                  <span className={styles.badgeCount}>العدد: {state.customers.length}</span>
                </div>

                <textarea
                  id="customers-textarea"
                  rows={10}
                  className={styles.textarea}
                  value={customersText}
                  onChange={(e) => handleCustomersTextChange(e.target.value)}
                  disabled={!isWriteable}
                  placeholder="أدخل أسماء المشاركين هنا، اسم واحد في كل سطر..."
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleShuffleCustomers}
                      disabled={!isWriteable || !state.customers.length}
                      className={`${styles.btn} ${styles.btnSecondary}`}
                    >
                      <Shuffle className="size-4 text-sky-400" />
                      <span>خلط عشوائي</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearCustomers}
                      disabled={!isWriteable || !state.customers.length}
                      className={styles.btnDanger}
                    >
                      <Trash2 className="size-4" />
                      <span>مسح الكل</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label
                      className={`${styles.btn} ${styles.btnSecondary} cursor-pointer ${
                        !isWriteable ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      <Upload className="size-4 text-sky-400" />
                      <span>استيراد TXT/JSON</span>
                      <input
                        type="file"
                        aria-label="استيراد أسماء المشاركين من ملف"
                        accept=".txt,.json"
                        onChange={handleImportCustomers}
                        className="hidden"
                        disabled={!isWriteable}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleExportCustomers}
                      disabled={!state.customers.length}
                      className={`${styles.btn} ${styles.btnSecondary}`}
                    >
                      <Download className="size-4 text-emerald-400" />
                      <span>تصدير ملف TXT</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <h3 className={styles.sectionTitle}>نماذج أسماء جاهزة</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleLoadPresetCustomers('employees')}
                    disabled={!isWriteable}
                    className={`${styles.btn} ${styles.btnSecondary} justify-between text-right`}
                  >
                    <span>قائمة موظفي هافركامب (10 أسماء)</span>
                    <Users className="size-4 text-sky-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadPresetCustomers('numbers50')}
                    disabled={!isWriteable}
                    className={`${styles.btn} ${styles.btnSecondary} justify-between text-right`}
                  >
                    <span>50 كوبون سحب مرقّم (من 1001 إلى 1050)</span>
                    <Ticket className="size-4 text-amber-400" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SETTINGS */}
          {activeTab === 'settings' && (
            <div
              id="tabpanel-settings"
              role="tabpanel"
              aria-labelledby="tab-settings"
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* Wheel & Animation Settings */}
              <div className={styles.card}>
                <h3 className={styles.sectionTitle}>إعدادات الدوران والمظهر</h3>

                <div className={styles.fieldGroup}>
                  <div className={styles.fieldLabel}>
                    <label htmlFor="duration-slider">مدة الدوران (بالثواني)</label>
                    <span className="font-mono text-sky-400 font-bold">{state.duration}s</span>
                  </div>
                  <input
                    id="duration-slider"
                    type="range"
                    aria-label="مدة الدوران بالثواني"
                    min={3}
                    max={20}
                    value={state.duration}
                    onChange={(e) => updateState({ duration: parseInt(e.target.value, 10) })}
                    disabled={!isWriteable}
                    className={styles.rangeInput}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <div className={styles.fieldLabel}>
                    <label htmlFor="rotations-slider">عدد اللفات (سرعة العجلة)</label>
                    <span className="font-mono text-sky-400 font-bold">{state.rotations} دورات</span>
                  </div>
                  <input
                    id="rotations-slider"
                    type="range"
                    aria-label="عدد لفات العجلة"
                    min={4}
                    max={15}
                    value={state.rotations}
                    onChange={(e) => updateState({ rotations: parseInt(e.target.value, 10) })}
                    disabled={!isWriteable}
                    className={styles.rangeInput}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="style-mode-select" className={styles.fieldLabel}>
                    نمط التلوين والمظهر البصري
                  </label>
                  <select
                    id="style-mode-select"
                    value={state.styleMode}
                    onChange={(e) =>
                      updateState({ styleMode: e.target.value as WinnerDrawState['styleMode'] })
                    }
                    disabled={!isWriteable}
                    className={styles.input}
                  >
                    <option value="vibrant">زاهٍ فاخر (Vibrant)</option>
                    <option value="duotone">كحلي وأزرق (Duotone Slate)</option>
                    <option value="pastel">باستيل هادئ (Pastel Soft)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-[var(--line)]">
                  <label htmlFor="auto-remove-checkbox" className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      id="auto-remove-checkbox"
                      type="checkbox"
                      checked={state.autoRemove}
                      onChange={(e) => updateState({ autoRemove: e.target.checked })}
                      disabled={!isWriteable}
                      className="rounded border-[var(--line)] text-sky-500 focus:ring-sky-500"
                    />
                    <span className="text-xs font-bold text-[var(--text-0)]">
                      استبعاد الفائز تلقائياً عند إغلاق النافذة (سحب العملاء فقط)
                    </span>
                  </label>
                </div>
              </div>

              {/* Sound & Celebration Settings */}
              <div className={styles.card}>
                <h3 className={styles.sectionTitle}>إعدادات الصوت والاحتفال</h3>

                <div className={styles.fieldGroup}>
                  <label htmlFor="celebration-style-select" className={styles.fieldLabel}>
                    نمط المؤثرات البصرية (Confetti)
                  </label>
                  <select
                    id="celebration-style-select"
                    value={state.celebrationStyle}
                    onChange={(e) =>
                      updateState({
                        celebrationStyle: e.target.value as WinnerDrawState['celebrationStyle'],
                      })
                    }
                    disabled={!isWriteable}
                    className={styles.input}
                  >
                    <option value="fireworks">ألعاب نارية (Fireworks)</option>
                    <option value="golden_stars">نجوم ذهبية (Golden Stars)</option>
                    <option value="confetti">قصاصات ملونة (Classic Confetti)</option>
                    <option value="none">بدون مؤثرات بصرية (None)</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="celebration-duration-select" className={styles.fieldLabel}>
                    مدة عرض نافذة الفائز
                  </label>
                  <select
                    id="celebration-duration-select"
                    value={state.celebrationDuration}
                    onChange={(e) =>
                      updateState({
                        celebrationDuration: e.target.value as WinnerDrawState['celebrationDuration'],
                      })
                    }
                    disabled={!isWriteable}
                    className={styles.input}
                  >
                    <option value="5000">5 ثوانٍ</option>
                    <option value="10000">10 ثوانٍ (افتراضي)</option>
                    <option value="15000">15 ثانية</option>
                    <option value="until_closed">حتى الإغلاق اليدوي</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="victory-sound-select" className={styles.fieldLabel}>
                    صوت الفوز والنصر (Synth)
                  </label>
                  <select
                    id="victory-sound-select"
                    value={state.victorySound}
                    onChange={(e) =>
                      updateState({
                        victorySound: e.target.value as WinnerDrawState['victorySound'],
                      })
                    }
                    disabled={!isWriteable}
                    className={styles.input}
                  >
                    <option value="fanfare">معزوفة النصر (Fanfare)</option>
                    <option value="applause">تصفيق الجماهير (Applause)</option>
                    <option value="chimes">أجراس متلألئة (Chimes)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Live Canvas Wheel Preview Sidebar */}
        <div className={styles.previewSidebar}>
          <div className={styles.stickyPreviewCard}>
            <div className={styles.previewHeader}>
              <div className={styles.previewTitle}>
                <Sparkles className="size-4 text-amber-400" />
                <span>
                  معاينة العجلة (تبويب {activeTab === 'prizes' ? 'الجوائز' : activeTab === 'customers' ? 'العملاء' : 'الإعدادات'})
                </span>
              </div>
              <div className={styles.previewMeta}>
                <span className={styles.badgeCount}>
                  القطاعات: {previewItems.length}
                </span>
                {!isPreviewMatchingLiveMode && (
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    الفرع: {state.isPrizeMode ? 'الجوائز' : 'العملاء'}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.previewCanvasWrapper}>
              <canvas
                ref={previewCanvasRef}
                className={styles.previewCanvas}
                role="img"
                aria-label="معاينة حية لعجلة السحب"
              />
            </div>

            <p className={styles.previewNote}>
              {`معاينة بصرية مباشرة للتلوين، القطاعات المتساوية الهندسة، وحجم النص (${
                state.wheelFontSize ?? 18
              }px). ملاحظة: الأوزان تؤثر على احتمالية توقف القرعة ولا تغير التساوي الهندسي لقطاعات العجلة.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
