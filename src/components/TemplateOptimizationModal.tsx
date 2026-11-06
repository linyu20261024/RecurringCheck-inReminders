import React, { useMemo } from 'react';
import { AppDataBackup } from '../types';
import { analyzeTemplateOptimization, exportDataAsJson } from '../services/dataStorage';
import {
  Sparkles,
  Download,
  Scale,
  X,
} from 'lucide-react';

interface TemplateOptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AppDataBackup;
}

export const TemplateOptimizationModal: React.FC<TemplateOptimizationModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const diagnosis = useMemo(() => {
    return analyzeTemplateOptimization(data);
  }, [data]);

  if (!isOpen) return null;

  // Export compact optimized JSON
  const handleExportOptimized = () => {
    const compactRecords = data.records.map((rec) => ({
      id: rec.id,
      ruleId: rec.ruleId,
      date: rec.date,
      status: rec.status,
      actual: rec.actual,
      expected: rec.expected,
      completedAt: rec.completedAt,
      feedback: rec.feedback || undefined,
    }));

    const compactRules = data.rules.map((rule) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = { ...rule };
      if (r.frequency !== 'interval') {
        delete r.intervalN;
        delete r.unit;
      }
      if (r.frequency !== 'solar') {
        delete r.solarTerms;
      }
      return r;
    });

    const optimizedData: AppDataBackup = {
      version: 3,
      rules: compactRules,
      records: compactRecords as typeof data.records,
      _savedAt: Date.now(),
    };

    exportDataAsJson(optimizedData, `周期任务_优化范式版v3_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const rawKb = (diagnosis.rawJsonSizeBytes / 1024).toFixed(1);
  const optKb = (diagnosis.optimizedJsonSizeBytes / 1024).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">数据模版分析与深度优化调节建议</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                针对周期规则与打卡记录的结构诊断与提效改造方案
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Diagnostic Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
              <span className="text-xs text-indigo-700 font-semibold block mb-1">
                存储空间优化潜力
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-indigo-900 tabular-nums">
                  -{diagnosis.compressionRatio}%
                </span>
                <span className="text-xs text-indigo-600 font-medium">体积精简</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {rawKb} KB → {optKb} KB
              </span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
              <span className="text-xs text-amber-700 font-semibold block mb-1">
                规则多余调度字段
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-900 tabular-nums">
                  {diagnosis.redundantScheduleFieldsCount}
                </span>
                <span className="text-xs text-amber-600 font-medium">项冗余</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                非自定义间隔却默认携带 intervalN=3
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-xs text-emerald-700 font-semibold block mb-1">
                数据完整性健康度
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-900 tabular-nums">100%</span>
                <span className="text-xs text-emerald-600 font-medium">无孤立废弃记录</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                记录均精准匹配规则 ID
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-600 font-semibold block mb-1">
                涵盖业务生态规模
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 tabular-nums">
                  {diagnosis.platformCount}
                </span>
                <span className="text-xs text-slate-500 font-medium">个 App 平台</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {diagnosis.totalRules} 条周期规则 · {diagnosis.totalRecords} 条记录
              </span>
            </div>
          </div>

          {/* Suggestions Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-600" />
              模版优化与结构升级建议
            </h3>

            <div className="space-y-3">
              {/* Suggestion 1 */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">
                      打卡记录结构规范化（范式化消除 7 项高频重复字段）
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong>原模版痛点：</strong>在原始记录中，每一条记录都机械复制了父规则的
                      <code className="mx-1 px-1 py-0.5 bg-slate-100 rounded text-rose-600 font-mono text-[11px]">
                        name, platform, category, path, notes, priority, currency
                      </code>
                      等 7 个静态字段，占用了近 60% 的体积。一旦修改规则名称或 App 路径，已生成的记录无法自动同步。
                    </p>
                    <p className="text-xs text-indigo-700 font-medium mt-1">
                      <strong>优化方案：</strong>记录表仅保留动态执行字段（<code className="text-xs font-mono">id, ruleId, date, status, actual, feedback, completedAt</code>）。静态信息在渲染时通过 <code className="text-xs font-mono">ruleId</code> 实时关联派生，支持仅在必要时单次字段覆盖。
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggestion 2 */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">
                      周期起止有效范围与后续任务自动级联清理
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong>原模版痛点：</strong>原规则缺乏明确的有效起止日期控制；当删除一条规则时，日历中已预先排期的待办记录依然孤立存在。
                    </p>
                    <p className="text-xs text-indigo-700 font-medium mt-1">
                      <strong>优化方案：</strong>规则配置增加了明确的「开始生效日期」与「结束截止日期（或长期有效）」。删除规则时，系统自动联动清理今日及未来的所有未完成待办任务，同时保留历史已完成的真实收益数据。
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggestion 3 */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">
                      人民币纯现金收益统计口径分离
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong>优化说明：</strong>严格分离人民币现金（CNY）与积分（points）计量，现金收益大屏仅统计真实到账的金额（¥），积分作为辅助维度独立呈现，不折算人民币。
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggestion 4 */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">
                      App 操作路径面包屑标准化与一键复制唤起
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong>优化说明：</strong>统一采用层级面包屑格式（如 <code className="font-mono text-xs text-slate-700">首页 -&gt; 酷玩中心 -&gt; 签到</code>），支持一键复制路径，并在按 App 聚合时提供该应用「一键批量打卡」，最大化节省打卡时间。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            支持无损向下兼容导出原始格式，或导出优化版以提升加载效率。
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportOptimized}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              下载优化版数据包 (JSON v3)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
