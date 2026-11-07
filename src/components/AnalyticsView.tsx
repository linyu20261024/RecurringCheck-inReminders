import React, { useState, useMemo } from 'react';
import { AppDataBackup } from '../types';
import { getTodayString } from '../services/dataStorage';
import {
  TrendingUp,
  Calendar,
  CheckCircle2,
  Coins,
  Layers,
  BarChart3,
  PieChart,
  Search,
  Filter,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

interface AnalyticsViewProps {
  data: AppDataBackup;
  onNavigateToPlatform?: (platform: string) => void;
}

type TimeRange = 'all' | '30d' | '14d' | '7d';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ data }) => {
  // Dynamic today string (e.g. 2026-11-07)
  const todayStr = useMemo(() => getTodayString(), []);

  // Filters for Accumulated Cash Yield
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [rateMode, setRateMode] = useState<'due' | 'overall'>('due');

  // Extract all available months (sorted desc, e.g. 2026-11, 2026-10)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    data.records.forEach((r) => {
      if (r.date && r.date.length >= 7) {
        months.add(r.date.slice(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [data.records]);

  // Extract all platforms available in records
  const availablePlatforms = useMemo(() => {
    const plats = new Set<string>();
    data.records.forEach((r) => {
      if (r.platform) plats.add(r.platform);
    });
    return Array.from(plats).sort();
  }, [data.records]);

  // Base CNY cash records (Done & currency is CNY)
  const doneCnyRecords = useMemo(() => {
    return data.records.filter((r) => r.status === 'done' && r.currency === 'CNY');
  }, [data.records]);

  // Filtered records matching Month, Platform, and Search Keyword
  const filteredRecords = useMemo(() => {
    return data.records.filter((r) => {
      // Month filter
      if (selectedMonth !== 'all') {
        if (!r.date.startsWith(selectedMonth)) return false;
      }
      // Platform filter
      if (selectedPlatform !== 'all') {
        if (r.platform !== selectedPlatform) return false;
      }
      // Keyword search
      if (searchTableQuery.trim()) {
        const q = searchTableQuery.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchPlat = r.platform.toLowerCase().includes(q);
        const matchDate = r.date.includes(q);
        const matchFb = (r.feedback || '').toLowerCase().includes(q);
        if (!matchName && !matchPlat && !matchDate && !matchFb) return false;
      }
      return true;
    });
  }, [data.records, selectedMonth, selectedPlatform, searchTableQuery]);

  // Filtered done CNY records
  const filteredDoneCnyRecords = useMemo(() => {
    return filteredRecords.filter((r) => r.status === 'done' && r.currency === 'CNY');
  }, [filteredRecords]);

  // KPIs for the selected Month & Platform
  const kpis = useMemo(() => {
    let totalCny = 0;
    let expectedCny = 0;
    const dateMap: Record<string, number> = {};

    filteredDoneCnyRecords.forEach((r) => {
      const val = r.actual || 0;
      totalCny += val;
      dateMap[r.date] = (dateMap[r.date] || 0) + val;
    });

    filteredRecords.forEach((r) => {
      if (r.currency === 'CNY') {
        expectedCny += r.expected || 0;
      }
    });

    const totalScheduled = filteredRecords.length;
    const totalDone = filteredRecords.filter((r) => r.status === 'done').length;
    const totalPending = filteredRecords.filter((r) => r.status === 'pending').length;
    const totalSkipped = filteredRecords.filter((r) => r.status === 'skipped' || r.status === 'canceled').length;
    
    // Overall completion rate = done / (done + pending + skipped) = done / totalScheduled
    const overallRate = totalScheduled > 0 ? Math.round((totalDone / totalScheduled) * 100) : 0;

    // Due records (tasks scheduled up to today)
    const dueRecords = filteredRecords.filter((r) => r.date <= todayStr);
    const dueDone = dueRecords.filter((r) => r.status === 'done').length;
    const dueRate = dueRecords.length > 0 ? Math.round((dueDone / dueRecords.length) * 100) : 0;

    // Daily best and active days
    let bestDay = '-';
    let maxDayAmount = 0;
    const activeDaysCount = Object.keys(dateMap).length;

    Object.entries(dateMap).forEach(([date, amount]) => {
      if (amount > maxDayAmount) {
        maxDayAmount = amount;
        bestDay = date;
      }
    });

    const avgDailyCny = activeDaysCount > 0 ? totalCny / activeDaysCount : 0;

    return {
      totalCny: Math.round(totalCny * 100) / 100,
      expectedCny: Math.round(expectedCny * 100) / 100,
      totalScheduled,
      totalDone,
      totalPending,
      totalSkipped,
      overallRate,
      dueTotal: dueRecords.length,
      dueDone,
      dueRate,
      activeDaysCount,
      avgDailyCny: Math.round(avgDailyCny * 100) / 100,
      bestDay,
      maxDayAmount: Math.round(maxDayAmount * 100) / 100,
    };
  }, [filteredDoneCnyRecords, filteredRecords]);

  // Daily statistics for trend chart (CNY cash only) based on current filters
  const dailyStats = useMemo(() => {
    const map: Record<
      string,
      { date: string; cny: number; doneCount: number; platforms: Record<string, number> }
    > = {};

    filteredRecords.forEach((r) => {
      if (!map[r.date]) {
        map[r.date] = { date: r.date, cny: 0, doneCount: 0, platforms: {} };
      }
      if (r.status === 'done') {
        map[r.date].doneCount += 1;
        if (r.currency === 'CNY') {
          const val = r.actual || 0;
          map[r.date].cny += val;
          map[r.date].platforms[r.platform] = (map[r.date].platforms[r.platform] || 0) + val;
        }
      }
    });

    let list = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));

    // Only apply slice if month is 'all'
    if (selectedMonth === 'all') {
      if (timeRange === '7d') list = list.slice(-7);
      else if (timeRange === '14d') list = list.slice(-14);
      else if (timeRange === '30d') list = list.slice(-30);
    }

    let cumulative = 0;
    return list.map((item) => {
      cumulative += item.cny;
      return {
        ...item,
        cny: Math.round(item.cny * 100) / 100,
        cumulativeCny: Math.round(cumulative * 100) / 100,
      };
    });
  }, [filteredRecords, selectedMonth, timeRange]);

  // Platform ROI Ranking (CNY Cash Yield & Transparent Completion Rates)
  const platformRanking = useMemo(() => {
    const map: Record<
      string,
      {
        platform: string;
        cny: number;
        totalTasks: number;
        doneTasks: number;
        pendingTasks: number;
        skippedTasks: number;
        dueTotal: number;
        dueDone: number;
      }
    > = {};

    // Use records matching current month filter
    const baseRecords = selectedMonth === 'all'
      ? data.records
      : data.records.filter((r) => r.date.startsWith(selectedMonth));

    baseRecords.forEach((r) => {
      if (!map[r.platform]) {
        map[r.platform] = {
          platform: r.platform,
          cny: 0,
          totalTasks: 0,
          doneTasks: 0,
          pendingTasks: 0,
          skippedTasks: 0,
          dueTotal: 0,
          dueDone: 0,
        };
      }
      map[r.platform].totalTasks += 1;
      if (r.status === 'done') {
        map[r.platform].doneTasks += 1;
        if (r.currency === 'CNY') {
          map[r.platform].cny += r.actual || 0;
        }
      } else if (r.status === 'pending') {
        map[r.platform].pendingTasks += 1;
      } else if (r.status === 'skipped' || r.status === 'canceled') {
        map[r.platform].skippedTasks += 1;
      }

      // Check if task date is on or before today
      if (r.date <= todayStr) {
        map[r.platform].dueTotal += 1;
        if (r.status === 'done') {
          map[r.platform].dueDone += 1;
        }
      }
    });

    return Object.values(map)
      .map((p) => ({
        ...p,
        cny: Math.round(p.cny * 100) / 100,
        avgPerTask: p.doneTasks > 0 ? Math.round((p.cny / p.doneTasks) * 100) / 100 : 0,
        // Overall rate = 已执行 / (已执行 + 待执行 + 已跳过)
        completionRate: p.totalTasks > 0 ? Math.round((p.doneTasks / p.totalTasks) * 100) : 0,
        // Due rate = 截至今日已到期任务的完成率 = 截至今日已执行 / 截至今日总排出
        dueCompletionRate: p.dueTotal > 0 ? Math.round((p.dueDone / p.dueTotal) * 100) : 0,
      }))
      .filter((p) => p.cny > 0 || p.totalTasks > 0)
      .sort((a, b) => b.cny - a.cny || b.doneTasks - a.doneTasks);
  }, [data.records, selectedMonth]);

  // Category Breakdown (CNY cash only)
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { category: string; cny: number; count: number }> = {};
    filteredDoneCnyRecords.forEach((r) => {
      if (!map[r.category]) {
        map[r.category] = { category: r.category, cny: 0, count: 0 };
      }
      map[r.category].count += 1;
      map[r.category].cny += r.actual || 0;
    });
    const list = Object.values(map).map((c) => ({
      ...c,
      cny: Math.round(c.cny * 100) / 100,
    }));
    return list.sort((a, b) => b.cny - a.cny || b.count - a.count);
  }, [filteredDoneCnyRecords]);

  // Filtered positive cash yield records for table
  const yieldTableRecords = useMemo(() => {
    return filteredDoneCnyRecords
      .filter((r) => (r.actual ?? 0) > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredDoneCnyRecords]);

  // Max value for chart scaling
  const maxDailyCny = useMemo(() => {
    const max = Math.max(...dailyStats.map((d) => d.cny), 1);
    return Math.ceil(max * 1.15);
  }, [dailyStats]);

  const maxCumulativeCny = useMemo(() => {
    return Math.max(...dailyStats.map((d) => d.cumulativeCny), 1);
  }, [dailyStats]);

  // Reset filters
  const isFiltered = selectedMonth !== 'all' || selectedPlatform !== 'all' || searchTableQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedMonth('all');
    setSelectedPlatform('all');
    setSearchTableQuery('');
  };

  if (data.records.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h4 className="text-base font-bold text-slate-800">暂无打卡与收益统计数据</h4>
        <p className="text-xs text-slate-500 mt-1">
          请在今日提醒中完成打卡或通过右上角「导入/导出数据」载入历史备份。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Workbench Bar (按月按平台检索累计现金收益) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                累计实现现金收益与收益检索
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              支持按月份、按平台及关键词多维检索实际入账现金，报表仅统计纯人民币收益
            </p>
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-colors self-start md:self-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置所有筛选
            </button>
          )}
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Month Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              统计月份
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 py-2 px-3 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            >
              <option value="all">全周期 (全部历史月份)</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m.replace('-', '年')}月
                </option>
              ))}
            </select>
          </div>

          {/* Platform Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              所属平台 / App
            </label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 py-2 px-3 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            >
              <option value="all">全平台 (共 {availablePlatforms.length} 个 App)</option>
              {availablePlatforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Keyword Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-indigo-600" />
              关键字检索 (任务/日期/备注)
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTableQuery}
                onChange={(e) => setSearchTableQuery(e.target.value)}
                placeholder="例: 每日签到、微信、还款..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 py-2 pl-8 pr-3 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Filter Summary Badge */}
        {isFiltered && (
          <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">当前生效检索:</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-800 font-medium">
                月份: {selectedMonth === 'all' ? '全部' : `${selectedMonth.replace('-', '年')}月`}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-800 font-medium">
                平台: {selectedPlatform === 'all' ? '全部平台' : selectedPlatform}
              </span>
              {searchTableQuery && (
                <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-800 font-medium">
                  关键词: "{searchTableQuery}"
                </span>
              )}
            </div>
            <span className="text-[11px] text-indigo-700">
              匹配到 <strong className="font-bold tabular-nums">{filteredRecords.length}</strong> 条打卡记录
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards Grid (Strict CNY Cash Yield Only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Filtered Cash Yield */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/60 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">
              {isFiltered ? '筛选范围内现金收益' : '累计实现现金收益'}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">
            ¥{kpis.totalCny.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>预期: ¥{kpis.expectedCny.toFixed(2)}</span>
            <span className="text-indigo-600 font-semibold tabular-nums">
              {kpis.totalDone} 项已入账
            </span>
          </div>
        </div>

        {/* Daily Average Cash in Filtered Range */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">区间日均现金收益</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 tabular-nums">
            ¥{kpis.avgDailyCny.toFixed(2)}
            <span className="text-xs font-normal text-slate-400 ml-1">/天</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            涵盖 <span className="font-semibold text-slate-800">{kpis.activeDaysCount}</span> 个有收益记录日
          </div>
        </div>

        {/* Highest Single Day Cash Record */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">单日最高现金纪录</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tabular-nums">
            ¥{kpis.maxDayAmount.toFixed(2)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            峰值日期: <span className="font-mono text-slate-700 font-medium">{kpis.bestDay}</span>
          </div>
        </div>

        {/* Execution Completion Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">排期执行完成率</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-black text-slate-900 tabular-nums">{kpis.overallRate}%</div>
            <span className="text-xs text-slate-500 tabular-nums">
              (已执行 {kpis.totalDone} / 待执行 {kpis.totalPending})
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>总排出: {kpis.totalScheduled} 项</span>
            <span className="text-emerald-700 font-semibold" title="截至今日到期任务的打卡执行比例">
              截至今日已达: {kpis.dueRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Yield & Trend Chart */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">
                人民币现金收益动态走势
                {selectedPlatform !== 'all' && `（${selectedPlatform}）`}
                {selectedMonth !== 'all' && `（${selectedMonth.replace('-', '年')}月）`}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              柱状图为每日实际现金入账 (¥)，折线为累计现金递增曲线
            </p>
          </div>

          {selectedMonth === 'all' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setTimeRange('7d')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  timeRange === '7d' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                近7天
              </button>
              <button
                onClick={() => setTimeRange('14d')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  timeRange === '14d' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                近14天
              </button>
              <button
                onClick={() => setTimeRange('30d')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  timeRange === '30d' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                近30天
              </button>
              <button
                onClick={() => setTimeRange('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  timeRange === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                全周期
              </button>
            </div>
          )}
        </div>

        {/* SVG Chart */}
        <div className="pt-6">
          <div className="h-64 w-full relative">
            {dailyStats.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                当前筛选条件下无现金收益记录
              </div>
            ) : (
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.35" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const y = 220 - pct * 180;
                  const val = (maxDailyCny * pct).toFixed(1);
                  return (
                    <g key={i}>
                      <line
                        x1="30"
                        y1={y}
                        x2="100%"
                        y2={y}
                        stroke="#f1f5f9"
                        strokeDasharray={pct === 0 ? undefined : '3,3'}
                      />
                      <text x="24" y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                        ¥{val}
                      </text>
                    </g>
                  );
                })}

                {/* Bars for Daily Yield */}
                {dailyStats.map((d, index) => {
                  const totalBars = dailyStats.length;
                  const barWidthPct = Math.max(1.2, Math.min(4.5, 80 / totalBars));
                  const leftPct = 6 + (index / (totalBars - 1 || 1)) * 88;
                  const height = maxDailyCny > 0 ? (d.cny / maxDailyCny) * 180 : 0;
                  const y = 220 - height;
                  const isHovered = hoveredBarIndex === index;

                  return (
                    <g
                      key={d.date}
                      onMouseEnter={() => setHoveredBarIndex(index)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={`${leftPct - barWidthPct / 2}%`}
                        y={y}
                        width={`${barWidthPct}%`}
                        height={Math.max(height, 2)}
                        rx="3"
                        fill={isHovered ? '#4338ca' : 'url(#barGrad)'}
                        className="transition-colors duration-150"
                      />
                    </g>
                  );
                })}

                {/* Cumulative Line */}
                <path
                  d={dailyStats.reduce((acc, d, index) => {
                    const totalPoints = dailyStats.length;
                    const xPct = 6 + (index / (totalPoints - 1 || 1)) * 88;
                    const y = 220 - (d.cumulativeCny / maxCumulativeCny) * 180;
                    return `${acc} ${index === 0 ? 'M' : 'L'} ${xPct}% ${y}`;
                  }, '')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Points on Line */}
                {dailyStats.map((d, index) => {
                  const totalPoints = dailyStats.length;
                  const xPct = 6 + (index / (totalPoints - 1 || 1)) * 88;
                  const y = 220 - (d.cumulativeCny / maxCumulativeCny) * 180;
                  const isHovered = hoveredBarIndex === index;
                  return (
                    <circle
                      key={`pt-${d.date}`}
                      cx={`${xPct}%`}
                      cy={y}
                      r={isHovered ? '5' : '3'}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>
            )}

            {/* Hover Tooltip */}
            {hoveredBarIndex !== null && dailyStats[hoveredBarIndex] && (
              <div
                className="absolute z-20 pointer-events-none bg-slate-900 text-white rounded-xl shadow-lg p-3 text-xs -top-2 transform -translate-x-1/2 border border-slate-700 animate-in fade-in zoom-in-95"
                style={{
                  left: `${6 + (hoveredBarIndex / (dailyStats.length - 1 || 1)) * 88}%`,
                }}
              >
                <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between gap-4">
                  <span>{dailyStats[hoveredBarIndex].date}</span>
                  <span className="text-emerald-400 font-mono">
                    {dailyStats[hoveredBarIndex].doneCount} 项完成
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">当日现金收益:</span>
                    <strong className="text-indigo-300 font-mono">
                      ¥{dailyStats[hoveredBarIndex].cny.toFixed(2)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">累计现金收益:</span>
                    <strong className="text-emerald-400 font-mono">
                      ¥{dailyStats[hoveredBarIndex].cumulativeCny.toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Date Axis Labels */}
          <div className="flex justify-between text-[11px] text-slate-400 font-mono px-6 pt-2 border-t border-slate-100">
            <span>{dailyStats[0]?.date || ''}</span>
            <span>{dailyStats[Math.floor(dailyStats.length / 2)]?.date || ''}</span>
            <span>{dailyStats[dailyStats.length - 1]?.date || ''}</span>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 pt-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs bg-indigo-600" />
              <span>当日实际入账 (¥)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-emerald-500 rounded-full" />
              <span>累计现金走势 (¥)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section: Platform Ranking & Category Breakdown (Pure Cash) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Platform Ranking (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">
                  平台现金产出排行榜
                  {selectedMonth !== 'all' && `（${selectedMonth.replace('-', '年')}月）`}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                完成率公式：已执行任务数 ÷ 排出的任务数（已执行 + 待执行）
              </p>
            </div>

            {/* Rate Mode Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setRateMode('due')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  rateMode === 'due'
                    ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
                title="仅按截至今日已到期的任务计算完成率（排除未来尚未到达日期的预排任务）"
              >
                截至今日已达
              </button>
              <button
                type="button"
                onClick={() => setRateMode('overall')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  rateMode === 'overall'
                    ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
                title="按全部排期任务计算（包含未来尚未到达的预排待办）"
              >
                全期总排期
              </button>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-100 max-h-[420px] overflow-y-auto pr-1">
            {platformRanking.slice(0, 15).map((p, idx) => {
              const currentRate = rateMode === 'due' ? p.dueCompletionRate : p.completionRate;

              return (
                <div
                  key={p.platform}
                  onClick={() => setSelectedPlatform(p.platform)}
                  className={`py-3 flex items-center justify-between gap-3 px-2 rounded-xl transition-colors cursor-pointer ${
                    selectedPlatform === p.platform
                      ? 'bg-indigo-50/80 border border-indigo-200'
                      : 'hover:bg-slate-50/80'
                  }`}
                  title="点击按该平台过滤全部数据"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-800 font-extrabold'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-700'
                          : idx === 2
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-50 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-800 truncate">{p.platform}</h4>
                        {selectedPlatform === p.platform && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-indigo-600 text-white font-medium shrink-0">
                            已锁定
                          </span>
                        )}
                      </div>

                      {/* Explicit Breakdown: Done, Pending, Total, Rate */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                        <span className="text-emerald-700 font-medium">已执行 {p.doneTasks}</span>
                        <span className="text-slate-300">/</span>
                        <span className="text-amber-700 font-medium">待执行 {p.pendingTasks}</span>
                        <span className="text-slate-300">·</span>
                        <span>总排 {p.totalTasks} 项</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-bold text-slate-800 tabular-nums">
                          完成率 {currentRate}%
                        </span>
                      </div>

                      {/* Subtle Visual Progress Bar */}
                      <div className="w-full max-w-[180px] bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            currentRate >= 100
                              ? 'bg-emerald-500'
                              : currentRate >= 50
                              ? 'bg-indigo-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(currentRate, 3))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-indigo-700 tabular-nums">
                      ¥{p.cny.toFixed(2)}
                    </div>
                    {p.doneTasks > 0 && p.cny > 0 && (
                      <div className="text-[10px] text-slate-400 tabular-nums">
                        均 ¥{p.avgPerTask.toFixed(2)}/次
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">任务分类现金收益构成</h3>
              <PieChart className="w-4 h-4 text-slate-400" />
            </div>

            <div className="mt-4 space-y-4">
              {categoryBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  当前筛选无分类现金数据
                </div>
              ) : (
                categoryBreakdown.map((c, i) => {
                  const totalCny = kpis.totalCny || 1;
                  const pct = Math.round((c.cny / totalCny) * 100);
                  const colors = [
                    'bg-indigo-600 text-indigo-700',
                    'bg-emerald-500 text-emerald-700',
                    'bg-amber-500 text-amber-700',
                    'bg-sky-500 text-sky-700',
                  ];
                  const barColor = colors[i % colors.length].split(' ')[0];

                  return (
                    <div key={c.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{c.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 tabular-nums">
                            ¥{c.cny.toFixed(2)}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">({pct}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all duration-300`}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>已完成 {c.count} 次</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100/80 text-xs text-indigo-900 mt-6">
            <span className="font-bold">💡 检索提示: </span>
            可通过上方「统计月份」和「所属平台」联动过滤全量现金流水。
          </div>
        </div>
      </div>

      {/* Yield Records Details Table (Filtered by Month & Platform) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              现金入账明细流水（共 {yieldTableRecords.length} 笔）
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              记录每笔实际入账的人民币金额、算式公式及完成时间
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto max-h-[360px] overflow-y-auto">
          {yieldTableRecords.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              当前月份或平台无实际入账的现金流水记录
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-3">日期</th>
                  <th className="py-2.5 px-3">平台</th>
                  <th className="py-2.5 px-3">任务名称</th>
                  <th className="py-2.5 px-3 text-right">实际现金收益</th>
                  <th className="py-2.5 px-3">算式/反馈备注</th>
                  <th className="py-2.5 px-3">完成时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {yieldTableRecords.slice(0, 100).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{r.date}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-800">{r.platform}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">{r.name}</td>
                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-emerald-700">
                      ¥{(r.actual || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {r.feedback || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] font-mono">
                      {r.completedAt ? r.completedAt.slice(11, 19) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
