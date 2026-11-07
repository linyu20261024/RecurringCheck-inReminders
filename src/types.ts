/**
 * Type definitions for Periodic Task & Yield Assistant
 */

export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'solar' | 'once' | 'interval';

export type CurrencyType = 'CNY' | 'points' | 'other';

export type PriorityType = '高' | '中' | '低';

export type TaskStatus = 'pending' | 'done' | 'skipped' | 'canceled';

export interface TaskRule {
  id: string;
  name: string;
  platform: string;
  category: string; // '签到' | '收益任务' | '限时活动' | '投资/理财' | etc.
  frequency: FrequencyType;
  startDate: string; // YYYY-MM-DD (开始日期)
  endDate?: string;   // YYYY-MM-DD (结束日期，留空或未定义表示长期有效)
  time?: string;      // HH:mm
  deadline?: string;  // HH:mm
  weekdays?: number[]; // [0..6] (0 = Sunday, 1 = Monday...)
  monthdays?: number[]; // [1..31]
  solarTerms?: string[]; // e.g. ['立冬', '小雪']
  monthPolicy?: 'skip' | 'lastDay' | string;
  intervalN?: number;
  unit?: 'day' | 'week' | 'month' | 'year' | string;
  yearMonth?: number;
  yearDay?: number;
  amount: number;
  currency: CurrencyType;
  priority: PriorityType;
  active: boolean;
  monthlyLimit?: number; // 自然月内最多完成次数，例如 1 表示当月完成 1 次后，本月后续触发日自动不再提醒
  path?: string;      // App internal navigation path e.g. "赚现金->签到"
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskRecord {
  id: string;
  ruleId: string;
  name: string;
  platform: string;
  category: string;
  date: string;       // YYYY-MM-DD
  plannedAt?: string;
  deadlineAt?: string;
  expected?: number;
  currency: CurrencyType;
  status: TaskStatus;
  actual?: number;
  received?: boolean;
  completedAt?: string;
  feedback?: string;  // e.g. formula notes like "0.8*2=1.6"
  path?: string;
  notes?: string;
  priority?: PriorityType;
  monthlyLimitReached?: boolean; // 当月已达完成次数上限，本月后续待办已标记/免提醒
  createdAt?: string;
}

export interface AppDataBackup {
  version: number;
  rules: TaskRule[];
  records: TaskRecord[];
  _savedAt?: number;
}

export interface OptimizationDiagnosis {
  totalRules: number;
  totalRecords: number;
  rawJsonSizeBytes: number;
  optimizedJsonSizeBytes: number;
  compressionRatio: number;
  redundantRecordFields: string[];
  redundantScheduleFieldsCount: number;
  zeroAmountRuleCount: number;
  unrecordedActualCount: number;
  platformCount: number;
  orphanedRecordsCount: number;
}
