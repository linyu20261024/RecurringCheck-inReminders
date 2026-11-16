import React, { useState, useMemo } from 'react';
import { TaskRecord, TaskRule, AppDataBackup } from '../types';
import { getTodayString, formatGregorianYearlyText, getRulePeriodCapUsage } from '../services/dataStorage';
import { getLunarDateInfo, getWeekDateRange, formatLunarScheduleText } from '../services/lunarCalendar';
import { QuickCheckInModal } from './QuickCheckInModal';
import {
  CheckCircle2,
  Circle,
  Clock,
  Ban,
  Layers,
  LayoutGrid,
  List,
  ArrowRight,
  Search,
  CheckCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  CalendarOff,
  Moon,
  Sparkles,
  Bell,
  RotateCcw,
  X,
} from 'lucide-react';

interface TaskRemindersViewProps {
  data: AppDataBackup;
  currentDate: string; // YYYY-MM-DD
  onDateChange: (newDate: string) => void;
  onUpdateRecord: (updatedRecord: TaskRecord, skipRestOfMonth?: boolean) => void;
  onBatchUpdateRecords: (updatedRecords: TaskRecord[]) => void;
  onSkipMonthRemaining?: (ruleId: string, fromDate: string) => void;
  undoBanner?: { label: string } | null;
  onUndoLastAction?: () => void;
  onDismissUndo?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

type ViewMode = 'platform' | 'category' | 'flat';
type StatusFilter = 'all' | 'pending' | 'timeSensitive' | 'done' | 'skipped';
type SortMode = 'time' | 'default';

export const TaskRemindersView: React.FC<TaskRemindersViewProps> = ({
  data,
  currentDate,
  onDateChange,
  onUpdateRecord,
  onBatchUpdateRecords,
  onSkipMonthRemaining,
  undoBanner,
  onUndoLastAction,
  onDismissUndo,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('platform');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [activeCheckInRecord, setActiveCheckInRecord] = useState<TaskRecord | null>(null);
  const [copiedPathId, setCopiedPathId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

  // Time-sensitive & Time-based sorting controls
  const [timeSensitiveFirst, setTimeSensitiveFirst] = useState<boolean>(true);
  const [sortByTime, setSortByTime] = useState<boolean>(true);

  // Dynamic today string (e.g. 2026-11-07)
  const todayStr = useMemo(() => getTodayString(), []);

  // Lunar and 24 Solar Terms info for the currently inspected date
  const lunarInfo = useMemo(() => getLunarDateInfo(currentDate), [currentDate]);

  // Week range for currentDate
  const weekRange = useMemo(() => getWeekDateRange(currentDate), [currentDate]);

  // Rule lookup map
  const rulesMap = useMemo(() => {
    const map = new Map<string, TaskRule>();
    data.rules.forEach((r) => map.set(r.id, r));
    return map;
  }, [data.rules]);

  // Current natural month prefix: e.g. "2026-11"
  const currentMonthPrefix = useMemo(() => currentDate.slice(0, 7), [currentDate]);

  // Map of completed count in current natural month
  const ruleMonthlyDoneCountMap = useMemo(() => {
    const map = new Map<string, number>();
    data.records.forEach((r) => {
      if (r.status === 'done' && r.date.startsWith(currentMonthPrefix)) {
        map.set(r.ruleId, (map.get(r.ruleId) || 0) + 1);
      }
    });
    return map;
  }, [data.records, currentMonthPrefix]);

  // Map of completed count in current natural week
  const ruleWeeklyDoneCountMap = useMemo(() => {
    const map = new Map<string, number>();
    data.records.forEach((r) => {
      if (r.status === 'done' && r.date >= weekRange.startOfWeek && r.date <= weekRange.endOfWeek) {
        map.set(r.ruleId, (map.get(r.ruleId) || 0) + 1);
      }
    });
    return map;
  }, [data.records, weekRange]);

  // Map of completed count in current 24 solar term window
  const ruleSolarTermDoneCountMap = useMemo(() => {
    const map = new Map<string, number>();
    const { startDate, endDate } = lunarInfo.currentSolarTerm;
    data.records.forEach((r) => {
      if (r.status === 'done' && r.date >= startDate && r.date <= endDate) {
        map.set(r.ruleId, (map.get(r.ruleId) || 0) + 1);
      }
    });
    return map;
  }, [data.records, lunarInfo]);

  // Map of period cap usage per rule for currentDate
  const rulePeriodCapMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getRulePeriodCapUsage>>();
    data.rules.forEach((rule) => {
      if (rule.periodCapAmount && rule.periodCapAmount > 0) {
        map.set(rule.id, getRulePeriodCapUsage(rule, currentDate, data.records));
      }
    });
    return map;
  }, [data.rules, data.records, currentDate]);

  // Records for current date
  const todayRecords = useMemo(() => {
    return data.records.filter((r) => r.date === currentDate);
  }, [data.records, currentDate]);

  // Helper to determine if a record is time-sensitive (checks record or fallback to rule)
  const isRecordTimeSensitive = (rec: TaskRecord): boolean => {
    if (rec.timeSensitive !== undefined) return rec.timeSensitive;
    const rule = rulesMap.get(rec.ruleId);
    return !!rule?.timeSensitive;
  };

  // Helper to get effective scheduled time string (e.g. "08:00")
  const getRecordTime = (rec: TaskRecord): string => {
    if (rec.time) return rec.time;
    const rule = rulesMap.get(rec.ruleId);
    return rule?.time || '09:00';
  };

  // Record sorting comparator:
  // 1. Pending tasks first (if status is different, pending precedes done/skipped)
  // 2. If timeSensitiveFirst is on, time-sensitive tasks come before regular tasks
  // 3. If sortByTime is on, sort chronologically by time string (e.g. "08:00" < "10:00")
  // 4. Fallback to name
  const sortRecords = (list: TaskRecord[]): TaskRecord[] => {
    return [...list].sort((a, b) => {
      // 1. Pending priority: pending tasks should always be attended to before done
      const aPending = a.status === 'pending' ? 1 : 0;
      const bPending = b.status === 'pending' ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;

      // 2. Time-sensitive priority (if enabled)
      if (timeSensitiveFirst) {
        const aTs = isRecordTimeSensitive(a) ? 1 : 0;
        const bTs = isRecordTimeSensitive(b) ? 1 : 0;
        if (aTs !== bTs) return bTs - aTs;
      }

      // 3. Time chronological ordering (if enabled)
      if (sortByTime) {
        const timeA = getRecordTime(a);
        const timeB = getRecordTime(b);
        if (timeA !== timeB) return timeA.localeCompare(timeB);
      }

      return a.name.localeCompare(b.name, 'zh-CN');
    });
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    const list = todayRecords.filter((rec) => {
      // Status filter
      if (statusFilter === 'pending' && rec.status !== 'pending') return false;
      if (statusFilter === 'done' && rec.status !== 'done') return false;
      if (statusFilter === 'skipped' && rec.status !== 'skipped' && rec.status !== 'canceled') return false;
      if (statusFilter === 'timeSensitive') {
        const ts = isRecordTimeSensitive(rec);
        if (!ts) return false;
      }

      // Platform filter
      if (selectedPlatform !== 'all' && rec.platform !== selectedPlatform) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const rule = rulesMap.get(rec.ruleId);
        const nameMatch = rec.name.toLowerCase().includes(q);
        const platMatch = rec.platform.toLowerCase().includes(q);
        const catMatch = rec.category.toLowerCase().includes(q);
        const pathMatch = (rec.path || rule?.path || '').toLowerCase().includes(q);
        if (!nameMatch && !platMatch && !catMatch && !pathMatch) return false;
      }

      return true;
    });

    return sortRecords(list);
  }, [todayRecords, statusFilter, selectedPlatform, searchQuery, rulesMap, timeSensitiveFirst, sortByTime]);

  // All distinct platforms for current date
  const platformsList = useMemo(() => {
    const set = new Set<string>();
    todayRecords.forEach((r) => set.add(r.platform));
    return Array.from(set).sort();
  }, [todayRecords]);

  // Summary Metrics for currentDate
  const metrics = useMemo(() => {
    const total = todayRecords.length;
    const done = todayRecords.filter((r) => r.status === 'done').length;
    const pending = todayRecords.filter((r) => r.status === 'pending').length;
    const skipped = todayRecords.filter((r) => r.status === 'skipped' || r.status === 'canceled').length;
    const timeSensitiveCount = todayRecords.filter((r) => isRecordTimeSensitive(r)).length;
    const timeSensitivePending = todayRecords.filter((r) => isRecordTimeSensitive(r) && r.status === 'pending').length;

    let actualCny = 0;
    let expectedCny = 0;

    todayRecords.forEach((r) => {
      if (r.currency === 'CNY') {
        if (r.status === 'done') actualCny += r.actual || 0;
        expectedCny += r.expected || 0;
      }
    });

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      total,
      done,
      pending,
      skipped,
      timeSensitiveCount,
      timeSensitivePending,
      actualCny: Math.round(actualCny * 100) / 100,
      expectedCny: Math.round(expectedCny * 100) / 100,
      completionRate,
    };
  }, [todayRecords, rulesMap]);

  // Grouping by Platform
  const recordsByPlatform = useMemo(() => {
    const groups: Record<string, TaskRecord[]> = {};
    filteredRecords.forEach((r) => {
      if (!groups[r.platform]) groups[r.platform] = [];
      groups[r.platform].push(r);
    });

    // Ensure items within each platform follow sortRecords order
    Object.keys(groups).forEach((key) => {
      groups[key] = sortRecords(groups[key]);
    });

    // Sort platforms:
    // 1. Platforms with pending time-sensitive tasks come first
    // 2. Platforms with higher pending count
    // 3. Total count
    return Object.entries(groups).sort((a, b) => {
      const tsPendingA = a[1].filter((r) => r.status === 'pending' && isRecordTimeSensitive(r)).length;
      const tsPendingB = b[1].filter((r) => r.status === 'pending' && isRecordTimeSensitive(r)).length;
      if (tsPendingA !== tsPendingB) return tsPendingB - tsPendingA;

      const pendingA = a[1].filter((r) => r.status === 'pending').length;
      const pendingB = b[1].filter((r) => r.status === 'pending').length;
      if (pendingA !== pendingB) return pendingB - pendingA;

      return b[1].length - a[1].length;
    });
  }, [filteredRecords, timeSensitiveFirst, sortByTime, rulesMap]);

  // Grouping by Category
  const recordsByCategory = useMemo(() => {
    const groups: Record<string, TaskRecord[]> = {};
    filteredRecords.forEach((r) => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });

    Object.keys(groups).forEach((key) => {
      groups[key] = sortRecords(groups[key]);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredRecords, timeSensitiveFirst, sortByTime, rulesMap]);

  const formatCapUnit = (val: number, currency: TaskRecord['currency']) => {
    if (currency === 'CNY') return `¥${val}`;
    if (currency === 'points') return `${val}分`;
    return `${val}`;
  };

  // Build a cleanly restored pending record (clears completion earnings and auto-skip flags)
  const buildRestoredPendingRecord = (rec: TaskRecord): TaskRecord => {
    const hasAutoSkipFlag = !!(
      rec.monthlyLimitReached ||
      rec.weeklyLimitReached ||
      rec.solarTermLimitReached ||
      rec.advanceDoneSkipped ||
      rec.capReachedSkipped
    );
    return {
      ...rec,
      status: 'pending',
      actual: 0,
      completedAt: undefined,
      received: false,
      monthlyLimitReached: false,
      weeklyLimitReached: false,
      solarTermLimitReached: false,
      advanceDoneSkipped: false,
      capReachedSkipped: false,
      feedback: hasAutoSkipFlag ? '' : rec.feedback,
    };
  };

  // Explicit single-click restore to pending state
  const handleRestoreToPending = (record: TaskRecord) => {
    onUpdateRecord(buildRestoredPendingRecord(record), false);
  };

  // Quick 1-click single check-in toggle (pending -> done with actual=0 if unfilled; done/skipped/canceled -> pending)
  const handleQuickToggleDone = (record: TaskRecord) => {
    if (record.status !== 'pending') {
      handleRestoreToPending(record);
      return;
    }

    const rule = rulesMap.get(record.ruleId);
    const now = new Date().toISOString();

    const updated: TaskRecord = {
      ...record,
      status: 'done',
      actual: 0,
      completedAt: now,
      received: false,
    };

    // If it's a period limit, period cap, or advance-reminder rule and user completed it, evaluate auto-skip
    const autoSkipPeriod =
      (!!rule?.monthlyLimit && rule.monthlyLimit > 0) ||
      (!!rule?.weeklyLimit && rule.weeklyLimit > 0) ||
      (!!rule?.solarTermLimit && rule.solarTermLimit > 0) ||
      (!!rule?.periodCapAmount && rule.periodCapAmount > 0) ||
      (!!rule?.remindAdvanceDays && rule.remindAdvanceDays > 0);
    onUpdateRecord(updated, autoSkipPeriod);
  };

  // Batch complete all pending in a platform (actual defaults to 0 when unfilled)
  const handleBatchCompletePlatform = (_platformName: string, records: TaskRecord[]) => {
    const pendingList = records.filter((r) => r.status === 'pending');
    if (pendingList.length === 0) return;

    const now = new Date().toISOString();
    const updatedList: TaskRecord[] = pendingList.map((rec) => ({
      ...rec,
      status: 'done',
      actual: 0,
      completedAt: now,
      received: false,
    }));

    onBatchUpdateRecords(updatedList);
  };

  // Batch action for multi-selected records
  const handleBatchAction = (targetStatus: 'done' | 'skipped' | 'pending') => {
    if (selectedRecordIds.size === 0) return;
    const now = new Date().toISOString();
    const toUpdate: TaskRecord[] = [];

    todayRecords.forEach((rec) => {
      if (selectedRecordIds.has(rec.id)) {
        if (targetStatus === 'pending') {
          toUpdate.push(buildRestoredPendingRecord(rec));
          return;
        }
        toUpdate.push({
          ...rec,
          status: targetStatus,
          actual: 0,
          completedAt: targetStatus === 'done' ? now : undefined,
          received: false,
        });
      }
    });

    onBatchUpdateRecords(toUpdate);
    setSelectedRecordIds(new Set());
  };

  // Date step controls
  const handleStepDate = (days: number) => {
    const d = new Date(`${currentDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    onDateChange(`${y}-${m}-${day}`);
  };

  const handleCopyPath = (pathText: string, id: string) => {
    navigator.clipboard.writeText(pathText);
    setCopiedPathId(id);
    setTimeout(() => setCopiedPathId(null), 1500);
  };

  const toggleSelectAll = () => {
    if (selectedRecordIds.size === filteredRecords.length) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top Banner: Ultra-compact on mobile to maximize viewport task density */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3 sm:p-5">
        {/* Row 1: Date Switcher & Compact Stats */}
        <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3.5 border-b border-slate-100 flex-wrap">
          {/* Date controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center bg-slate-100/90 p-0.5 sm:p-1 rounded-xl border border-slate-200/70">
              <button
                type="button"
                onClick={() => handleStepDate(-1)}
                className="p-1 sm:p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
                title="前一天"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <div className="flex items-center gap-1 px-1.5 sm:px-2.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => e.target.value && onDateChange(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 text-xs sm:text-sm focus:outline-hidden cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => handleStepDate(1)}
                className="p-1 sm:p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
                title="后一天"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {currentDate !== todayStr && (
              <button
                type="button"
                onClick={() => onDateChange(todayStr)}
                className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100 shrink-0"
              >
                回今日
              </button>
            )}

            {/* Lunar Calendar & 24 Solar Terms Display Pill */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50/80 border border-amber-200/70 rounded-xl text-xs text-amber-900 shrink-0">
              <Moon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="font-medium text-[11px] sm:text-xs">
                {lunarInfo.yearGanZhi}({lunarInfo.yearShengXiao})年 · {lunarInfo.monthInChinese}{lunarInfo.dayInChinese}
              </span>
              {lunarInfo.solarTerm ? (
                <span className="px-1.5 py-0.2 rounded-md bg-rose-600 text-white font-bold text-[10px] shadow-2xs flex items-center gap-0.5 animate-pulse">
                  <Sparkles className="w-2.5 h-2.5" />
                  今日【{lunarInfo.solarTerm}】节气
                </span>
              ) : (
                <span className="text-[10px] text-amber-700/80 hidden md:inline font-mono">
                  [{lunarInfo.currentSolarTerm.name}节气期]
                </span>
              )}
            </div>
          </div>

          {/* Quick Metrics (High density) */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs font-medium">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px]">进度:</span>
              <span className="font-bold text-slate-800 tabular-nums text-xs">
                {metrics.done}/{metrics.total}
              </span>
              <span className="px-1.5 py-0.2 rounded-sm text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                {metrics.completionRate}%
              </span>
            </div>

            <div className="h-3 w-px bg-slate-200" />

            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px]">实得:</span>
              <span className="font-bold text-indigo-700 tabular-nums text-xs sm:text-sm">
                ¥{metrics.actualCny.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Status Filter Chips & View Mode Switcher */}
        <div className="pt-2.5 sm:pt-3 flex flex-wrap items-center justify-between gap-2">
          {/* Status Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              全部 ({metrics.total})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Circle className="w-2.5 h-2.5 fill-current" />
              待办 ({metrics.pending})
            </button>
            {metrics.timeSensitiveCount > 0 && (
              <button
                onClick={() => setStatusFilter('timeSensitive')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                  statusFilter === 'timeSensitive'
                    ? 'bg-rose-600 text-white shadow-2xs ring-2 ring-rose-200'
                    : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70'
                }`}
                title="只看时间敏感/限时抢券等时效任务"
              >
                <Clock className="w-3 h-3" />
                时间敏感 ({metrics.timeSensitivePending}/{metrics.timeSensitiveCount})
              </button>
            )}
            <button
              onClick={() => setStatusFilter('done')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                statusFilter === 'done'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              已完成 ({metrics.done})
            </button>
            <button
              onClick={() => setStatusFilter('skipped')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === 'skipped'
                  ? 'bg-slate-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              跳过 ({metrics.skipped})
            </button>
          </div>

          {/* Search & Platform Filter & Sort Controls & View Modes */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap sm:flex-nowrap">
            {/* Quick Sort Toggles */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setTimeSensitiveFirst((prev) => !prev)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                  timeSensitiveFirst ? 'bg-rose-100 text-rose-800 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="开启后将时间敏感活动优先置顶展示"
              >
                <span>⏰ 敏感优先</span>
                <span className={`w-1.5 h-1.5 rounded-full ${timeSensitiveFirst ? 'bg-rose-600' : 'bg-slate-300'}`} />
              </button>
              <button
                type="button"
                onClick={() => setSortByTime((prev) => !prev)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                  sortByTime ? 'bg-indigo-100 text-indigo-800 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="开启后按照预设时间（08:00 -> 10:00 -> 12:00 等）顺序排列"
              >
                <span>按时间排序</span>
                <span className={`w-1.5 h-1.5 rounded-full ${sortByTime ? 'bg-indigo-600' : 'bg-slate-300'}`} />
              </button>
            </div>

            {/* Search */}
            <div className="relative flex-1 sm:w-36">
              <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索任务/App..."
                className="w-full pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Platform Dropdown */}
            {platformsList.length > 0 && (
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-700 py-1 px-2 rounded-lg focus:outline-hidden"
              >
                <option value="all">全平台</option>
                {platformsList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('platform')}
                className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
                  viewMode === 'platform' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
                }`}
                title="按 App 聚合办理"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden md:inline">App聚合</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('category')}
                className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
                  viewMode === 'category' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
                }`}
                title="按分类分组"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline">分类</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
                  viewMode === 'flat' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
                }`}
                title="平铺列表"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden md:inline">列表</span>
              </button>
            </div>
          </div>
        </div>

        {/* Multi-selection Bar */}
        {selectedRecordIds.size > 0 && (
          <div className="mt-2.5 p-2 bg-indigo-50/90 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
            <span className="text-xs font-semibold text-indigo-900">
              已选 {selectedRecordIds.size} 项
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleBatchAction('pending')}
                className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                批量恢复待办
              </button>
              <button
                type="button"
                onClick={() => handleBatchAction('done')}
                className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" />
                批量完成
              </button>
              <button
                type="button"
                onClick={() => handleBatchAction('skipped')}
                className="px-2.5 py-1 bg-slate-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                <Clock className="w-3 h-3" />
                批量跳过
              </button>
              <button
                type="button"
                onClick={() => setSelectedRecordIds(new Set())}
                className="text-xs text-slate-500 px-1.5 py-1"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Undo Last Action Toast Banner */}
      {undoBanner && onUndoLastAction && (
        <div className="bg-slate-900 text-white rounded-xl px-3.5 py-2.5 shadow-md flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate font-medium">{undoBanner.label}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onUndoLastAction}
              className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              撤销刚才操作
            </button>
            {onDismissUndo && (
              <button
                type="button"
                onClick={onDismissUndo}
                className="p-1 text-slate-400 hover:text-white rounded-md"
                title="关闭提示"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Task List / Aggregated Groups */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center">
          <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-500 mx-auto mb-2 sm:mb-3 opacity-80" />
          <h4 className="text-sm sm:text-base font-bold text-slate-800">
            {todayRecords.length === 0 ? '该日期无周期任务安排' : '当前筛选条件下无任务'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {todayRecords.length === 0
              ? '可通过顶部日期选择或在规则管理中添加该日期的周期规则。'
              : '尝试调整筛选状态或清空搜索关键词。'}
          </p>
        </div>
      ) : viewMode === 'platform' ? (
        /* PLATFORM AGGREGATED VIEW (HIGH DENSITY FOR MOBILE PHONES) */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              按 App 集中办理（共 <strong className="text-slate-800 font-semibold">{recordsByPlatform.length}</strong> 个应用）
            </span>
            <button
              onClick={toggleSelectAll}
              className="text-indigo-600 hover:text-indigo-700 font-medium text-xs"
            >
              {selectedRecordIds.size === filteredRecords.length ? '取消全选' : '全选所有'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:gap-3.5">
            {recordsByPlatform.map(([platformName, records]) => {
              const pendingCount = records.filter((r) => r.status === 'pending').length;
              const doneCount = records.filter((r) => r.status === 'done').length;
              const actualTotal = records.reduce(
                (acc, r) => (r.currency === 'CNY' && r.status === 'done' ? acc + (r.actual || 0) : acc),
                0
              );

              return (
                <div
                  key={platformName}
                  className={`bg-white rounded-xl sm:rounded-2xl border transition-all ${
                    pendingCount === 0
                      ? 'border-slate-200/60 bg-slate-50/40 opacity-90'
                      : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
                  }`}
                >
                  {/* Platform Card Header (Compact on mobile) */}
                  <div className="px-3.5 py-2 sm:px-5 sm:py-3 bg-slate-50/80 rounded-t-xl sm:rounded-t-2xl border-b border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                        {platformName.slice(0, 1)}
                      </span>
                      <div className="flex items-center gap-1.5 truncate">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                          {platformName}
                        </h4>
                        <span className="text-slate-300">·</span>
                        <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                          {doneCount}/{records.length}
                        </span>
                        {actualTotal > 0 && (
                          <span className="text-[11px] font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                            (已入账 ¥{actualTotal.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Batch Complete for this Platform */}
                    {pendingCount > 0 && (
                        <button
                        type="button"
                        onClick={() => handleBatchCompletePlatform(platformName, records)}
                        className="px-2 sm:px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0"
                        title="一键将该 App 内所有待办任务标记为已完成（未填实际收益默认记为 0）"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>一键打卡 ({pendingCount})</span>
                      </button>
                    )}
                  </div>

                  {/* Task Items inside Platform (Ultra compact touch rows) */}
                  <div className="divide-y divide-slate-100">
                    {records.map((rec) => {
                      const rule = rulesMap.get(rec.ruleId);
                      const isDone = rec.status === 'done';
                      const isSkipped = rec.status === 'skipped' || rec.status === 'canceled';
                      const pathText = rec.path || rule?.path;

                      // Check monthly limit
                      const isMonthlyLimitRule = !!rule?.monthlyLimit && rule.monthlyLimit > 0;
                      const doneTimesThisMonth = ruleMonthlyDoneCountMap.get(rec.ruleId) || 0;
                      const hasReachedMonthlyCap = isMonthlyLimitRule && doneTimesThisMonth >= (rule?.monthlyLimit || 1);

                      return (
                        <div
                          key={rec.id}
                          className={`px-3 py-2 sm:px-5 sm:py-3 flex items-center justify-between gap-2.5 transition-colors ${
                            isDone ? 'bg-emerald-50/20' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          {/* Left: Checkbox + Action toggle + Info */}
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            {/* Checkbox for batch */}
                            <input
                              type="checkbox"
                              checked={selectedRecordIds.has(rec.id)}
                              onChange={() => toggleSelectRecord(rec.id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            />

                            {/* Large Touch Target Status Button */}
                            <button
                              type="button"
                              onClick={() => handleQuickToggleDone(rec)}
                              className="p-1 -m-1 shrink-0 focus:outline-hidden"
                              title={
                                isDone
                                  ? '点击撤销完成并恢复待提醒'
                                  : isSkipped
                                    ? '点击恢复为待提醒状态'
                                    : '快捷一键完成'
                              }
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                              ) : rec.status === 'canceled' ? (
                                <Ban className="w-5 h-5 text-rose-400" />
                              ) : isSkipped ? (
                                <Clock className="w-5 h-5 text-amber-500" />
                              ) : (
                                <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500 transition-colors" />
                              )}
                            </button>

                            {/* Middle Info (Dense 2-line layout) */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-xs sm:text-sm font-semibold truncate ${
                                    isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                                  }`}
                                >
                                  {rec.name}
                                </span>

                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-medium">
                                  {rec.category}
                                </span>

                                {/* Scheduled Time Badge */}
                                {(rec.time || rule?.time) && (
                                  <span
                                    className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-md border flex items-center gap-0.5 ${
                                      isRecordTimeSensitive(rec)
                                        ? 'bg-rose-50 text-rose-700 border-rose-200/80 font-bold'
                                        : 'bg-slate-50 text-slate-600 border-slate-200/60'
                                    }`}
                                    title={`预设时间: ${rec.time || rule?.time || '09:00'}${
                                      (rec.deadline || rule?.deadline) && (rec.deadline || rule?.deadline) !== '23:59'
                                        ? ` ~ ${rec.deadline || rule?.deadline}`
                                        : ''
                                    }`}
                                  >
                                    <Clock className="w-2.5 h-2.5 shrink-0" />
                                    <span>{rec.time || rule?.time || '09:00'}</span>
                                    {(rec.deadline || rule?.deadline) && (rec.deadline || rule?.deadline) !== '23:59' && (
                                      <span className="opacity-75">~{rec.deadline || rule?.deadline}</span>
                                    )}
                                  </span>
                                )}

                                {/* Time Sensitive Tag */}
                                {isRecordTimeSensitive(rec) && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-500 text-white shadow-2xs animate-pulse"
                                    title="时效敏感任务：限时秒杀/抢券/固定时间窗口，请优先办理！"
                                  >
                                    ⏰ 限时敏感
                                  </span>
                                )}

                                {rec.priority === '高' && (
                                  <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200/50">
                                    高
                                  </span>
                                )}

                                {/* Special Monthly Limit Badge */}
                                {isMonthlyLimitRule && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border flex items-center gap-0.5 ${
                                      hasReachedMonthlyCap
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                    title={`该任务每个自然月仅需完成 ${rule?.monthlyLimit} 次`}
                                  >
                                    {hasReachedMonthlyCap ? `当月已达${rule?.monthlyLimit}次` : `月限${rule?.monthlyLimit}次`}
                                  </span>
                                )}

                                {/* Special Weekly Limit Badge */}
                                {rule?.weeklyLimit && rule.weeklyLimit > 0 && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border flex items-center gap-0.5 ${
                                      (ruleWeeklyDoneCountMap.get(rec.ruleId) || 0) >= rule.weeklyLimit
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}
                                    title={`该任务每个自然周仅需完成 ${rule.weeklyLimit} 次`}
                                  >
                                    {(ruleWeeklyDoneCountMap.get(rec.ruleId) || 0) >= rule.weeklyLimit
                                      ? `本周已达${rule.weeklyLimit}次`
                                      : `周限${rule.weeklyLimit}次`}
                                  </span>
                                )}

                                {/* Special Solar Term Limit Badge */}
                                {rule?.solarTermLimit && rule.solarTermLimit > 0 && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border flex items-center gap-0.5 ${
                                      (ruleSolarTermDoneCountMap.get(rec.ruleId) || 0) >= rule.solarTermLimit
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-purple-50 text-purple-700 border-purple-200'
                                    }`}
                                    title={`该任务每个节气周期（${lunarInfo.currentSolarTerm.name}）仅需完成 ${rule.solarTermLimit} 次`}
                                  >
                                    {(ruleSolarTermDoneCountMap.get(rec.ruleId) || 0) >= rule.solarTermLimit
                                      ? `${lunarInfo.currentSolarTerm.name}已达${rule.solarTermLimit}次`
                                      : `每节气限${rule.solarTermLimit}次`}
                                  </span>
                                )}

                                {/* Single & Period Benefit Cap Badges */}
                                {rule?.singleCapAmount && rule.singleCapAmount > 0 && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-teal-50 text-teal-700 border border-teal-200/80"
                                    title={`单次打卡优惠封顶 ${formatCapUnit(rule.singleCapAmount, rec.currency)}`}
                                  >
                                    单次封顶 {formatCapUnit(rule.singleCapAmount, rec.currency)}
                                  </span>
                                )}
                                {(() => {
                                  const cap = rulePeriodCapMap.get(rec.ruleId);
                                  if (!cap) return null;
                                  return (
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${
                                        cap.isCapReached
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-cyan-50 text-cyan-800 border-cyan-200/80'
                                      }`}
                                      title={`${cap.scopeLabel} ${formatCapUnit(cap.capAmount, rec.currency)}，累计已享 ${formatCapUnit(cap.usedAmount, rec.currency)}，剩余 ${formatCapUnit(cap.remainingAmount, rec.currency)}`}
                                    >
                                      {cap.isCapReached
                                        ? `${cap.scopeLabel}已满 ${formatCapUnit(cap.capAmount, rec.currency)}`
                                        : `${cap.scopeLabel} ${formatCapUnit(cap.usedAmount, rec.currency)}/${formatCapUnit(cap.capAmount, rec.currency)} (剩${formatCapUnit(cap.remainingAmount, rec.currency)})`}
                                    </span>
                                  );
                                })()}

                                {/* Yearly Gregorian Frequency indicator */}
                                {rule?.frequency === 'yearly' && (
                                  <span
                                    className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-200/70 flex items-center gap-0.5"
                                    title={formatGregorianYearlyText(rule.monthdays, rule.solarMonths)}
                                  >
                                    <Calendar className="w-2.5 h-2.5 text-rose-600" />
                                    公历年度
                                  </span>
                                )}

                                {/* Lunar Frequency indicator */}
                                {rule?.frequency === 'lunar' && (
                                  <span
                                    className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-amber-100/70 text-amber-800 flex items-center gap-0.5"
                                    title={formatLunarScheduleText(rule.lunarMonthdays, rule.lunarMonths)}
                                  >
                                    <Moon className="w-2.5 h-2.5 text-amber-600" />
                                    {rule.lunarMonths && rule.lunarMonths.length > 0 ? '农历年度' : '农历'}
                                  </span>
                                )}

                                {/* Advance Reminder / Target Date Countdown Badge */}
                                {rec.daysUntilTarget !== undefined && rec.daysUntilTarget > 0 && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-0.5"
                                    title={`正日日期为 ${rec.targetDate}，当前处于提前提醒期内`}
                                  >
                                    <Bell className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                                    提前提醒 · 距正日({(rec.targetDate || '').slice(5)})还有 {rec.daysUntilTarget} 天
                                  </span>
                                )}
                                {rec.daysUntilTarget === 0 &&
                                  ((rule?.remindAdvanceDays && rule.remindAdvanceDays > 0) ||
                                    rule?.frequency === 'lunar' ||
                                    rule?.frequency === 'yearly') && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                                      🎯 今日正日
                                    </span>
                                  )}
                              </div>

                              {/* App Internal Path Guidance */}
                              {pathText && (
                                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                  <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[200px] sm:max-w-md">{pathText}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPath(pathText, rec.id)}
                                    className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                                    title="复制路径"
                                  >
                                    {copiedPathId === rec.id ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Feedback / Notes */}
                              {rec.feedback && (
                                <div className="text-[10px] text-indigo-700 font-mono truncate">
                                  备注: {rec.feedback}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Yield & Fast Action */}
                          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                            {/* Yield display */}
                            <div className="text-right">
                              {rec.currency === 'CNY' ? (
                                <div className="text-xs font-bold tabular-nums text-slate-800">
                                  {isDone ? (
                                    <span className={(rec.actual ?? 0) > 0 ? 'text-emerald-700 font-bold' : 'text-slate-400 font-semibold'}>
                                      ¥{(rec.actual ?? 0).toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 font-medium" title="预期参考金额（未填实得直接打卡记为 ¥0.00）">
                                      预 ¥{(rec.expected ?? rule?.amount ?? 0).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs font-semibold tabular-nums text-amber-600">
                                  {isDone
                                    ? `${(rec.actual ?? 0).toLocaleString()} 分`
                                    : `预 ${(rec.expected ?? rule?.amount ?? 0).toLocaleString()} 分`}
                                </div>
                              )}
                            </div>

                            {/* Restore to pending button for completed/skipped/canceled items */}
                            {(isDone || isSkipped) && (
                              <button
                                type="button"
                                onClick={() => handleRestoreToPending(rec)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-colors shrink-0 ${
                                  isSkipped
                                    ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200'
                                    : 'bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border-slate-200'
                                }`}
                                title={isSkipped ? '恢复此任务到待提醒状态' : '撤回已完成状态并恢复待提醒'}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{isSkipped ? '恢复提醒' : '撤回'}</span>
                              </button>
                            )}

                            {/* Monthly Limit: One-click skip rest of month button */}
                            {isMonthlyLimitRule && !isSkipped && onSkipMonthRemaining && (
                              <button
                                type="button"
                                onClick={() => onSkipMonthRemaining(rec.ruleId, currentDate)}
                                className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                                title="本任务本月不再提醒（自动跳过当月后续待办）"
                              >
                                本月免提醒
                              </button>
                            )}

                            {/* Detail / Actual Earnings edit button */}
                            <button
                              type="button"
                              onClick={() => setActiveCheckInRecord(rec)}
                              className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors border border-slate-200 shrink-0"
                            >
                              详情
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'category' ? (
        /* CATEGORY VIEW */
        <div className="space-y-3">
          {recordsByCategory.map(([catName, records]) => {
            const pendingCount = records.filter((r) => r.status === 'pending').length;
            return (
              <div key={catName} className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800">{catName}</h4>
                    <span className="text-xs text-slate-500 font-medium">({records.length}项)</span>
                  </div>
                  {pendingCount > 0 && (
                    <span className="text-xs text-amber-600 font-semibold">{pendingCount} 项待办</span>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {records.map((rec) => {
                    const isDone = rec.status === 'done';
                    const isSkipped = rec.status === 'skipped' || rec.status === 'canceled';
                    const rule = rulesMap.get(rec.ruleId);
                    const cap = rulePeriodCapMap.get(rec.ruleId);
                    return (
                      <div
                        key={rec.id}
                        className={`px-3 py-2 sm:px-5 sm:py-3 flex items-center justify-between gap-2.5 ${
                          isDone ? 'bg-emerald-50/20' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedRecordIds.has(rec.id)}
                            onChange={() => toggleSelectRecord(rec.id)}
                            className="rounded border-slate-300 text-indigo-600 shrink-0"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickToggleDone(rec)}
                            className="focus:outline-hidden shrink-0"
                            title={
                              isDone
                                ? '点击撤销完成并恢复待提醒'
                                : isSkipped
                                  ? '点击恢复为待提醒状态'
                                  : '快捷一键完成'
                            }
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                            ) : rec.status === 'canceled' ? (
                              <Ban className="w-5 h-5 text-rose-400" />
                            ) : isSkipped ? (
                              <Clock className="w-5 h-5 text-amber-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700">
                                {rec.platform}
                              </span>
                              <span
                                className={`text-xs sm:text-sm font-semibold truncate ${
                                  isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                                }`}
                              >
                                {rec.name}
                              </span>

                              {(rec.time || rule?.time) && (
                                <span
                                  className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-md border flex items-center gap-0.5 ${
                                    isRecordTimeSensitive(rec)
                                      ? 'bg-rose-50 text-rose-700 border-rose-200/80 font-bold'
                                      : 'bg-slate-50 text-slate-600 border-slate-200/60'
                                  }`}
                                >
                                  <Clock className="w-2.5 h-2.5 shrink-0" />
                                  <span>{rec.time || rule?.time || '09:00'}</span>
                                  {(rec.deadline || rule?.deadline) && (rec.deadline || rule?.deadline) !== '23:59' && (
                                    <span className="opacity-75">~{rec.deadline || rule?.deadline}</span>
                                  )}
                                </span>
                              )}

                              {isRecordTimeSensitive(rec) && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-500 text-white shadow-2xs">
                                  ⏰ 限时敏感
                                </span>
                              )}

                              {rule?.monthlyLimit && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  月限{rule.monthlyLimit}次
                                </span>
                              )}

                              {rule?.weeklyLimit && rule.weeklyLimit > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  周限{rule.weeklyLimit}次
                                </span>
                              )}

                              {rule?.solarTermLimit && rule.solarTermLimit > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                  每节气限{rule.solarTermLimit}次
                                </span>
                              )}

                              {rule?.singleCapAmount && rule.singleCapAmount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-teal-50 text-teal-700 border border-teal-200/80">
                                  单次封顶 {formatCapUnit(rule.singleCapAmount, rec.currency)}
                                </span>
                              )}

                              {cap && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${
                                    cap.isCapReached
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-cyan-50 text-cyan-800 border-cyan-200/80'
                                  }`}
                                >
                                  {cap.isCapReached
                                    ? `${cap.scopeLabel}已满 ${formatCapUnit(cap.capAmount, rec.currency)}`
                                    : `${cap.scopeLabel} ${formatCapUnit(cap.usedAmount, rec.currency)}/${formatCapUnit(cap.capAmount, rec.currency)} (剩${formatCapUnit(cap.remainingAmount, rec.currency)})`}
                                </span>
                              )}

                              {rule?.frequency === 'yearly' && (
                                <span
                                  className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-200/70 flex items-center gap-0.5"
                                  title={formatGregorianYearlyText(rule.monthdays, rule.solarMonths)}
                                >
                                  <Calendar className="w-2.5 h-2.5 text-rose-600" />
                                  公历年度
                                </span>
                              )}

                              {rule?.frequency === 'lunar' && (
                                <span
                                  className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-amber-100/70 text-amber-800 flex items-center gap-0.5"
                                  title={formatLunarScheduleText(rule.lunarMonthdays, rule.lunarMonths)}
                                >
                                  <Moon className="w-2.5 h-2.5 text-amber-600" />
                                  {rule.lunarMonths && rule.lunarMonths.length > 0 ? '农历年度' : '农历'}
                                </span>
                              )}

                              {rec.daysUntilTarget !== undefined && rec.daysUntilTarget > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-0.5">
                                  <Bell className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                                  距正日({(rec.targetDate || '').slice(5)})还有 {rec.daysUntilTarget} 天
                                </span>
                              )}
                              {rec.daysUntilTarget === 0 &&
                                ((rule?.remindAdvanceDays && rule.remindAdvanceDays > 0) ||
                                  rule?.frequency === 'lunar' ||
                                  rule?.frequency === 'yearly') && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    🎯 今日正日
                                  </span>
                                )}
                            </div>
                            {(rec.path || rule?.path) && (
                              <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                                {rec.path || rule?.path}
                              </p>
                            )}
                            {rec.feedback && (
                              <div className="text-[10px] text-indigo-700 font-mono truncate">
                                备注: {rec.feedback}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              isDone
                                ? (rec.actual ?? 0) > 0
                                  ? 'text-emerald-700'
                                  : 'text-slate-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {rec.currency === 'CNY'
                              ? isDone
                                ? `¥${(rec.actual ?? 0).toFixed(2)}`
                                : `预 ¥${(rec.expected ?? rule?.amount ?? 0).toFixed(2)}`
                              : isDone
                                ? `${(rec.actual ?? 0).toLocaleString()} 分`
                                : `预 ${(rec.expected ?? rule?.amount ?? 0).toLocaleString()} 分`}
                          </span>
                          {(isDone || isSkipped) && (
                            <button
                              type="button"
                              onClick={() => handleRestoreToPending(rec)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-colors shrink-0 ${
                                isSkipped
                                  ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200'
                                  : 'bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border-slate-200'
                              }`}
                              title={isSkipped ? '恢复此任务到待提醒状态' : '撤回已完成状态并恢复待提醒'}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{isSkipped ? '恢复提醒' : '撤回'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setActiveCheckInRecord(rec)}
                            className="text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 px-2 py-1 rounded-lg"
                          >
                            详情
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* FLAT LIST VIEW */
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
          {filteredRecords.map((rec) => {
            const isDone = rec.status === 'done';
            const isSkipped = rec.status === 'skipped' || rec.status === 'canceled';
            const rule = rulesMap.get(rec.ruleId);
            const cap = rulePeriodCapMap.get(rec.ruleId);
            return (
              <div
                key={rec.id}
                className={`px-3 py-2 sm:px-5 sm:py-3 flex items-center justify-between gap-2.5 ${
                  isDone ? 'bg-emerald-50/20' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedRecordIds.has(rec.id)}
                    onChange={() => toggleSelectRecord(rec.id)}
                    className="rounded border-slate-300 text-indigo-600 shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickToggleDone(rec)}
                    className="focus:outline-hidden shrink-0"
                    title={
                      isDone
                        ? '点击撤销完成并恢复待提醒'
                        : isSkipped
                          ? '点击恢复为待提醒状态'
                          : '快捷一键完成'
                    }
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                    ) : rec.status === 'canceled' ? (
                      <Ban className="w-5 h-5 text-rose-400" />
                    ) : isSkipped ? (
                      <Clock className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-700">{rec.platform}</span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                        }`}
                      >
                        {rec.name}
                      </span>

                      {(rec.time || rule?.time) && (
                        <span
                          className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-md border flex items-center gap-0.5 ${
                            isRecordTimeSensitive(rec)
                              ? 'bg-rose-50 text-rose-700 border-rose-200/80 font-bold'
                              : 'bg-slate-50 text-slate-600 border-slate-200/60'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          <span>{rec.time || rule?.time || '09:00'}</span>
                          {(rec.deadline || rule?.deadline) && (rec.deadline || rule?.deadline) !== '23:59' && (
                            <span className="opacity-75">~{rec.deadline || rule?.deadline}</span>
                          )}
                        </span>
                      )}

                      {isRecordTimeSensitive(rec) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-500 text-white shadow-2xs">
                          ⏰ 限时敏感
                        </span>
                      )}

                      {rule?.monthlyLimit && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          月限{rule.monthlyLimit}次
                        </span>
                      )}

                      {rule?.weeklyLimit && rule.weeklyLimit > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          周限{rule.weeklyLimit}次
                        </span>
                      )}

                      {rule?.solarTermLimit && rule.solarTermLimit > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          每节气限{rule.solarTermLimit}次
                        </span>
                      )}

                      {rule?.singleCapAmount && rule.singleCapAmount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-teal-50 text-teal-700 border border-teal-200/80">
                          单次封顶 {formatCapUnit(rule.singleCapAmount, rec.currency)}
                        </span>
                      )}

                      {cap && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${
                            cap.isCapReached
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-cyan-50 text-cyan-800 border-cyan-200/80'
                          }`}
                        >
                          {cap.isCapReached
                            ? `${cap.scopeLabel}已满 ${formatCapUnit(cap.capAmount, rec.currency)}`
                            : `${cap.scopeLabel} ${formatCapUnit(cap.usedAmount, rec.currency)}/${formatCapUnit(cap.capAmount, rec.currency)} (剩${formatCapUnit(cap.remainingAmount, rec.currency)})`}
                        </span>
                      )}

                      {rule?.frequency === 'yearly' && (
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-200/70 flex items-center gap-0.5"
                          title={formatGregorianYearlyText(rule.monthdays, rule.solarMonths)}
                        >
                          <Calendar className="w-2.5 h-2.5 text-rose-600" />
                          公历年度
                        </span>
                      )}

                      {rule?.frequency === 'lunar' && (
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-amber-100/70 text-amber-800 flex items-center gap-0.5"
                          title={formatLunarScheduleText(rule.lunarMonthdays, rule.lunarMonths)}
                        >
                          <Moon className="w-2.5 h-2.5 text-amber-600" />
                          {rule.lunarMonths && rule.lunarMonths.length > 0 ? '农历年度' : '农历'}
                        </span>
                      )}

                      {rec.daysUntilTarget !== undefined && rec.daysUntilTarget > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-0.5">
                          <Bell className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                          距正日({(rec.targetDate || '').slice(5)})还有 {rec.daysUntilTarget} 天
                        </span>
                      )}
                      {rec.daysUntilTarget === 0 &&
                        ((rule?.remindAdvanceDays && rule.remindAdvanceDays > 0) ||
                          rule?.frequency === 'lunar' ||
                          rule?.frequency === 'yearly') && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            🎯 今日正日
                          </span>
                        )}
                    </div>
                    {(rec.path || rule?.path) && (
                      <p className="text-[11px] text-slate-400 font-mono truncate">{rec.path || rule?.path}</p>
                    )}
                    {rec.feedback && (
                      <div className="text-[10px] text-indigo-700 font-mono truncate">
                        备注: {rec.feedback}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      isDone
                        ? (rec.actual ?? 0) > 0
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {rec.currency === 'CNY'
                      ? isDone
                        ? `¥${(rec.actual ?? 0).toFixed(2)}`
                        : `预 ¥${(rec.expected ?? rule?.amount ?? 0).toFixed(2)}`
                      : isDone
                        ? `${(rec.actual ?? 0).toLocaleString()} 分`
                        : `预 ${(rec.expected ?? rule?.amount ?? 0).toLocaleString()} 分`}
                  </span>
                  {(isDone || isSkipped) && (
                    <button
                      type="button"
                      onClick={() => handleRestoreToPending(rec)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-colors shrink-0 ${
                        isSkipped
                          ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200'
                          : 'bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border-slate-200'
                      }`}
                      title={isSkipped ? '恢复此任务到待提醒状态' : '撤回已完成状态并恢复待提醒'}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isSkipped ? '恢复提醒' : '撤回'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveCheckInRecord(rec)}
                    className="text-xs text-indigo-600 hover:underline px-1.5 py-1"
                  >
                    详情
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Check In Modal */}
      {activeCheckInRecord && (
        <QuickCheckInModal
          record={activeCheckInRecord}
          rule={rulesMap.get(activeCheckInRecord.ruleId)}
          allRecords={data.records}
          isOpen={true}
          onClose={() => setActiveCheckInRecord(null)}
          onSave={onUpdateRecord}
        />
      )}
    </div>
  );
};
