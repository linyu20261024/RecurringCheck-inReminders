import React, { useState, useMemo } from 'react';
import { TaskRecord, TaskRule, AppDataBackup } from '../types';
import { getTodayString } from '../services/dataStorage';
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
} from 'lucide-react';

interface TaskRemindersViewProps {
  data: AppDataBackup;
  currentDate: string; // YYYY-MM-DD
  onDateChange: (newDate: string) => void;
  onUpdateRecord: (updatedRecord: TaskRecord, skipRestOfMonth?: boolean) => void;
  onBatchUpdateRecords: (updatedRecords: TaskRecord[]) => void;
  onSkipMonthRemaining?: (ruleId: string, fromDate: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

type ViewMode = 'platform' | 'category' | 'flat';
type StatusFilter = 'all' | 'pending' | 'done' | 'skipped';

export const TaskRemindersView: React.FC<TaskRemindersViewProps> = ({
  data,
  currentDate,
  onDateChange,
  onUpdateRecord,
  onBatchUpdateRecords,
  onSkipMonthRemaining,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('platform');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [activeCheckInRecord, setActiveCheckInRecord] = useState<TaskRecord | null>(null);
  const [copiedPathId, setCopiedPathId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

  // Dynamic today string (e.g. 2026-11-07)
  const todayStr = useMemo(() => getTodayString(), []);

  // Rule lookup map
  const rulesMap = useMemo(() => {
    const map = new Map<string, TaskRule>();
    data.rules.forEach((r) => map.set(r.id, r));
    return map;
  }, [data.rules]);

  // Current natural month prefix: e.g. "2026-11"
  const currentMonthPrefix = useMemo(() => currentDate.slice(0, 7), [currentDate]);

  // Map of how many times a rule was completed in the current natural month
  const ruleMonthlyDoneCountMap = useMemo(() => {
    const map = new Map<string, number>();
    data.records.forEach((r) => {
      if (r.status === 'done' && r.date.startsWith(currentMonthPrefix)) {
        map.set(r.ruleId, (map.get(r.ruleId) || 0) + 1);
      }
    });
    return map;
  }, [data.records, currentMonthPrefix]);

  // Records for current date
  const todayRecords = useMemo(() => {
    return data.records.filter((r) => r.date === currentDate);
  }, [data.records, currentDate]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return todayRecords.filter((rec) => {
      // Status filter
      if (statusFilter === 'pending' && rec.status !== 'pending') return false;
      if (statusFilter === 'done' && rec.status !== 'done') return false;
      if (statusFilter === 'skipped' && rec.status !== 'skipped' && rec.status !== 'canceled') return false;

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
  }, [todayRecords, statusFilter, selectedPlatform, searchQuery, rulesMap]);

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
      actualCny: Math.round(actualCny * 100) / 100,
      expectedCny: Math.round(expectedCny * 100) / 100,
      completionRate,
    };
  }, [todayRecords]);

  // Grouping by Platform
  const recordsByPlatform = useMemo(() => {
    const groups: Record<string, TaskRecord[]> = {};
    filteredRecords.forEach((r) => {
      if (!groups[r.platform]) groups[r.platform] = [];
      groups[r.platform].push(r);
    });
    // Sort platforms by pending items first, then total count
    return Object.entries(groups).sort((a, b) => {
      const pendingA = a[1].filter((r) => r.status === 'pending').length;
      const pendingB = b[1].filter((r) => r.status === 'pending').length;
      if (pendingA !== pendingB) return pendingB - pendingA;
      return b[1].length - a[1].length;
    });
  }, [filteredRecords]);

  // Grouping by Category
  const recordsByCategory = useMemo(() => {
    const groups: Record<string, TaskRecord[]> = {};
    filteredRecords.forEach((r) => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredRecords]);

  // Quick 1-click single check-in toggle
  const handleQuickToggleDone = (record: TaskRecord) => {
    const rule = rulesMap.get(record.ruleId);
    const isNowDone = record.status !== 'done';
    const defaultActual = isNowDone ? (record.expected ?? rule?.amount ?? 0) : 0;
    const now = new Date().toISOString();

    const updated: TaskRecord = {
      ...record,
      status: isNowDone ? 'done' : 'pending',
      actual: defaultActual,
      completedAt: isNowDone ? now : undefined,
      received: isNowDone && defaultActual > 0,
    };

    // If it's a monthly limit rule and user completed it, auto-skip future days in this month
    const autoSkipMonthly = isNowDone && !!rule?.monthlyLimit && rule.monthlyLimit > 0;
    onUpdateRecord(updated, autoSkipMonthly);
  };

  // Batch complete all pending in a platform
  const handleBatchCompletePlatform = (platformName: string, records: TaskRecord[]) => {
    const pendingList = records.filter((r) => r.status === 'pending');
    if (pendingList.length === 0) return;

    const now = new Date().toISOString();
    const updatedList: TaskRecord[] = pendingList.map((rec) => {
      const rule = rulesMap.get(rec.ruleId);
      const defaultActual = rec.expected ?? rule?.amount ?? 0;
      return {
        ...rec,
        status: 'done',
        actual: defaultActual,
        completedAt: now,
        received: defaultActual > 0,
      };
    });

    onBatchUpdateRecords(updatedList);
  };

  // Batch action for multi-selected records
  const handleBatchAction = (targetStatus: 'done' | 'skipped') => {
    if (selectedRecordIds.size === 0) return;
    const now = new Date().toISOString();
    const toUpdate: TaskRecord[] = [];

    todayRecords.forEach((rec) => {
      if (selectedRecordIds.has(rec.id)) {
        const rule = rulesMap.get(rec.ruleId);
        const defaultActual = targetStatus === 'done' ? (rec.expected ?? rule?.amount ?? 0) : 0;
        toUpdate.push({
          ...rec,
          status: targetStatus,
          actual: defaultActual,
          completedAt: targetStatus === 'done' ? now : undefined,
          received: targetStatus === 'done' && defaultActual > 0,
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

          {/* Search & Platform Filter & View Modes */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
            {/* Search */}
            <div className="relative flex-1 sm:w-44">
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
          <div className="mt-2.5 p-2 bg-indigo-50/90 border border-indigo-200 rounded-xl flex items-center justify-between animate-in fade-in">
            <span className="text-xs font-semibold text-indigo-900">
              已选 {selectedRecordIds.size} 项
            </span>
            <div className="flex items-center gap-1.5">
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
                        title="一键将该 App 内所有待办任务标记为已完成"
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
                              title={isDone ? '标记为未完成' : '快捷一键完成'}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
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
                                    title="该任务每个自然月仅需完成1次"
                                  >
                                    {hasReachedMonthlyCap ? '当月已达1次' : '月限1次'}
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
                                  {isDone && (rec.actual ?? 0) > 0 ? (
                                    <span className="text-emerald-700 font-bold">
                                      ¥{(rec.actual ?? 0).toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">
                                      ¥{(rec.expected ?? rule?.amount ?? 0).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs font-semibold tabular-nums text-amber-600">
                                  {isDone && (rec.actual ?? 0) > 0
                                    ? `${(rec.actual ?? 0).toLocaleString()} 分`
                                    : `${(rec.expected ?? rule?.amount ?? 0).toLocaleString()} 分`}
                                </div>
                              )}
                            </div>

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
                    const rule = rulesMap.get(rec.ruleId);
                    return (
                      <div
                        key={rec.id}
                        className={`px-3 py-2 sm:px-5 sm:py-3 flex items-center justify-between gap-2.5 ${
                          isDone ? 'bg-emerald-50/20' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleQuickToggleDone(rec)}
                            className="focus:outline-hidden shrink-0"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
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
                              {rule?.monthlyLimit && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  月限1次
                                </span>
                              )}
                            </div>
                            {(rec.path || rule?.path) && (
                              <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                                {rec.path || rule?.path}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold tabular-nums text-slate-700">
                            {rec.currency === 'CNY'
                              ? `¥${(isDone && rec.actual ? rec.actual : rec.expected || 0).toFixed(2)}`
                              : `${(isDone && rec.actual ? rec.actual : rec.expected || 0).toLocaleString()} 分`}
                          </span>
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
            const rule = rulesMap.get(rec.ruleId);
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
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
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
                      {rule?.monthlyLimit && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          月限1次
                        </span>
                      )}
                    </div>
                    {(rec.path || rule?.path) && (
                      <p className="text-[11px] text-slate-400 font-mono truncate">{rec.path || rule?.path}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold tabular-nums text-slate-700">
                    {rec.currency === 'CNY'
                      ? `¥${(isDone && rec.actual ? rec.actual : rec.expected || 0).toFixed(2)}`
                      : `${(isDone && rec.actual ? rec.actual : rec.expected || 0).toLocaleString()} 分`}
                  </span>
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
          isOpen={true}
          onClose={() => setActiveCheckInRecord(null)}
          onSave={onUpdateRecord}
        />
      )}
    </div>
  );
};
