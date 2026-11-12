/**
 * Lunar and 24 Solar Terms (中国二十四节气与农历) Utilities
 * Powered by lunar-javascript
 */

import { Solar, Lunar } from 'lunar-javascript';

// 24 Solar Terms standard names in Chinese calendar chronological order starting with 立春
export const ALL_SOLAR_TERMS = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
] as const;

export type SolarTermName = typeof ALL_SOLAR_TERMS[number];

// Traditional Chinese lunar month numbers (1..12) and labels
export const LUNAR_MONTH_NAMES = [
  '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '冬月', '腊月',
];

// Common traditional lunar days (初一至三十)
export const LUNAR_DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

export interface LunarDateInfo {
  solarDate: string;           // YYYY-MM-DD
  lunarYear: number;           // e.g. 2026
  lunarMonth: number;          // 1..12 (positive; if leap month, isLeap will be true)
  lunarDay: number;            // 1..30
  isLeapMonth: boolean;
  yearGanZhi: string;          // e.g. "丙午"
  yearShengXiao: string;       // e.g. "马"
  monthInChinese: string;      // e.g. "十月" or "闰六月"
  dayInChinese: string;        // e.g. "初四"
  fullLunarString: string;     // e.g. "丙午(马)年十月初四"
  solarTerm?: string;          // If this exact day is the entry day of a solar term (e.g. "立冬")
  currentSolarTerm: {
    name: string;              // The active 24 solar term during this period
    startDate: string;         // When this solar term started (YYYY-MM-DD)
    endDate: string;           // The day before the next solar term (YYYY-MM-DD)
    nextName: string;          // Next solar term name
    nextStartDate: string;     // Next solar term start date
  };
}

/**
 * Get full Lunar and Solar Term details for any given YYYY-MM-DD solar date
 */
export function getLunarDateInfo(dateStr: string): LunarDateInfo {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();

  // If this date is the exact day of a solar term
  const jieQi = lunar.getJieQi(); // returns solar term name string e.g. "立冬" or empty string ""

  // Active current solar term period
  const prevJq = lunar.getPrevJieQi(true);
  const nextJq = lunar.getNextJieQi(true);

  const curJqName = prevJq.getName();
  const curJqStart = prevJq.getSolar().toYmd();
  const nextJqName = nextJq.getName();
  const nextJqStart = nextJq.getSolar().toYmd();

  // Compute end date of current term as day before next term
  const nextDateObj = new Date(`${nextJqStart}T12:00:00`);
  nextDateObj.setDate(nextDateObj.getDate() - 1);
  const y2 = nextDateObj.getFullYear();
  const m2 = String(nextDateObj.getMonth() + 1).padStart(2, '0');
  const d2 = String(nextDateObj.getDate()).padStart(2, '0');
  const curJqEnd = `${y2}-${m2}-${d2}`;

  const isLeap = lunar.getMonth() < 0;
  const absMonth = Math.abs(lunar.getMonth());
  const monthName = (isLeap ? '闰' : '') + lunar.getMonthInChinese() + '月';
  const dayName = lunar.getDayInChinese();

  return {
    solarDate: dateStr,
    lunarYear: lunar.getYear(),
    lunarMonth: absMonth,
    lunarDay: lunar.getDay(),
    isLeapMonth: isLeap,
    yearGanZhi: lunar.getYearInGanZhi(),
    yearShengXiao: lunar.getYearShengXiao(),
    monthInChinese: monthName,
    dayInChinese: dayName,
    fullLunarString: `${lunar.getYearInGanZhi()}(${lunar.getYearShengXiao()})年${monthName}${dayName}`,
    solarTerm: jieQi || undefined,
    currentSolarTerm: {
      name: curJqName,
      startDate: curJqStart,
      endDate: curJqEnd,
      nextName: nextJqName,
      nextStartDate: nextJqStart,
    },
  };
}

/**
 * Get date range for the natural week containing dateStr (Monday to Sunday)
 */
export function getWeekDateRange(dateStr: string): { startOfWeek: string; endOfWeek: string } {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const format = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayOfMonth}`;
  };

  return {
    startOfWeek: format(monday),
    endOfWeek: format(sunday),
  };
}

/**
 * Check if a date string matches a Lunar rule requirement
 * - lunarMonthdays: array of lunar days (1..30)
 * - lunarMonths: optional specific lunar months (1..12), if empty, applies to every lunar month
 */
export function isLunarRuleMatched(
  dateStr: string,
  lunarMonthdays?: number[],
  lunarMonths?: number[]
): boolean {
  if (!lunarMonthdays || lunarMonthdays.length === 0) return false;
  const info = getLunarDateInfo(dateStr);

  if (lunarMonths && lunarMonths.length > 0) {
    if (!lunarMonths.includes(info.lunarMonth)) return false;
  }

  return lunarMonthdays.includes(info.lunarDay);
}
