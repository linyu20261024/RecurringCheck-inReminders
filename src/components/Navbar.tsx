import React from 'react';
import {
  CalendarCheck2,
  BarChart3,
  Sliders,
  Sparkles,
  FolderDown,
} from 'lucide-react';

export type ActiveTab = 'tasks' | 'analytics' | 'rules';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  pendingCount: number;
  totalRulesCount: number;
  totalRecordsCount: number;
  onOpenImportExport: () => void;
  onOpenOptimization: () => void;
  currentDate: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  pendingCount,
  totalRulesCount,
  totalRecordsCount,
  onOpenImportExport,
  onOpenOptimization,
  currentDate,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white flex items-center justify-center shadow-xs">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                  周期任务与收益提醒助手
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                  专业版
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                App聚合批量打卡 · 智能算式速算 · 纯现金收益大屏 · 规则周期管理
              </p>
            </div>
          </div>

          {/* Center Tabs (Tasks, Analytics, Rules) */}
          <nav className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => onTabChange('tasks')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'tasks'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              <span>今日提醒</span>
              {pendingCount > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums ${
                    activeTab === 'tasks' ? 'bg-indigo-800 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onTabChange('analytics')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>收益统计大屏</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('rules')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'rules'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>规则库</span>
              <span className="text-[10px] text-slate-400 font-normal">({totalRulesCount})</span>
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {totalRulesCount > 0 && (
              <button
                type="button"
                onClick={onOpenOptimization}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="查看数据模版结构分析与优化建议"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden lg:inline">模版优化分析</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenImportExport}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="导入/导出备份数据"
            >
              <FolderDown className="w-3.5 h-3.5 text-slate-500" />
              <span>导入/导出数据</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
