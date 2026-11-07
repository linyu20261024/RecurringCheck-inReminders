import { AppDataBackup, TaskRule, TaskRecord, OptimizationDiagnosis } from '../types';

const STORAGE_KEY = 'periodic_tasks_app_data_v2';
export const DEFAULT_BACKUP_PATH = '/assets/aistudio/_______2026-11-06_defd55f3.json';

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
  const rules = Array.isArray(obj.rules) ? (obj.rules as TaskRule[]) : [];
  const records = Array.isArray(obj.records) ? (obj.records as TaskRecord[]) : [];

  return {
    version: typeof obj.version === 'number' ? obj.version : 2,
    rules: rules.map((r, i) => ({
      id: r.id || `rule_${Date.now()}_${i}`,
      name: r.name || '未命名任务',
      platform: r.platform || '其他',
      category: r.category || '签到',
      frequency: r.frequency || 'daily',
      startDate: r.startDate || getTodayString(),
      endDate: r.endDate && r.endDate.trim() ? r.endDate.trim() : undefined,
      time: r.time || '09:00',
      deadline: r.deadline || '23:59',
      weekdays: Array.isArray(r.weekdays) ? r.weekdays : [],
      monthdays: Array.isArray(r.monthdays) ? r.monthdays : [],
      solarTerms: Array.isArray(r.solarTerms) ? r.solarTerms : [],
      monthPolicy: r.monthPolicy || 'skip',
      intervalN: typeof r.intervalN === 'number' ? r.intervalN : 1,
      unit: r.unit || 'day',
      amount: typeof r.amount === 'number' ? r.amount : 0,
      currency: r.currency || 'CNY',
      priority: r.priority || '中',
      active: r.active !== false,
      monthlyLimit: typeof r.monthlyLimit === 'number' && r.monthlyLimit > 0 ? r.monthlyLimit : undefined,
      path: r.path || '',
      notes: r.notes || '',
      createdAt: r.createdAt || new Date().toISOString(),
      updatedAt: r.updatedAt || new Date().toISOString(),
    })),
    records: records.map((rec, i) => ({
      id: rec.id || `record_${Date.now()}_${i}`,
      ruleId: rec.ruleId,
      name: rec.name || '',
      platform: rec.platform || '其他',
      category: rec.category || '签到',
      date: rec.date || getTodayString(),
      plannedAt: rec.plannedAt,
      deadlineAt: rec.deadlineAt,
      expected: typeof rec.expected === 'number' ? rec.expected : 0,
      currency: rec.currency || 'CNY',
      status: rec.status || 'pending',
      actual: typeof rec.actual === 'number' ? rec.actual : 0,
      received: !!rec.received,
      completedAt: rec.completedAt,
      feedback: rec.feedback || '',
      path: rec.path || '',
      notes: rec.notes || '',
      priority: rec.priority || '中',
      monthlyLimitReached: !!rec.monthlyLimitReached,
      createdAt: rec.createdAt,
    })),
    _savedAt: Date.now(),
  };
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

// Check if a rule is scheduled for a given date string (YYYY-MM-DD)
// Strictly honors startDate, endDate, and monthlyLimit (e.g. once per natural month)
export function isRuleScheduledForDate(
  rule: TaskRule,
  dateStr: string,
  existingRecords?: TaskRecord[]
): boolean {
  if (!rule.active) return false;
  if (rule.startDate && dateStr < rule.startDate) return false;
  if (rule.endDate && dateStr > rule.endDate) return false;

  // Monthly limit check: e.g. "每周五触发但一个自然月只能做1次"
  if (rule.monthlyLimit && rule.monthlyLimit > 0 && existingRecords) {
    const monthPrefix = dateStr.slice(0, 7);
    const doneInMonth = existingRecords.filter(
      (r) => r.ruleId === rule.id && r.status === 'done' && r.date.startsWith(monthPrefix)
    );
    // If user already completed this rule on an earlier date of the same month
    if (doneInMonth.length >= rule.monthlyLimit) {
      // If there is already a done record on THIS exact date, keep it visible
      const isDoneOnThisDate = doneInMonth.some((r) => r.date === dateStr);
      if (!isDoneOnThisDate) {
        return false; // Monthly cap reached! Do not schedule or remind subsequent dates in this month
      }
    }
  }

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
    case 'monthly':
      if (rule.monthdays && rule.monthdays.length > 0) {
        return rule.monthdays.includes(dayOfMonth);
      }
      return dayOfMonth === 1;
    case 'solar':
      return true;
    case 'once':
      return rule.startDate === dateStr;
    case 'interval':
      return true;
    default:
      return true;
  }
}

// Automatically skip or suppress subsequent pending records of a rule in the same natural month
export function skipFutureMonthlyLimitRecords(
  data: AppDataBackup,
  ruleId: string,
  completedDate: string
): AppDataBackup {
  const monthPrefix = completedDate.slice(0, 7);
  let changed = false;

  const newRecords = data.records.map((rec) => {
    if (rec.ruleId === ruleId && rec.date.startsWith(monthPrefix) && rec.date > completedDate) {
      if (rec.status === 'pending') {
        changed = true;
        return {
          ...rec,
          status: 'skipped' as const,
          monthlyLimitReached: true,
          feedback: rec.feedback ? `${rec.feedback} (当月已达1次上限)` : '当月已完成，免提醒',
        };
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

