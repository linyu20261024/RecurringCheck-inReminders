import React, { useState, useMemo } from 'react';
import { TaskRule, FrequencyType, CurrencyType, PriorityType, TaskRecord } from '../types';
import {
  Plus,
  Search,
  CheckCircle2,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  AlertTriangle,
  Clock,
  X,
  Repeat,
  Sparkles,
} from 'lucide-react';

interface RuleManagerViewProps {
  rules: TaskRule[];
  records: TaskRecord[];
  currentDate: string;
  onAddRule: (rule: TaskRule) => void;
  onUpdateRule: (rule: TaskRule) => void;
  onDeleteRuleWithCascade: (ruleId: string, fromDate?: string) => void;
}

export const RuleManagerView: React.FC<RuleManagerViewProps> = ({
  rules,
  records,
  currentDate,
  onAddRule,
  onUpdateRule,
  onDeleteRuleWithCascade,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [frequencyFilter, setFrequencyFilter] = useState('all');

  // Modal state
  const [editingRule, setEditingRule] = useState<TaskRule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formPlatform, setFormPlatform] = useState('');
  const [formCategory, setFormCategory] = useState('签到');
  const [formFrequency, setFormFrequency] = useState<FrequencyType>('daily');
  const [formStartDate, setFormStartDate] = useState(currentDate);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [formEndDate, setFormEndDate] = useState('');
  const [hasMonthlyLimit, setHasMonthlyLimit] = useState(false);
  const [formMonthlyLimit, setFormMonthlyLimit] = useState('1');
  const [formWeekdays, setFormWeekdays] = useState<number[]>([]);
  const [formMonthdays, setFormMonthdays] = useState<string>('1');
  const [formAmount, setFormAmount] = useState('0');
  const [formCurrency, setFormCurrency] = useState<CurrencyType>('CNY');
  const [formPriority, setFormPriority] = useState<PriorityType>('中');
  const [formPath, setFormPath] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Delete confirmation state
  const [deleteTargetRule, setDeleteTargetRule] = useState<TaskRule | null>(null);

  // Platforms list
  const platformsList = useMemo(() => {
    return Array.from(new Set(rules.map((r) => r.platform))).sort();
  }, [rules]);

  // Categories list
  const categoriesList = useMemo(() => {
    return Array.from(new Set(rules.map((r) => r.category))).sort();
  }, [rules]);

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (platformFilter !== 'all' && r.platform !== platformFilter) return false;
      if (frequencyFilter !== 'all' && r.frequency !== frequencyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchPlat = r.platform.toLowerCase().includes(q);
        const matchPath = (r.path || '').toLowerCase().includes(q);
        if (!matchName && !matchPlat && !matchPath) return false;
      }
      return true;
    });
  }, [rules, categoryFilter, platformFilter, frequencyFilter, searchQuery]);

  const handleOpenAddModal = () => {
    setEditingRule(null);
    setFormName('');
    setFormPlatform('支付宝');
    setFormCategory('签到');
    setFormFrequency('daily');
    setFormStartDate(currentDate);
    setHasEndDate(false);
    setFormEndDate('');
    setHasMonthlyLimit(false);
    setFormMonthlyLimit('1');
    setFormWeekdays([]);
    setFormMonthdays('1');
    setFormAmount('0');
    setFormCurrency('CNY');
    setFormPriority('中');
    setFormPath('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: TaskRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormPlatform(rule.platform);
    setFormCategory(rule.category);
    setFormFrequency(rule.frequency);
    setFormStartDate(rule.startDate || currentDate);
    setHasEndDate(!!rule.endDate);
    setFormEndDate(rule.endDate || '');
    setHasMonthlyLimit(!!rule.monthlyLimit && rule.monthlyLimit > 0);
    setFormMonthlyLimit(rule.monthlyLimit ? String(rule.monthlyLimit) : '1');
    setFormWeekdays(rule.weekdays || []);
    setFormMonthdays((rule.monthdays || []).join(', ') || '1');
    setFormAmount(String(rule.amount ?? 0));
    setFormCurrency(rule.currency);
    setFormPriority(rule.priority);
    setFormPath(rule.path || '');
    setFormNotes(rule.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveRule = () => {
    if (!formName.trim() || !formPlatform.trim()) return;

    const amt = parseFloat(formAmount);
    const parsedMonthDays = formMonthdays
      .split(/[,， ]+/)
      .map((d) => parseInt(d.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 1 && n <= 31);

    const now = new Date().toISOString();
    const cleanEndDate = hasEndDate && formEndDate.trim() ? formEndDate.trim() : undefined;
    const parsedMonthlyLimit = hasMonthlyLimit ? Math.max(1, parseInt(formMonthlyLimit, 10) || 1) : undefined;

    if (editingRule) {
      const updated: TaskRule = {
        ...editingRule,
        name: formName.trim(),
        platform: formPlatform.trim(),
        category: formCategory,
        frequency: formFrequency,
        startDate: formStartDate || editingRule.startDate || currentDate,
        endDate: cleanEndDate,
        monthlyLimit: parsedMonthlyLimit,
        weekdays: formFrequency === 'weekly' ? formWeekdays : [],
        monthdays: formFrequency === 'monthly' ? parsedMonthDays : [],
        amount: isNaN(amt) ? 0 : amt,
        currency: formCurrency,
        priority: formPriority,
        path: formPath.trim(),
        notes: formNotes.trim(),
        updatedAt: now,
      };
      onUpdateRule(updated);
    } else {
      const newRule: TaskRule = {
        id: `rule_${Date.now()}`,
        name: formName.trim(),
        platform: formPlatform.trim(),
        category: formCategory,
        frequency: formFrequency,
        startDate: formStartDate || currentDate,
        endDate: cleanEndDate,
        monthlyLimit: parsedMonthlyLimit,
        weekdays: formFrequency === 'weekly' ? formWeekdays : [],
        monthdays: formFrequency === 'monthly' ? parsedMonthDays : [],
        amount: isNaN(amt) ? 0 : amt,
        currency: formCurrency,
        priority: formPriority,
        active: true,
        path: formPath.trim(),
        notes: formNotes.trim(),
        createdAt: now,
        updatedAt: now,
      };
      onAddRule(newRule);
    }

    setIsModalOpen(false);
  };

  const toggleRuleActive = (rule: TaskRule) => {
    onUpdateRule({
      ...rule,
      active: !rule.active,
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleWeekday = (day: number) => {
    setFormWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

  // Count pending records that will be auto-deleted if a rule is deleted
  const pendingRecordsToDeleteCount = useMemo(() => {
    if (!deleteTargetRule) return 0;
    return records.filter(
      (r) => r.ruleId === deleteTargetRule.id && r.status === 'pending' && r.date >= currentDate
    ).length;
  }, [deleteTargetRule, records, currentDate]);

  const confirmDelete = () => {
    if (!deleteTargetRule) return;
    onDeleteRuleWithCascade(deleteTargetRule.id, currentDate);
    setDeleteTargetRule(null);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-800">周期任务规则库</h2>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                共 {rules.length} 条规则
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              支持设置起止范围及「月限1次」免提醒；删除规则将联动清理后续未完成待办
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            新增周期任务规则
          </button>
        </div>

        {/* Filter Controls (Compact on mobile) */}
        <div className="pt-3 mt-3 border-t border-slate-100 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <div className="relative col-span-2 sm:flex-1 sm:min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索规则/App/路径..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 py-1.5 px-2 rounded-xl focus:outline-hidden"
          >
            <option value="all">全部分类</option>
            {categoriesList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Platform */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 py-1.5 px-2 rounded-xl focus:outline-hidden"
          >
            <option value="all">全部平台</option>
            {platformsList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Frequency */}
          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="col-span-2 sm:col-span-1 bg-slate-50 border border-slate-200 text-xs text-slate-700 py-1.5 px-2 rounded-xl focus:outline-hidden"
          >
            <option value="all">全部周期频次</option>
            <option value="daily">每日 (daily)</option>
            <option value="weekly">每周 (weekly)</option>
            <option value="monthly">每月 (monthly)</option>
            <option value="solar">节气 (solar)</option>
            <option value="once">单次 (once)</option>
          </select>
        </div>
      </div>

      {/* Rules List: Responsive Mobile Cards (sm:hidden) + Desktop Table (hidden sm:block) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredRules.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-xs text-slate-400">
            {rules.length === 0
              ? '当前暂无规则，点击上方「新增周期任务规则」或在顶部「导入/导出数据」中载入备份。'
              : '未找到匹配的规则'}
          </div>
        ) : (
          <>
            {/* MOBILE CARD VIEW (Optimized for thumb tap and zero horizontal scroll) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filteredRules.map((r) => (
                <div
                  key={r.id}
                  className={`p-3.5 space-y-2 transition-colors ${
                    !r.active ? 'opacity-60 bg-slate-50/40' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                          {r.platform}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 truncate">{r.name}</h4>
                        {r.priority === '高' && (
                          <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200/50">
                            高
                          </span>
                        )}
                        {r.monthlyLimit && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            月限{r.monthlyLimit}次
                          </span>
                        )}
                      </div>

                      {/* Schedule info */}
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>
                          {r.frequency === 'daily' && '每日'}
                          {r.frequency === 'weekly' &&
                            `每周 ${(r.weekdays || []).map((w) => `周${weekdayLabels[w]}`).join('、')}`}
                          {r.frequency === 'monthly' && `每月 ${(r.monthdays || []).join('、')}日`}
                          {r.frequency === 'solar' && '24节气'}
                          {r.frequency === 'once' && '单次'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-[10px]">
                          {r.startDate} ~ {r.endDate || '长期'}
                        </span>
                      </div>

                      {/* Path */}
                      {r.path && (
                        <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                          {r.path}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold tabular-nums text-indigo-700">
                        {r.currency === 'CNY'
                          ? `¥${(r.amount || 0).toFixed(2)}`
                          : `${(r.amount || 0).toLocaleString()} 分`}
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                    <button
                      type="button"
                      onClick={() => toggleRuleActive(r)}
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                        r.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {r.active ? '生效中' : '已暂停'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(r)}
                        className="px-2.5 py-1 text-slate-600 hover:text-indigo-600 bg-slate-50 rounded-lg text-xs font-medium border border-slate-200 flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetRule(r)}
                        className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium border border-rose-200 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE VIEW (hidden on mobile) */}
            <div className="hidden sm:block overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-3 px-4">状态</th>
                    <th className="py-3 px-4">平台</th>
                    <th className="py-3 px-4">任务规则名称</th>
                    <th className="py-3 px-4">周期类型</th>
                    <th className="py-3 px-4">起止有效范围</th>
                    <th className="py-3 px-4">预期收益</th>
                    <th className="py-3 px-4">App 路径指引</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRules.map((r) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !r.active ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => toggleRuleActive(r)}
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md transition-colors ${
                            r.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {r.active ? '生效中' : '已暂停'}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{r.platform}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                          <span>{r.name}</span>
                          {r.monthlyLimit && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              月限{r.monthlyLimit}次
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                          <span>{r.category}</span>
                          {r.priority === '高' && (
                            <span className="text-rose-600 font-semibold">· 高优先级</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {r.frequency === 'daily' && '每日'}
                        {r.frequency === 'weekly' &&
                          `每周 ${(r.weekdays || []).map((w) => `周${weekdayLabels[w]}`).join('、')}`}
                        {r.frequency === 'monthly' && `每月 ${(r.monthdays || []).join('、')}日`}
                        {r.frequency === 'solar' && '24节气活动'}
                        {r.frequency === 'once' && '单次'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        <span>{r.startDate || '不限'}</span>
                        <span className="text-slate-400 mx-1">至</span>
                        <span className={r.endDate ? 'text-slate-700' : 'text-emerald-600 font-semibold'}>
                          {r.endDate || '长期有效'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold tabular-nums text-indigo-700">
                        {r.currency === 'CNY'
                          ? `¥${(r.amount || 0).toFixed(2)}`
                          : `${(r.amount || 0).toLocaleString()} 积分`}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 max-w-xs truncate text-[11px]">
                        {r.path || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(r)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetRule(r)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="删除规则并清理未完成待办"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete Rule Confirmation Dialog */}
      {deleteTargetRule && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold">确认删除规则及后续待办？</h3>
              </div>
              <button
                onClick={() => setDeleteTargetRule(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                即将删除规则 <strong className="text-slate-800 font-bold">「{deleteTargetRule.name}」</strong>
                （{deleteTargetRule.platform} · {deleteTargetRule.category}）。
              </p>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  自动清理机制说明:
                </div>
                <p className="text-[11px] leading-relaxed">
                  • 系统将<strong>自动删除</strong>该规则从今日（{currentDate}）起及未来的{' '}
                  <strong className="text-rose-700">{pendingRecordsToDeleteCount} 条未完成待办任务</strong>。
                </p>
                <p className="text-[11px] leading-relaxed">
                  • 历史已完成的实际收益记录将予以<strong>妥善保留</strong>，确保您的历史收益报表准确无误。
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetRule(null)}
                className="px-4 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
              >
                确认删除并清理任务
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Rule Modal (Responsive Bottom Sheet on Mobile) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">
                {editingRule ? '编辑周期任务规则' : '新增周期任务规则'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              {/* Platform & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    所属平台 / App
                  </label>
                  <input
                    type="text"
                    value={formPlatform}
                    onChange={(e) => setFormPlatform(e.target.value)}
                    placeholder="例: 支付宝、微信、建行生活"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">任务名称</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例: 每日签到抽红包"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Start Date & End Date */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    任务起止有效日期
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hasEndDate}
                      onChange={(e) => setHasEndDate(!e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>长期有效 (无截止日期)</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 mb-1">开始生效日期</span>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden bg-white"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 mb-1">
                      结束截止日期 {hasEndDate ? '(必填)' : '(已设长期)'}
                    </span>
                    <input
                      type="date"
                      disabled={!hasEndDate}
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      placeholder={hasEndDate ? 'YYYY-MM-DD' : '长期有效'}
                      className={`w-full px-2.5 py-1.5 border rounded-xl text-xs focus:outline-hidden ${
                        hasEndDate
                          ? 'border-slate-300 text-slate-800 bg-white'
                          : 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Category, Frequency, Priority */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">分类</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-hidden bg-white"
                  >
                    <option value="签到">签到</option>
                    <option value="收益任务">收益任务</option>
                    <option value="限时活动">限时活动</option>
                    <option value="投资/理财">投资/理财</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">周期频次</label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value as FrequencyType)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-hidden bg-white"
                  >
                    <option value="daily">每日 (daily)</option>
                    <option value="weekly">每周 (weekly)</option>
                    <option value="monthly">每月 (monthly)</option>
                    <option value="solar">节气 (solar)</option>
                    <option value="once">单次 (once)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">优先级</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as PriorityType)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-hidden bg-white"
                  >
                    <option value="高">高优先级</option>
                    <option value="中">中等</option>
                    <option value="低">低</option>
                  </select>
                </div>
              </div>

              {/* Monthly Limit Feature (每周五触发但当月仅限1次) */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-amber-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasMonthlyLimit}
                      onChange={(e) => setHasMonthlyLimit(e.target.checked)}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>限制自然月最多完成次数（如：每周五触发但当月只做 1 次）</span>
                  </label>
                </div>

                {hasMonthlyLimit && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-amber-800">当月达成</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formMonthlyLimit}
                      onChange={(e) => setFormMonthlyLimit(e.target.value)}
                      className="w-16 px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold tabular-nums text-amber-900 focus:outline-hidden"
                    />
                    <span className="text-xs text-amber-800">次后，本月后续触发日自动免提醒</span>
                  </div>
                )}
              </div>

              {/* Weekly Day Selector */}
              {formFrequency === 'weekly' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    选择每周星期几提醒:
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleWeekday(d)}
                        className={`flex-1 py-1 text-xs font-bold rounded-lg border transition-colors ${
                          formWeekdays.includes(d)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        周{weekdayLabels[d]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly Day Selector */}
              {formFrequency === 'monthly' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    每月哪几天提醒 (逗号隔开，例: 1, 10, 15, 20)
                  </label>
                  <input
                    type="text"
                    value={formMonthdays}
                    onChange={(e) => setFormMonthdays(e.target.value)}
                    placeholder="1, 10, 15"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                  />
                </div>
              )}

              {/* Amount and Currency */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">预期收益额</label>
                  <input
                    type="number"
                    step="any"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold tabular-nums text-slate-800 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">收益计量单位</label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value as CurrencyType)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-hidden bg-white"
                  >
                    <option value="CNY">CNY (元人民币)</option>
                    <option value="points">points (积分/积点)</option>
                    <option value="other">other (时长/礼券)</option>
                  </select>
                </div>
              </div>

              {/* App Internal Path */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  App 内部操作路径 (如: 首页 -&gt; 酷玩中心 -&gt; 签到)
                </label>
                <input
                  type="text"
                  value={formPath}
                  onChange={(e) => setFormPath(e.target.value)}
                  placeholder="首页->酷玩中心->签到"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">备注说明</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="例如: 每周五10点抢立减金，当月仅限1次..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveRule}
                className="px-5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
              >
                保存规则
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
