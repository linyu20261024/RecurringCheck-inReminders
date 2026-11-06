import React, { useState, useMemo } from 'react';
import { TaskRecord, TaskRule, AppDataBackup } from '../types';
import { QuickCheckInModal } from './QuickCheckInModal';
import {
  CheckCircle2,
  Circle,
  Clock,
  Ban,
  Layers,
  LayoutGrid,
  List,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Search,
  Filter,
  CheckCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

interface TaskRemindersViewProps {
  data: AppDataBackup;
  currentDate: string; // YYYY-MM-DD
  onDateChange: (newDate: string) => void;
  onUpdateRecord: (updatedRecord: TaskRecord) => void;
  onBatchUpdateRecords: (updatedRecords: TaskRecord[]) => void;
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
  onNavigateToTab,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('platform');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [activeCheckInRecord, setActiveCheckInRecord] = useState<TaskRecord | null>(null);
  const [copiedPathId, setCopiedPathId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

  // Rule lookup map
  const rulesMap = useMemo(() => {
    const map = new Map<string, TaskRule>();
    data.rules.forEach((r) => map.set(r.id, r));
    return map;
  }, [data.rules]);

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
    let actualPoints = 0;

    todayRecords.forEach((r) => {
      if (r.currency === 'CNY') {
        if (r.status === 'done') actualCny += r.actual || 0;
        expectedCny += r.expected || 0;
      } else if (r.currency === 'points') {
        if (r.status === 'done') actualPoints += r.actual || 0;
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
      actualPoints,
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
    onUpdateRecord(updated);
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
    setTimeout(() => setCopiedPathId(null), 1800);
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
    <div className="space-y-6">
      {/* Top Banner: Date, Today Stats, Quick Batch Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          {/* Date Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/70">
              <button
                type="button"
                onClick={() => handleStepDate(-1)}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
                title="前一天"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-3">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => e.target.value && onDateChange(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 text-sm focus:outline-hidden cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => handleStepDate(1)}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
                title="后一天"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {currentDate !== '2026-11-06' && (
              <button
                type="button"
                onClick={() => onDateChange('2026-11-06')}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100"
              >
                回到今日 (11-06)
              </button>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">完成进度:</span>
              <span className="font-bold text-slate-800 tabular-nums">
                {metrics.done} / {metrics.total}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                {metrics.completionRate}%
              </span>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <span className="text-slate-500">今日现金收益:</span>
              <span className="font-bold text-indigo-700 tabular-nums text-sm">
                ¥{metrics.actualCny.toFixed(2)}
              </span>
              <span className="text-slate-400 text-[11px]">
                (预期 ¥{metrics.expectedCny.toFixed(2)})
              </span>
            </div>

            {metrics.actualPoints > 0 && (
              <>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">今日积分:</span>
                  <span className="font-bold text-amber-600 tabular-nums">
                    +{metrics.actualPoints.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filters and View Mode Switcher */}
        <div className="pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              全部 ({metrics.total})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Circle className="w-3 h-3 fill-current" />
              待办 ({metrics.pending})
            </button>
            <button
              onClick={() => setStatusFilter('done')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'done'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              已完成 ({metrics.done})
            </button>
            <button
              onClick={() => setStatusFilter('skipped')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'skipped'
                  ? 'bg-slate-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              已跳过 ({metrics.skipped})
            </button>
          </div>

          {/* Search & Platform Filter & View Modes */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 md:w-52">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索任务或App..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Platform Dropdown */}
            {platformsList.length > 0 && (
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-700 py-1.5 px-2.5 rounded-xl focus:outline-hidden"
              >
                <option value="all">全平台 ({platformsList.length})</option>
                {platformsList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('platform')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                  viewMode === 'platform' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="按 App 聚合办理 (推荐高效模式)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">App聚合</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('category')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                  viewMode === 'category' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="按分类分组"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">分类</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                  viewMode === 'flat' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="平铺列表"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">列表</span>
              </button>
            </div>
          </div>
        </div>

        {/* Multi-selection Bar */}
        {selectedRecordIds.size > 0 && (
          <div className="mt-4 p-2.5 bg-indigo-50/80 border border-indigo-200/70 rounded-xl flex items-center justify-between animate-in fade-in">
            <span className="text-xs font-semibold text-indigo-900">
              已选 {selectedRecordIds.size} 项任务
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBatchAction('done')}
                className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" />
                批量完成
              </button>
              <button
                type="button"
                onClick={() => handleBatchAction('skipped')}
                className="px-3 py-1 bg-slate-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                <Clock className="w-3 h-3" />
                批量跳过
              </button>
              <button
                type="button"
                onClick={() => setSelectedRecordIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
              >
                取消选择
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Task List / Aggregated Groups */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
          <h4 className="text-base font-bold text-slate-800">
            {todayRecords.length === 0 ? '该日期无周期任务安排' : '当前筛选条件下无任务'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {todayRecords.length === 0
              ? '可通过顶部日期切换到 2026-11-06 或在规则管理中添加该日期的周期规则。'
              : '尝试调整筛选状态或清空搜索关键词。'}
          </p>
        </div>
      ) : viewMode === 'platform' ? (
        /* PLATFORM AGGREGATED VIEW (APP-CENTRIC EFFICIENCY WORKBENCH) */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              按 App 聚合办理（一次打开一个 App，完成该应用内所有打卡）：共{' '}
              <strong className="text-slate-800 font-semibold">{recordsByPlatform.length}</strong> 个平台
            </span>
            <button
              onClick={toggleSelectAll}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {selectedRecordIds.size === filteredRecords.length ? '取消全选' : '全选所有项'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {recordsByPlatform.map(([platformName, records]) => {
              const pendingCount = records.filter((r) => r.status === 'pending').length;
              const doneCount = records.filter((r) => r.status === 'done').length;
              const expectedTotal = records.reduce(
                (acc, r) => (r.currency === 'CNY' ? acc + (r.expected || 0) : acc),
                0
              );
              const actualTotal = records.reduce(
                (acc, r) => (r.currency === 'CNY' && r.status === 'done' ? acc + (r.actual || 0) : acc),
                0
              );

              return (
                <div
                  key={platformName}
                  className={`bg-white rounded-2xl border transition-all ${
                    pendingCount === 0
                      ? 'border-slate-200/60 bg-slate-50/40 opacity-90'
                      : 'border-slate-200 shadow-xs hover:border-slate-300'
                  }`}
                >
                  {/* Platform Card Header */}
                  <div className="px-5 py-3.5 bg-slate-50/80 rounded-t-2xl border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                        {platformName.slice(0, 1)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-800">{platformName}</h4>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {doneCount}/{records.length} 完成
                          </span>
                          {expectedTotal > 0 && (
                            <span className="text-xs font-semibold text-indigo-700 tabular-nums">
                              (预估 ¥{expectedTotal.toFixed(2)})
                            </span>
                          )}
                          {actualTotal > 0 && (
                            <span className="text-xs font-bold text-emerald-700 tabular-nums">
                              已入账 ¥{actualTotal.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Batch Actions for this Platform */}
                    <div className="flex items-center gap-2">
                      {pendingCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleBatchCompletePlatform(platformName, records)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          title="一键将该 App 内所有待办任务标记为已完成"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          该App一键全打卡 ({pendingCount})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Task Items inside Platform */}
                  <div className="divide-y divide-slate-100">
                    {records.map((rec) => {
                      const rule = rulesMap.get(rec.ruleId);
                      const isDone = rec.status === 'done';
                      const isSkipped = rec.status === 'skipped' || rec.status === 'canceled';
                      const pathText = rec.path || rule?.path;

                      return (
                        <div
                          key={rec.id}
                          className={`px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            isDone ? 'bg-emerald-50/20' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Checkbox for batch */}
                            <input
                              type="checkbox"
                              checked={selectedRecordIds.has(rec.id)}
                              onChange={() => toggleSelectRecord(rec.id)}
                              className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />

                            {/* 1-Click Status Button */}
                            <button
                              type="button"
                              onClick={() => handleQuickToggleDone(rec)}
                              className="mt-0.5 shrink-0 focus:outline-hidden"
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

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-sm font-semibold ${
                                    isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                                  }`}
                                >
                                  {rec.name}
                                </span>
                                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                  {rec.category}
                                </span>
                                {rec.priority === '高' && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200/50">
                                    高优先级
                                  </span>
                                )}
                              </div>

                              {/* App Internal Path Guidance */}
                              {pathText && (
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{pathText}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPath(pathText, rec.id)}
                                    className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors"
                                    title="复制路径"
                                  >
                                    {copiedPathId === rec.id ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Feedback / Notes / Formula */}
                              {rec.feedback && (
                                <div className="mt-1 text-[11px] text-indigo-700 font-mono">
                                  备注: {rec.feedback}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Amount & Actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-11 sm:pl-0">
                            {/* Yield display */}
                            <div className="text-right">
                              {rec.currency === 'CNY' ? (
                                <div>
                                  <div className="text-xs font-bold tabular-nums text-slate-800">
                                    {isDone && (rec.actual ?? 0) > 0 ? (
                                      <span className="text-emerald-700 font-extrabold">
                                        实得 ¥{(rec.actual ?? 0).toFixed(2)}
                                      </span>
                                    ) : (
                                      <span>预期 ¥{(rec.expected ?? rule?.amount ?? 0).toFixed(2)}</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs font-semibold tabular-nums text-amber-600">
                                  {isDone && (rec.actual ?? 0) > 0
                                    ? `+${(rec.actual ?? 0).toLocaleString()} 积分`
                                    : `${(rec.expected ?? rule?.amount ?? 0).toLocaleString()} 积分`}
                                </div>
                              )}
                            </div>

                            {/* Record details action */}
                            <button
                              type="button"
                              onClick={() => setActiveCheckInRecord(rec)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors border border-slate-200"
                            >
                              详情/实得
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
        <div className="space-y-5">
          {recordsByCategory.map(([catName, records]) => {
            const pendingCount = records.filter((r) => r.status === 'pending').length;
            return (
              <div key={catName} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-5 py-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-800">{catName}</h4>
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
                        className={`px-5 py-3 flex items-center justify-between gap-3 ${
                          isDone ? 'bg-emerald-50/20' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleQuickToggleDone(rec)}
                            className="focus:outline-hidden"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                                {rec.platform}
                              </span>
                              <span
                                className={`text-sm font-semibold ${
                                  isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                                }`}
                              >
                                {rec.name}
                              </span>
                            </div>
                            {(rec.path || rule?.path) && (
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{rec.path || rule?.path}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold tabular-nums text-slate-700">
                            {rec.currency === 'CNY'
                              ? `¥${(isDone && rec.actual ? rec.actual : rec.expected || 0).toFixed(2)}`
                              : `${(isDone && rec.actual ? rec.actual : rec.expected || 0).toLocaleString()} 积分`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveCheckInRecord(rec)}
                            className="text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 px-2.5 py-1 rounded-lg"
                          >
                            记录
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
          {filteredRecords.map((rec) => {
            const isDone = rec.status === 'done';
            const rule = rulesMap.get(rec.ruleId);
            return (
              <div
                key={rec.id}
                className={`px-5 py-3.5 flex items-center justify-between gap-3 ${
                  isDone ? 'bg-emerald-50/20' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedRecordIds.has(rec.id)}
                    onChange={() => toggleSelectRecord(rec.id)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickToggleDone(rec)}
                    className="focus:outline-hidden"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">{rec.platform}</span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={`text-sm font-semibold truncate ${
                          isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                        }`}
                      >
                        {rec.name}
                      </span>
                    </div>
                    {(rec.path || rule?.path) && (
                      <p className="text-xs text-slate-400 font-mono truncate">{rec.path || rule?.path}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold tabular-nums text-slate-700">
                    {rec.currency === 'CNY'
                      ? `¥${(isDone && rec.actual ? rec.actual : rec.expected || 0).toFixed(2)}`
                      : `${(isDone && rec.actual ? rec.actual : rec.expected || 0).toLocaleString()} 积分`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveCheckInRecord(rec)}
                    className="text-xs text-indigo-600 hover:underline px-2 py-1"
                  >
                    编辑实收
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
