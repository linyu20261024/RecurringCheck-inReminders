import React, { useState, useEffect, useMemo } from 'react';
import { TaskRecord, TaskRule } from '../types';
import { evaluateFormula, getRulePeriodCapUsage } from '../services/dataStorage';
import { X, CheckCircle2, Calculator, AlertCircle, Ban, Clock, Bell, ShieldCheck, RotateCcw } from 'lucide-react';

interface QuickCheckInModalProps {
  record: TaskRecord;
  rule?: TaskRule;
  allRecords?: TaskRecord[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRecord: TaskRecord, skipRestOfMonth?: boolean) => void;
}

export const QuickCheckInModal: React.FC<QuickCheckInModalProps> = ({
  record,
  rule,
  allRecords,
  isOpen,
  onClose,
  onSave,
}) => {
  const getInitialActual = (rec: TaskRecord) => {
    if (rec.status === 'done' && rec.actual !== undefined) {
      return String(rec.actual);
    }
    return rec.actual !== undefined && rec.actual > 0 ? String(rec.actual) : '';
  };

  const [actualInput, setActualInput] = useState<string>(() => getInitialActual(record));
  const [formulaExpr, setFormulaExpr] = useState<string>(record.feedback || '');
  const [notes, setNotes] = useState<string>(record.notes || '');
  const [status, setStatus] = useState<TaskRecord['status']>(record.status || 'done');
  const [skipRestOfMonth, setSkipRestOfMonth] = useState<boolean>(true);

  // Update input if record changes
  useEffect(() => {
    setActualInput(getInitialActual(record));
    setFormulaExpr(record.feedback || '');
    setNotes(record.notes || '');
    setStatus(record.status === 'pending' ? 'done' : record.status);
    setSkipRestOfMonth(true);
  }, [record]);

  const capUsage = useMemo(() => {
    if (!rule || !allRecords) return null;
    return getRulePeriodCapUsage(rule, record.date, allRecords);
  }, [rule, allRecords, record.date]);

  // Available remaining cap excluding this record's already-counted amount (if editing a done record)
  const availableForThisRecord = useMemo(() => {
    if (!capUsage) return null;
    const priorContribution = record.status === 'done' ? record.actual || 0 : 0;
    return Math.max(0, Math.round((capUsage.remainingAmount + priorContribution) * 100) / 100);
  }, [capUsage, record.status, record.actual]);

  const formatCapVal = (val: number) => {
    if (record.currency === 'CNY') return `¥${val.toFixed(2).replace(/\.00$/, '')}`;
    if (record.currency === 'points') return `${val} 积分`;
    return `${val}`;
  };

  if (!isOpen) return null;

  const parsedActual = actualInput.trim() ? parseFloat(actualInput) : 0;
  const numericActual = isNaN(parsedActual) ? 0 : parsedActual;

  const exceedsSingleCap =
    status === 'done' &&
    !!rule?.singleCapAmount &&
    rule.singleCapAmount > 0 &&
    numericActual > rule.singleCapAmount + 1e-6;

  const exceedsPeriodCap =
    status === 'done' &&
    availableForThisRecord !== null &&
    numericActual > availableForThisRecord + 1e-6;

  // Auto-evaluate formula if user types math expression in formulaExpr
  const handleFormulaChange = (val: string) => {
    setFormulaExpr(val);
    const calculated = evaluateFormula(val);
    if (calculated !== null) {
      setActualInput(String(calculated));
    }
  };

  const handleFillExpected = () => {
    let exp = record.expected ?? rule?.amount ?? 0;
    if (rule?.singleCapAmount && rule.singleCapAmount > 0) {
      exp = Math.min(exp, rule.singleCapAmount);
    }
    if (availableForThisRecord !== null) {
      exp = Math.min(exp, availableForThisRecord);
    }
    setActualInput(String(Math.round(exp * 100) / 100));
    setStatus('done');
  };

  const handleFillRemainingCap = () => {
    if (availableForThisRecord === null) return;
    let val = availableForThisRecord;
    if (rule?.singleCapAmount && rule.singleCapAmount > 0) {
      val = Math.min(val, rule.singleCapAmount);
    }
    setActualInput(String(Math.round(val * 100) / 100));
    setStatus('done');
  };

  const handleSave = () => {
    const isRestoringPending = status === 'pending';
    const num = !isRestoringPending && actualInput.trim() ? parseFloat(actualInput) : 0;
    const now = new Date().toISOString();
    const hasAutoSkipFlag = !!(
      record.monthlyLimitReached ||
      record.weeklyLimitReached ||
      record.solarTermLimitReached ||
      record.advanceDoneSkipped ||
      record.capReachedSkipped
    );
    const cleanedFeedback =
      isRestoringPending && hasAutoSkipFlag && formulaExpr.trim() === (record.feedback || '').trim()
        ? ''
        : formulaExpr.trim();

    const updated: TaskRecord = {
      ...record,
      status,
      actual: isNaN(num) ? 0 : num,
      feedback: cleanedFeedback,
      notes: notes.trim(),
      completedAt: status === 'done' ? (record.completedAt || now) : undefined,
      received: status === 'done' && num > 0,
      ...(isRestoringPending
        ? {
            monthlyLimitReached: false,
            weeklyLimitReached: false,
            solarTermLimitReached: false,
            advanceDoneSkipped: false,
            capReachedSkipped: false,
          }
        : {}),
    };
    const shouldAutoSkip =
      status === 'done' &&
      ((!!rule?.monthlyLimit && rule.monthlyLimit > 0) ||
        (!!rule?.weeklyLimit && rule.weeklyLimit > 0) ||
        (!!rule?.solarTermLimit && rule.solarTermLimit > 0) ||
        (!!rule?.periodCapAmount && rule.periodCapAmount > 0) ||
        (!!rule?.remindAdvanceDays && rule.remindAdvanceDays > 0));
    onSave(updated, shouldAutoSkip ? skipRestOfMonth : false);
    onClose();
  };

  const isMonthlyLimitRule = !!rule?.monthlyLimit && rule.monthlyLimit > 0;
  const isWeeklyLimitRule = !!rule?.weeklyLimit && rule.weeklyLimit > 0;
  const isSolarTermLimitRule = !!rule?.solarTermLimit && rule.solarTermLimit > 0;
  const isPeriodCapRule = !!rule?.periodCapAmount && rule.periodCapAmount > 0;
  const isAdvanceReminderRule = !!rule?.remindAdvanceDays && rule.remindAdvanceDays > 0;
  const hasAnyCycleCap =
    isMonthlyLimitRule ||
    isWeeklyLimitRule ||
    isSolarTermLimitRule ||
    isPeriodCapRule ||
    isAdvanceReminderRule;

  const buildAutoSkipCopy = (): { title: string; desc: string } => {
    const parts: string[] = [];
    if (isWeeklyLimitRule) parts.push(`每周限 ${rule?.weeklyLimit} 次`);
    if (isMonthlyLimitRule) parts.push(`每月限 ${rule?.monthlyLimit} 次`);
    if (isSolarTermLimitRule) parts.push(`每节气限 ${rule?.solarTermLimit} 次`);
    if (isPeriodCapRule && capUsage) parts.push(`${capUsage.scopeLabel} ¥${capUsage.capAmount}`);
    if (isAdvanceReminderRule) parts.push(`提前 ${rule?.remindAdvanceDays} 天提醒`);

    if (isAdvanceReminderRule && parts.length === 1) {
      return {
        title: '已提前办理完成，本轮正日前自动免提醒',
        desc: '勾选后，距本次目标正日前的其余提前提醒日将自动跳过，不再重复弹出。',
      };
    }

    return {
      title: '达到本周期次数或封顶上限后，自动免提醒后续待办',
      desc: `当前规则已设置「${parts.join(' / ')}」。勾选后一旦达标或额度用满，本周期剩余日期将自动跳过；若后续撤回打卡会自动恢复待办。`,
    };
  };

  const autoSkipCopy = buildAutoSkipCopy();

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

              {/* Time Badge */}
              {(record.time || rule?.time) && (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{record.time || rule?.time}</span>
                  {(record.deadline || rule?.deadline) && (record.deadline || rule?.deadline) !== '23:59' && (
                    <span>~{record.deadline || rule?.deadline}</span>
                  )}
                </span>
              )}

              {(record.timeSensitive || rule?.timeSensitive) && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-500 text-white shadow-2xs">
                  ⏰ 限时敏感
                </span>
              )}

              {isMonthlyLimitRule && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                  月限{rule?.monthlyLimit}次
                </span>
              )}

              {isWeeklyLimitRule && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                  周限{rule?.weeklyLimit}次
                </span>
              )}

              {isSolarTermLimitRule && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                  节气限{rule?.solarTermLimit}次
                </span>
              )}

              {rule?.singleCapAmount && rule.singleCapAmount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-teal-50 text-teal-700 border border-teal-200/70">
                  单次封顶 {formatCapVal(rule.singleCapAmount)}
                </span>
              )}

              {capUsage && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${
                    capUsage.isCapReached
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-cyan-50 text-cyan-800 border-cyan-200/70'
                  }`}
                >
                  {capUsage.scopeLabel} {formatCapVal(capUsage.usedAmount)}/{formatCapVal(capUsage.capAmount)}
                </span>
              )}

              {rule?.frequency === 'yearly' && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-200/70">
                  公历年度周期
                </span>
              )}

              {rule?.frequency === 'lunar' && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-300/60">
                  {rule.lunarMonths && rule.lunarMonths.length > 0 ? '农历年度周期' : '农历周期'}
                </span>
              )}

              {record.daysUntilTarget !== undefined && record.daysUntilTarget > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-0.5">
                  <Bell className="w-2.5 h-2.5 text-sky-600" />
                  提前提醒 · 距正日({(record.targetDate || '').slice(5)})还有 {record.daysUntilTarget} 天
                </span>
              )}
              {record.daysUntilTarget === 0 &&
                (isAdvanceReminderRule || rule?.frequency === 'lunar' || rule?.frequency === 'yearly') && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  🎯 今日正日
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

          {/* Cap quota summary box */}
          {(rule?.singleCapAmount || capUsage) && (
            <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200/70 text-xs text-teal-950 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <div className="font-semibold flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {rule?.singleCapAmount && rule.singleCapAmount > 0 && (
                    <span>单次封顶: {formatCapVal(rule.singleCapAmount)}</span>
                  )}
                  {capUsage && (
                    <span>
                      {capUsage.scopeLabel}: {formatCapVal(capUsage.capAmount)}（已享 {formatCapVal(capUsage.usedAmount)}，剩余 {formatCapVal(capUsage.remainingAmount)}）
                    </span>
                  )}
                </div>
                {capUsage && (
                  <div className="w-full bg-teal-100 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        capUsage.isCapReached ? 'bg-emerald-600' : 'bg-teal-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round((capUsage.usedAmount / Math.max(0.01, capUsage.capAmount)) * 100))}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">任务状态</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setStatus('pending')}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  status === 'pending'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:text-sky-700'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                待办提醒
              </button>
              <button
                type="button"
                onClick={() => setStatus('done')}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
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
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
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
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  status === 'canceled'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                已取消
              </button>
            </div>
            {status === 'pending' && record.status !== 'pending' && (
              <p className="mt-1.5 text-[11px] text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 leading-relaxed">
                将恢复此任务为「待办提醒」状态并清零本次已记收益；若此前触发过周期次数或封顶自动免提醒，后续关联待办也将一并自动恢复。
              </p>
            )}
          </div>

          {/* Actual Yield / Earnings */}
          {status === 'done' && (
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    实际到账收益 ({record.currency})
                  </label>
                  <div className="flex items-center gap-2.5">
                    {availableForThisRecord !== null && availableForThisRecord > 0 && (
                      <button
                        type="button"
                        onClick={handleFillRemainingCap}
                        className="text-[11px] text-teal-700 hover:text-teal-800 font-medium hover:underline"
                      >
                        填入可享封顶 ({formatCapVal(availableForThisRecord)})
                      </button>
                    )}
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
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={actualInput}
                    onChange={(e) => setActualInput(e.target.value)}
                    placeholder="0.00"
                    className={`w-full pl-3 pr-14 py-2 border rounded-xl text-sm font-semibold tabular-nums focus:outline-hidden focus:ring-2 ${
                      exceedsSingleCap || exceedsPeriodCap
                        ? 'border-amber-400 focus:ring-amber-500 focus:border-amber-500 bg-amber-50/30'
                        : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                    {record.currency}
                  </span>
                </div>

                {(exceedsSingleCap || exceedsPeriodCap) && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      {exceedsSingleCap && rule?.singleCapAmount && (
                        <div>输入数值已超出「单次封顶 {formatCapVal(rule.singleCapAmount)}」，请确认是否为实际到账。</div>
                      )}
                      {exceedsPeriodCap && capUsage && availableForThisRecord !== null && (
                        <div>
                          输入数值已超出「{capUsage.scopeLabel}」本次剩余可用额度 ({formatCapVal(availableForThisRecord)})。
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                  placeholder="例如: 0.8*2 或 实收明细备注"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Limit / Cap / Advance Reminder: Option to auto-skip remaining cycle */}
              {hasAnyCycleCap && (
                <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-amber-900">
                    <input
                      type="checkbox"
                      checked={skipRestOfMonth}
                      onChange={(e) => setSkipRestOfMonth(e.target.checked)}
                      className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-semibold block">{autoSkipCopy.title}</span>
                      <span className="text-[11px] text-amber-700 leading-tight block mt-0.5">
                        {autoSkipCopy.desc}
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
            className={`px-5 py-2 rounded-xl text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all ${
              status === 'pending' && record.status !== 'pending'
                ? 'bg-sky-600 hover:bg-sky-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {status === 'pending' && record.status !== 'pending' ? '确认恢复待提醒' : '确认提交打卡'}
          </button>
        </div>
      </div>
    </div>
  );
};

