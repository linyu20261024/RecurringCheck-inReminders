import { AppDataBackup, TaskRule, TaskRecord, OptimizationDiagnosis } from '../types';
import { getLunarDateInfo, getWeekDateRange, isLunarRuleMatched } from './lunarCalendar';

const STORAGE_KEY = 'periodic_tasks_app_data_v2';

// Helper: safe JSON parse
export function safeJsonParse<T>(jsonStr: string, fallback: T): T {
  try {
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    console.error('Failed to parse JSON:', err);
    return fallback;
  }
}

// Initial empty backup (Default is empty on first load)
export function getEmptyBackup(): AppDataBackup {
  return {
    version: 2,
    rules: [],
    records: [],
    _savedAt: Date.now(),
  };
}

// Load data: only read from localStorage. If empty or not set, return empty dataset!
// Note: We do NOT auto-fetch default data on startup per user request.
export async function loadInitialData(): Promise<AppDataBackup> {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as AppDataBackup;
      if (parsed && Array.isArray(parsed.rules)) {
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse cached localStorage data:', e);
    }
  }

  // First time opening: empty dataset
  return getEmptyBackup();
}

// Save to local storage
export function saveDataToLocalStorage(data: AppDataBackup): void {
  try {
    const toSave: AppDataBackup = {
      ...data,
      _savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.error('LocalStorage save error:', err);
  }
}

// Clear all local data
export function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Normalize & validate imported data (safely filters out surgeTasks)
export function normalizeBackupData(raw: unknown): AppDataBackup {
  if (!raw || typeof raw !== 'object') {
    throw new Error('无效的 JSON 数据格式');
  }

  const obj = raw as Record<string, unknown>;
  const rawRules = Array.isArray(obj.rules) ? (obj.rules as TaskRule[]) : [];
  const rawRecords = Array.isArray(obj.records) ? (obj.records as TaskRecord[]) : [];

  const rules: TaskRule[] = rawRules.map((r, i) => {
    const isTimeSensitive =
      r.timeSensitive !== undefined
        ? !!r.timeSensitive
        : (r.time && r.time !== '00:00' && r.time !== '09:00') ||
          (r.deadline && r.deadline !== '23:59') ||
          /券|抢|秒杀|限时|早鸟|消费季|五折|一元购/.test(r.name || '');

    return {
      id: r.id || `rule_${Date.now()}_${i}`,
      name: r.name || '未命名任务',
      platform: r.platform || '其他',
      category: r.category || '签到',
      frequency: r.frequency || 'daily',
      startDate: r.startDate || getTodayString(),
      endDate: r.endDate && r.endDate.trim() ? r.endDate.trim() : undefined,
      time: r.time || '09:00',
      deadline: r.deadline || '23:59',
      timeSensitive: isTimeSensitive,
      weekdays: Array.isArray(r.weekdays) ? r.weekdays : [],
      monthdays: Array.isArray(r.monthdays) ? r.monthdays : [],
      lunarMonthdays: Array.isArray(r.lunarMonthdays) ? r.lunarMonthdays : [],
      lunarMonths: Array.isArray(r.lunarMonths) ? r.lunarMonths : [],
      lunarIncludeLeapMonth: !!r.lunarIncludeLeapMonth,
      lunarLastDayPolicy: r.lunarLastDayPolicy === 'skip' ? 'skip' : 'lastDay',
      remindAdvanceDays: typeof r.remindAdvanceDays === 'number' && r.remindAdvanceDays > 0 ? Math.floor(r.remindAdvanceDays) : undefined,
      solarTerms: Array.isArray(r.solarTerms) ? r.solarTerms : [],
      monthPolicy: r.monthPolicy || 'skip',
      intervalN: typeof r.intervalN === 'number' ? r.intervalN : 1,
      unit: r.unit || 'day',
      amount: typeof r.amount === 'number' ? r.amount : 0,
      currency: r.currency || 'CNY',
      priority: r.priority || '中',
      active: r.active !== false,
      monthlyLimit: typeof r.monthlyLimit === 'number' && r.monthlyLimit > 0 ? r.monthlyLimit : undefined,
      weeklyLimit: typeof r.weeklyLimit === 'number' && r.weeklyLimit > 0 ? r.weeklyLimit : undefined,
      solarTermLimit: typeof r.solarTermLimit === 'number' && r.solarTermLimit > 0 ? r.solarTermLimit : undefined,
      path: r.path || '',
      notes: r.notes || '',
      createdAt: r.createdAt || new Date().toISOString(),
      updatedAt: r.updatedAt || new Date().toISOString(),
    };
  });

  const ruleMap = new Map<string, TaskRule>();
  rules.forEach((r) => ruleMap.set(r.id, r));

  const records: TaskRecord[] = rawRecords.map((rec, i) => {
    const rule = ruleMap.get(rec.ruleId);
    return {
      id: rec.id || `record_${Date.now()}_${i}`,
      ruleId: rec.ruleId,
      name: rec.name || rule?.name || '',
      platform: rec.platform || rule?.platform || '其他',
      category: rec.category || rule?.category || '签到',
      date: rec.date || getTodayString(),
      time: rec.time || rule?.time || '09:00',
      deadline: rec.deadline || rule?.deadline || '23:59',
      timeSensitive: rec.timeSensitive !== undefined ? !!rec.timeSensitive : !!rule?.timeSensitive,
      targetDate: rec.targetDate,
      daysUntilTarget: typeof rec.daysUntilTarget === 'number' ? rec.daysUntilTarget : undefined,
      plannedAt: rec.plannedAt,
      deadlineAt: rec.deadlineAt,
      expected: typeof rec.expected === 'number' ? rec.expected : (rule?.amount ?? 0),
      currency: rec.currency || rule?.currency || 'CNY',
      status: rec.status || 'pending',
      actual: typeof rec.actual === 'number' ? rec.actual : 0,
      received: !!rec.received,
      completedAt: rec.completedAt,
      feedback: rec.feedback || '',
      path: rec.path || rule?.path || '',
      notes: rec.notes || rule?.notes || '',
      priority: rec.priority || rule?.priority || '中',
      monthlyLimitReached: !!rec.monthlyLimitReached,
      weeklyLimitReached: !!rec.weeklyLimitReached,
      solarTermLimitReached: !!rec.solarTermLimitReached,
      advanceDoneSkipped: !!rec.advanceDoneSkipped,
      createdAt: rec.createdAt,
    };
  });

  return {
    version: typeof obj.version === 'number' ? obj.version : 2,
    rules,
    records,
    _savedAt: Date.now(),
  };
}

// Synchronize rule changes to existing unexecuted (pending) task records
export function syncRuleToPendingRecords(
  data: AppDataBackup,
  updatedRule: TaskRule
): { updatedData: AppDataBackup; updatedPendingCount: number; removedPendingCount: number } {
  let updatedPendingCount = 0;
  let removedPendingCount = 0;

  // 1. Update rules list
  const newRules = data.rules.map((r) => (r.id === updatedRule.id ? updatedRule : r));

  // 2. Cascade update or remove pending records for this rule
  const newRecords: TaskRecord[] = [];

  for (const rec of data.records) {
    if (rec.ruleId === updatedRule.id) {
      if (rec.status === 'done') {
        // Keep completed records intact to preserve historical records & earnings
        newRecords.push(rec);
        continue;
      }

      if (rec.status === 'pending') {
        // If rule became inactive, prune pending record
        if (!updatedRule.active) {
          removedPendingCount++;
          continue;
        }

        // If task date is before startDate or after endDate, prune
        if (updatedRule.startDate && rec.date < updatedRule.startDate) {
          removedPendingCount++;
          continue;
        }
        if (updatedRule.endDate && rec.date > updatedRule.endDate) {
          removedPendingCount++;
          continue;
        }

        // Check if rule is still scheduled for this date under the new rule schedule
        const match = getRuleScheduleMatchForDate(updatedRule, rec.date, data.records);
        if (!match.matched) {
          removedPendingCount++;
          continue;
        }

        // Otherwise synchronize all modified attributes from the updated rule!
        updatedPendingCount++;
        newRecords.push({
          ...rec,
          name: updatedRule.name,
          platform: updatedRule.platform,
          category: updatedRule.category,
          expected: updatedRule.amount,
          currency: updatedRule.currency,
          time: updatedRule.time || '09:00',
          deadline: updatedRule.deadline || '23:59',
          timeSensitive: !!updatedRule.timeSensitive,
          targetDate: match.targetDate,
          daysUntilTarget: match.daysUntilTarget,
          path: updatedRule.path,
          notes: updatedRule.notes,
          priority: updatedRule.priority,
        });
        continue;
      }
    }

    // Keep other rules' records or other statuses as-is
    newRecords.push(rec);
  }

  const updatedData: AppDataBackup = {
    ...data,
    rules: newRules,
    records: newRecords,
    _savedAt: Date.now(),
  };

  saveDataToLocalStorage(updatedData);
  return { updatedData, updatedPendingCount, removedPendingCount };
}

// Delete rule and automatically purge its pending records (from given date onward, or all pending records)
export function deleteRuleAndPendingRecords(
  data: AppDataBackup,
  ruleId: string,
  fromDate?: string
): { updatedData: AppDataBackup; deletedPendingCount: number } {
  const newRules = data.rules.filter((r) => r.id !== ruleId);

  // Keep records that belong to other rules, or completed records of this rule (to preserve historical yields)
  // Delete pending records of this rule that are >= fromDate (or all pending if no fromDate)
  let deletedPendingCount = 0;
  const newRecords = data.records.filter((rec) => {
    if (rec.ruleId === ruleId) {
      if (rec.status === 'pending') {
        if (!fromDate || rec.date >= fromDate) {
          deletedPendingCount++;
          return false; // delete this pending record
        }
      }
    }
    return true; // keep
  });

  const updatedData: AppDataBackup = {
    ...data,
    rules: newRules,
    records: newRecords,
    _savedAt: Date.now(),
  };

  saveDataToLocalStorage(updatedData);
  return { updatedData, deletedPendingCount };
}

// Export data to downloadable JSON
export function exportDataAsJson(
  data: AppDataBackup,
  filename = `周期任务备份_${formatDate(new Date())}.json`
): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Date formatter YYYY-MM-DD
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Get today's date formatted as YYYY-MM-DD dynamically from system clock
export function getTodayString(): string {
  return formatDate(new Date());
}

// Add or subtract days from a YYYY-MM-DD date string
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

// Evaluate arithmetic string expression safely (e.g. "0.8*2" or "3+2*5")
export function evaluateFormula(expr: string): number | null {
  if (!expr || typeof expr !== 'string') return null;
  const cleaned = expr.trim();
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned);
  }
  if (cleaned.includes('=')) {
    const parts = cleaned.split('=');
    const lastPart = parts[parts.length - 1].trim();
    if (/^-?\d+(\.\d+)?$/.test(lastPart)) {
      return parseFloat(lastPart);
    }
  }
  if (/^[\d+\-*/(). ]+$/.test(cleaned)) {
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${cleaned});`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.round(result * 100) / 100;
      }
    } catch {
      return null;
    }
  }
  return null;
}

// Analyze template redundancy and optimization potential
export function analyzeTemplateOptimization(data: AppDataBackup): OptimizationDiagnosis {
  const rawJson = JSON.stringify(data, null, 2);
  const rawBytes = new Blob([rawJson]).size;

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

  const compactData = {
    version: 3,
    rules: compactRules,
    records: compactRecords,
  };

  const compactBytes = new Blob([JSON.stringify(compactData)]).size;
  const compressionRatio = rawBytes > 0 ? Math.round(((rawBytes - compactBytes) / rawBytes) * 100) : 0;

  const ruleIds = new Set(data.rules.map((r) => r.id));
  const orphanedRecords = data.records.filter((r) => !ruleIds.has(r.ruleId)).length;

  const redundantScheduleFieldsCount = data.rules.filter(
    (r) => r.frequency !== 'interval' && r.intervalN !== undefined
  ).length;

  const zeroAmountRules = data.rules.filter((r) => r.amount === 0).length;
  const unrecordedActual = data.records.filter(
    (r) => r.status === 'done' && (r.actual === undefined || r.actual === 0) && (r.expected ?? 0) > 0
  ).length;
  const platforms = new Set(data.rules.map((r) => r.platform)).size;

  return {
    totalRules: data.rules.length,
    totalRecords: data.records.length,
    rawJsonSizeBytes: rawBytes,
    optimizedJsonSizeBytes: compactBytes,
    compressionRatio,
    redundantRecordFields: ['name', 'platform', 'category', 'path', 'notes', 'priority', 'currency'],
    redundantScheduleFieldsCount,
    zeroAmountRuleCount: zeroAmountRules,
    unrecordedActualCount: unrecordedActual,
    platformCount: platforms,
    orphanedRecordsCount: orphanedRecords,
  };
}

export interface RuleScheduleMatch {
  matched: boolean;
  targetDate?: string;
  daysUntilTarget?: number;
}

// Evaluate whether dateStr is the exact trigger date of the rule (without advance window or period caps)
export function isBaseRuleExactDateMatch(rule: TaskRule, dateStr: string): boolean {
  const date = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = date.getDay(); // 0 is Sunday
  const dayOfMonth = date.getDate();

  switch (rule.frequency) {
    case 'daily':
      return true;

    case 'weekly':
      if (rule.weekdays && rule.weekdays.length > 0) {
        return rule.weekdays.includes(dayOfWeek);
      }
      return true;

    case 'monthly': {
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      if (rule.monthdays && rule.monthdays.length > 0) {
        if (rule.monthdays.includes(dayOfMonth)) return true;
        if (rule.monthPolicy === 'lastDay' && dayOfMonth === daysInMonth && rule.monthdays.some((d) => d > daysInMonth)) {
          return true;
        }
        return false;
      }
      return dayOfMonth === 1;
    }

    case 'lunar':
      return isLunarRuleMatched(
        dateStr,
        rule.lunarMonthdays,
        rule.lunarMonths,
        !!rule.lunarIncludeLeapMonth,
        rule.lunarLastDayPolicy || 'lastDay'
      );

    case 'solar': {
      const lunarInfo = getLunarDateInfo(dateStr);
      const hasAdvance = !!rule.remindAdvanceDays && rule.remindAdvanceDays > 0;
      if (rule.solarTerms && rule.solarTerms.length > 0) {
        if (!hasAdvance && rule.solarTermLimit && rule.solarTermLimit > 0) {
          if (lunarInfo.solarTerm && rule.solarTerms.includes(lunarInfo.solarTerm)) return true;
          return rule.solarTerms.includes(lunarInfo.currentSolarTerm.name);
        }
        return !!lunarInfo.solarTerm && rule.solarTerms.includes(lunarInfo.solarTerm);
      }
      return !!lunarInfo.solarTerm;
    }

    case 'once':
      return rule.startDate === dateStr;

    case 'interval': {
      if (!rule.startDate) return true;
      const start = new Date(`${rule.startDate}T12:00:00`);
      const diffDays = Math.round((date.getTime() - start.getTime()) / 86400000);
      if (diffDays < 0) return false;
      const step = Math.max(1, rule.intervalN || 1);
      if (rule.unit === 'week') {
        return diffDays % (step * 7) === 0;
      }
      return diffDays % step === 0;
    }

    default:
      return true;
  }
}

// Check if a rule is scheduled for a given date string (YYYY-MM-DD), returning targetDate & countdown days
export function getRuleScheduleMatchForDate(
  rule: TaskRule,
  dateStr: string,
  existingRecords?: TaskRecord[]
): RuleScheduleMatch {
  if (!rule.active) return { matched: false };
  if (rule.startDate && dateStr < rule.startDate) return { matched: false };
  if (rule.endDate && dateStr > rule.endDate) return { matched: false };

  const lunarInfo = getLunarDateInfo(dateStr);

  // 1. Weekly limit check: e.g. "周频次但每周只能做 1 次"
  if (rule.weeklyLimit && rule.weeklyLimit > 0 && existingRecords) {
    const { startOfWeek, endOfWeek } = getWeekDateRange(dateStr);
    const doneInWeek = existingRecords.filter(
      (r) =>
        r.ruleId === rule.id &&
        r.status === 'done' &&
        r.date >= startOfWeek &&
        r.date <= endOfWeek
    );
    if (doneInWeek.length >= rule.weeklyLimit) {
      const isDoneOnThisDate = doneInWeek.some((r) => r.date === dateStr);
      if (!isDoneOnThisDate) {
        return { matched: false };
      }
    }
  }

  // 2. Monthly limit check: e.g. "每周五触发但一个自然月只能做 1 次"
  if (rule.monthlyLimit && rule.monthlyLimit > 0 && existingRecords) {
    const monthPrefix = dateStr.slice(0, 7);
    const doneInMonth = existingRecords.filter(
      (r) => r.ruleId === rule.id && r.status === 'done' && r.date.startsWith(monthPrefix)
    );
    if (doneInMonth.length >= rule.monthlyLimit) {
      const isDoneOnThisDate = doneInMonth.some((r) => r.date === dateStr);
      if (!isDoneOnThisDate) {
        return { matched: false };
      }
    }
  }

  // 3. Solar term limit check: e.g. "中国24节气活动，每个节气周期（约15天）内做满指定次数即免提醒"
  if (rule.solarTermLimit && rule.solarTermLimit > 0 && existingRecords) {
    const { startDate, endDate } = lunarInfo.currentSolarTerm;
    const doneInSolarTerm = existingRecords.filter(
      (r) =>
        r.ruleId === rule.id &&
        r.status === 'done' &&
        r.date >= startDate &&
        r.date <= endDate
    );
    if (doneInSolarTerm.length >= rule.solarTermLimit) {
      const isDoneOnThisDate = doneInSolarTerm.some((r) => r.date === dateStr);
      if (!isDoneOnThisDate) {
        return { matched: false };
      }
    }
  }

  // 4. Advance reminder window evaluation (0 = exact date only, N > 0 = check dateStr..dateStr+N)
  const advanceDays = rule.frequency === 'daily' ? 0 : Math.max(0, Math.floor(rule.remindAdvanceDays || 0));

  for (let offset = 0; offset <= advanceDays; offset++) {
    const candidateTarget = offset === 0 ? dateStr : addDays(dateStr, offset);
    if (rule.endDate && candidateTarget > rule.endDate) continue;

    if (isBaseRuleExactDateMatch(rule, candidateTarget)) {
      // If this exact target occurrence was already marked done in the advance window, suppress repeating reminders
      if (existingRecords && advanceDays > 0) {
        const windowStart = addDays(candidateTarget, -advanceDays);
        const doneForCycle = existingRecords.filter(
          (r) =>
            r.ruleId === rule.id &&
            r.status === 'done' &&
            (r.targetDate === candidateTarget ||
              (!r.targetDate && r.date >= windowStart && r.date <= candidateTarget))
        );
        if (doneForCycle.length > 0 && !doneForCycle.some((r) => r.date === dateStr)) {
          continue;
        }
      }

      return {
        matched: true,
        targetDate: candidateTarget,
        daysUntilTarget: offset,
      };
    }
  }

  return { matched: false };
}

// Check if a rule is scheduled for a given date string (YYYY-MM-DD)
// Strictly honors startDate, endDate, advance reminders, weeklyLimit, monthlyLimit, solarTermLimit, and lunar/solar calculations
export function isRuleScheduledForDate(
  rule: TaskRule,
  dateStr: string,
  existingRecords?: TaskRecord[]
): boolean {
  return getRuleScheduleMatchForDate(rule, dateStr, existingRecords).matched;
}

// Automatically skip or suppress subsequent pending records of a rule when a limit or advance-reminder cycle is fulfilled
export function skipFutureLimitRecords(
  data: AppDataBackup,
  ruleId: string,
  completedDate: string,
  completedTargetDate?: string
): AppDataBackup {
  const rule = data.rules.find((r) => r.id === ruleId);
  if (!rule) return data;

  const monthPrefix = completedDate.slice(0, 7);
  const { startOfWeek, endOfWeek } = getWeekDateRange(completedDate);
  const lunarInfo = getLunarDateInfo(completedDate);
  const solarTermWindow = lunarInfo.currentSolarTerm;

  let changed = false;

  const newRecords = data.records.map((rec) => {
    if (rec.ruleId === ruleId && rec.status === 'pending' && rec.date > completedDate) {
      // 0. Check advance-reminder cycle completion
      if (
        rule.remindAdvanceDays &&
        rule.remindAdvanceDays > 0 &&
        ((completedTargetDate && rec.targetDate === completedTargetDate) ||
          (completedTargetDate && rec.date <= completedTargetDate))
      ) {
        changed = true;
        return {
          ...rec,
          status: 'skipped' as const,
          advanceDoneSkipped: true,
          feedback: rec.feedback
            ? `${rec.feedback} (已提前完成)`
            : `已于 ${completedDate} 提前完成，本轮免提醒`,
        };
      }

      // 1. Check weekly limit
      if (rule.weeklyLimit && rule.weeklyLimit > 0) {
        if (rec.date >= startOfWeek && rec.date <= endOfWeek) {
          changed = true;
          return {
            ...rec,
            status: 'skipped' as const,
            weeklyLimitReached: true,
            feedback: rec.feedback ? `${rec.feedback} (本周已达${rule.weeklyLimit}次上限)` : `本周已完成${rule.weeklyLimit}次，后续免提醒`,
          };
        }
      }

      // 2. Check monthly limit
      if (rule.monthlyLimit && rule.monthlyLimit > 0) {
        if (rec.date.startsWith(monthPrefix)) {
          changed = true;
          return {
            ...rec,
            status: 'skipped' as const,
            monthlyLimitReached: true,
            feedback: rec.feedback ? `${rec.feedback} (当月已达${rule.monthlyLimit}次上限)` : `当月已完成${rule.monthlyLimit}次，免提醒`,
          };
        }
      }

      // 3. Check solar term limit
      if (rule.solarTermLimit && rule.solarTermLimit > 0) {
        if (rec.date >= solarTermWindow.startDate && rec.date <= solarTermWindow.endDate) {
          changed = true;
          return {
            ...rec,
            status: 'skipped' as const,
            solarTermLimitReached: true,
            feedback: rec.feedback
              ? `${rec.feedback} (${solarTermWindow.name}节气已达${rule.solarTermLimit}次)`
              : `【${solarTermWindow.name}】节气已达${rule.solarTermLimit}次上限，免提醒`,
          };
        }
      }
    }
    return rec;
  });

  if (!changed) return data;

  const updated: AppDataBackup = {
    ...data,
    records: newRecords,
    _savedAt: Date.now(),
  };
  saveDataToLocalStorage(updated);
  return updated;
}

// Keep skipFutureMonthlyLimitRecords as alias for backwards-compatibility
export function skipFutureMonthlyLimitRecords(
  data: AppDataBackup,
  ruleId: string,
  completedDate: string,
  completedTargetDate?: string
): AppDataBackup {
  return skipFutureLimitRecords(data, ruleId, completedDate, completedTargetDate);
}

