import React, { useState, useEffect } from 'react';
import { TaskRecord, TaskRule } from '../types';
import { evaluateFormula } from '../services/dataStorage';
import { X, CheckCircle2, Calculator, AlertCircle, Ban, Clock, CalendarOff } from 'lucide-react';

interface QuickCheckInModalProps {
  record: TaskRecord;
  rule?: TaskRule;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRecord: TaskRecord, skipRestOfMonth?: boolean) => void;
}

export const QuickCheckInModal: React.FC<QuickCheckInModalProps> = ({
  record,
  rule,
  isOpen,
  onClose,
  onSave,
}) => {
  const [actualInput, setActualInput] = useState<string>(
    record.actual !== undefined && record.actual > 0 ? String(record.actual) : ''
  );
  const [formulaExpr, setFormulaExpr] = useState<string>(record.feedback || '');
  const [notes, setNotes] = useState<string>(record.notes || '');
  const [status, setStatus] = useState<TaskRecord['status']>(record.status || 'done');
  const [skipRestOfMonth, setSkipRestOfMonth] = useState<boolean>(true);

  // Update input if record changes
  useEffect(() => {
    setActualInput(record.actual !== undefined && record.actual > 0 ? String(record.actual) : '');
    setFormulaExpr(record.feedback || '');
    setNotes(record.notes || '');
    setStatus(record.status === 'pending' ? 'done' : record.status);
    setSkipRestOfMonth(true);
  }, [record]);

  if (!isOpen) return null;

  // Auto-evaluate formula if user types math expression in formulaExpr
  const handleFormulaChange = (val: string) => {
    setFormulaExpr(val);
    const calculated = evaluateFormula(val);
    if (calculated !== null) {
      setActualInput(String(calculated));
    }
  };

  const handleFillExpected = () => {
    const exp = record.expected ?? rule?.amount ?? 0;
    setActualInput(String(exp));
    setStatus('done');
  };

  const handleSave = () => {
    const num = actualInput.trim() ? parseFloat(actualInput) : 0;
    const now = new Date().toISOString();
    const updated: TaskRecord = {
      ...record,
      status,
      actual: isNaN(num) ? 0 : num,
      feedback: formulaExpr.trim(),
      notes: notes.trim(),
      completedAt: status === 'done' ? (record.completedAt || now) : undefined,
      received: status === 'done' && num > 0,
    };
    onSave(updated, rule?.monthlyLimit ? skipRestOfMonth : false);
    onClose();
  };

  const isMonthlyLimitRule = !!rule?.monthlyLimit && rule.monthlyLimit > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {record.platform}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-[11px] text-slate-500">{record.category}</span>
              {isMonthlyLimitRule && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                  自然月限1次
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 mt-1">{record.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Path guidance */}
          {(record.path || rule?.path) && (
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs text-amber-900 flex items-start gap-1.5">
              <span className="font-semibold shrink-0 text-amber-700">App 路径:</span>
              <span className="font-mono text-amber-800 break-all text-[11px] leading-relaxed">
                {record.path || rule?.path}
              </span>
            </div>
          )}

          {/* Status selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">任务状态</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('done')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  status === 'done'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                已完成
              </button>
              <button
                type="button"
                onClick={() => setStatus('skipped')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  status === 'skipped'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                跳过今日
              </button>
              <button
                type="button"
                onClick={() => setStatus('canceled')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  status === 'canceled'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                已取消
              </button>
            </div>
          </div>

          {/* Actual Yield / Earnings */}
          {status === 'done' && (
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    实际到账收益 ({record.currency})
                  </label>
                  {(record.expected ?? rule?.amount ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={handleFillExpected}
                      className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                    >
                      填入预期 ({(record.expected ?? rule?.amount ?? 0)} {record.currency})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={actualInput}
                    onChange={(e) => setActualInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-3 pr-14 py-2 border border-slate-300 rounded-xl text-sm font-semibold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                    {record.currency}
                  </span>
                </div>
              </div>

              {/* Formula & Calculation helper */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Calculator className="w-3.5 h-3.5 text-slate-400" />
                    速算公式 / 细则备注 (支持 0.8*2 或 3+5)
                  </label>
                </div>
                <input
                  type="text"
                  value={formulaExpr}
                  onChange={(e) => handleFormulaChange(e.target.value)}
                  placeholder="例: 0.8*2 或 微信摇到0.5元"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Monthly Limit Feature: Option to auto-skip rest of month */}
              {isMonthlyLimitRule && (
                <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-amber-900">
                    <input
                      type="checkbox"
                      checked={skipRestOfMonth}
                      onChange={(e) => setSkipRestOfMonth(e.target.checked)}
                      className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-semibold block">本月已完成，后续日期自动免提醒</span>
                      <span className="text-[11px] text-amber-700 leading-tight block mt-0.5">
                        该任务限制每个自然月完成 1 次。勾选后将自动跳过本月后续所有周期的待办提醒。
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">执行备注</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="如有特殊活动规则或失效说明可在此记录..."
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 sm:py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all"
          >
            确认提交打卡
          </button>
        </div>
      </div>
    </div>
  );
};
