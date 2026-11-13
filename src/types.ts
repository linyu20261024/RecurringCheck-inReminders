/**
 * Type definitions for Periodic Task & Yield Assistant
 */

export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lunar' | 'solar' | 'once' | 'interval';

export type CurrencyType = 'CNY' | 'points' | 'other';

export type PriorityType = '高' | '中' | '低';

export type TaskStatus = 'pending' | 'done' | 'skipped' | 'canceled';

export interface TaskRule {
  id: string;
  name: string;
  platform: string;
  category: string; // '签到' | '收益任务' | '限时活动' | '投资/理财' | '纪念/生日' | etc.
  frequency: FrequencyType;
  startDate: string; // YYYY-MM-DD (开始日期)
  endDate?: string;   // YYYY-MM-DD (结束日期，留空或未定义表示长期有效)
  time?: string;      // HH:mm
  deadline?: string;  // HH:mm
  weekdays?: number[]; // [0..6] (0 = Sunday, 1 = Monday...)
  monthdays?: number[]; // [1..31] 公历日期
  solarMonths?: number[]; // [1..12] 公历年度月份 (用于 yearly 公历生日/纪念日，如 [5] + monthdays:[20] = 每年5月20日)
  lunarMonthdays?: number[]; // [1..30] 农历日期 (例: 1 为初一, 15 为十五)
  lunarMonths?: number[]; // [1..12] 农历月份 (为空表示农历每月都触发；非空表示年度农历某月某日，如 [5] + [23] = 每年农历五月廿三)
  lunarIncludeLeapMonth?: boolean; // 遇到农历闰月时是否同样提醒（默认 false，生日等场景不重复提醒）
  lunarLastDayPolicy?: 'skip' | 'lastDay'; // 设定农历三十遇到小月(29天)时的策略：lastDay=廿九提前触发，skip=跳过
  remindAdvanceDays?: number; // 提前多少天开始倒计时提醒 (0 或 undefined 表示仅正日提醒，N>0 表示提前N天至正日每天提醒)
  solarTerms?: string[]; // e.g. ['立春', '雨水', '立冬', '小雪'...] (中国24节气)
  monthPolicy?: 'skip' | 'lastDay' | string;
  intervalN?: number;
  unit?: 'day' | 'week' | 'month' | 'year' | string;
  yearMonth?: number;
  yearDay?: number;
  amount: number;
  currency: CurrencyType;
  priority: PriorityType;
  active: boolean;
  timeSensitive?: boolean; // 是否时间敏感（如特定时间点抢券/限时活动，列表将优先置顶提醒）
  monthlyLimit?: number; // 自然月内最多完成次数 (例: 1 表示当月做满 1 次后后续自动免提醒)
  weeklyLimit?: number;  // 自然周内最多完成次数 (例: 1 表示本周做满 1 次后本周后续触发日自动免提醒)
  solarTermLimit?: number; // 每个节气周期内最多完成次数 (例: 1 表示每到立冬、小雪等节气期间只做 1 次，做完免提醒)
  path?: string;      // App internal navigation path
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
  time?: string;      // HH:mm 预设执行时间 (如 08:00, 10:00)
  deadline?: string;  // HH:mm 截止时间 (如 23:59)
  timeSensitive?: boolean; // 是否时间敏感任务
  targetDate?: string; // 对应目标正日的公历日期 (YYYY-MM-DD)，用于提前提醒倒计时
  daysUntilTarget?: number; // 距离目标正日还有多少天 (0=正日当天，>0=提前提醒倒计时)
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
  monthlyLimitReached?: boolean; // 当月已达完成次数上限
  weeklyLimitReached?: boolean;  // 当周已达完成次数上限
  solarTermLimitReached?: boolean; // 当期节气已达完成次数上限
  advanceDoneSkipped?: boolean; // 已在提前提醒期间完成，本轮后续免提醒
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
