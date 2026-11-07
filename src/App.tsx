/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppDataBackup, TaskRecord, TaskRule } from './types';
import {
  loadInitialData,
  saveDataToLocalStorage,
  isRuleScheduledForDate,
  deleteRuleAndPendingRecords,
  skipFutureMonthlyLimitRecords,
  getTodayString,
} from './services/dataStorage';
import { Navbar, ActiveTab } from './components/Navbar';
import { TaskRemindersView } from './components/TaskRemindersView';
import { AnalyticsView } from './components/AnalyticsView';
import { RuleManagerView } from './components/RuleManagerView';
import { TemplateOptimizationModal } from './components/TemplateOptimizationModal';
import { DataImportExportModal } from './components/DataImportExportModal';
import {
  CalendarCheck2,
  FolderOpen,
  Plus,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  const [data, setData] = useState<AppDataBackup | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [currentDate, setCurrentDate] = useState<string>(() => getTodayString());
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isOptimizationOpen, setIsOptimizationOpen] = useState(false);

  // Load initial data on mount (defaults to empty unless user previously imported or saved)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const loaded = await loadInitialData();
        if (mounted) {
          setData(loaded);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Ensure records exist for the selected date if rules exist
  useEffect(() => {
    if (!data || !data.rules || data.rules.length === 0) return;

    const existingRecordRuleIds = new Set(
      data.records.filter((r) => r.date === currentDate).map((r) => r.ruleId)
    );

    const missingRules = data.rules.filter(
      (rule) => rule.active && isRuleScheduledForDate(rule, currentDate, data.records) && !existingRecordRuleIds.has(rule.id)
    );

    if (missingRules.length > 0) {
      const newRecords: TaskRecord[] = missingRules.map((r) => ({
        id: `${r.id}_${currentDate}`,
        ruleId: r.id,
        name: r.name,
        platform: r.platform,
        category: r.category,
        date: currentDate,
        expected: r.amount || 0,
        currency: r.currency,
        status: 'pending',
        actual: 0,
        received: false,
        path: r.path,
        notes: r.notes,
        priority: r.priority,
        createdAt: new Date().toISOString(),
      }));

      setData((prev) => {
        if (!prev) return prev;
        const updated: AppDataBackup = {
          ...prev,
          records: [...prev.records, ...newRecords],
        };
        saveDataToLocalStorage(updated);
        return updated;
      });
    }
  }, [currentDate, data?.rules]);

  // Update a single record (supports auto-skipping remaining days in month if monthly limit reached)
  const handleUpdateRecord = useCallback((updated: TaskRecord, skipRestOfMonth?: boolean) => {
    setData((prev) => {
      if (!prev) return prev;
      const index = prev.records.findIndex((r) => r.id === updated.id);
      let newRecords: TaskRecord[];
      if (index >= 0) {
        newRecords = [...prev.records];
        newRecords[index] = updated;
      } else {
        newRecords = [...prev.records, updated];
      }
      let nextData: AppDataBackup = { ...prev, records: newRecords };

      const rule = prev.rules.find((r) => r.id === updated.ruleId);
      const shouldSkipMonth =
        skipRestOfMonth ||
        (updated.status === 'done' && !!rule?.monthlyLimit && rule.monthlyLimit > 0);

      if (shouldSkipMonth) {
        nextData = skipFutureMonthlyLimitRecords(nextData, updated.ruleId, updated.date);
      } else {
        saveDataToLocalStorage(nextData);
      }

      return nextData;
    });
  }, []);

  // One-click skip rest of month
  const handleSkipMonthRemaining = useCallback((ruleId: string, fromDate: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return skipFutureMonthlyLimitRecords(prev, ruleId, fromDate);
    });
  }, []);

  // Batch update records
  const handleBatchUpdateRecords = useCallback((updatedList: TaskRecord[]) => {
    setData((prev) => {
      if (!prev) return prev;
      const map = new Map<string, TaskRecord>();
      updatedList.forEach((r) => map.set(r.id, r));

      const newRecords = prev.records.map((r) => (map.has(r.id) ? map.get(r.id)! : r));
      const nextData: AppDataBackup = { ...prev, records: newRecords };
      saveDataToLocalStorage(nextData);
      return nextData;
    });
  }, []);

  // Rules management handlers
  const handleAddRule = useCallback((newRule: TaskRule) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextData: AppDataBackup = {
        ...prev,
        rules: [newRule, ...prev.rules],
      };
      saveDataToLocalStorage(nextData);
      return nextData;
    });
  }, []);

  const handleUpdateRule = useCallback((updatedRule: TaskRule) => {
    setData((prev) => {
      if (!prev) return prev;
      // If updatedRule has an endDate, automatically prune any pending records beyond that endDate
      let newRecords = prev.records;
      if (updatedRule.endDate) {
        newRecords = newRecords.filter((rec) => {
          if (rec.ruleId === updatedRule.id && rec.status === 'pending' && rec.date > updatedRule.endDate!) {
            return false;
          }
          return true;
        });
      }

      const nextData: AppDataBackup = {
        ...prev,
        rules: prev.rules.map((r) => (r.id === updatedRule.id ? updatedRule : r)),
        records: newRecords,
      };
      saveDataToLocalStorage(nextData);
      return nextData;
    });
  }, []);

  // Cascading rule deletion: automatically purges subsequent pending tasks
  const handleDeleteRuleWithCascade = useCallback((ruleId: string, fromDate?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const { updatedData } = deleteRuleAndPendingRecords(prev, ruleId, fromDate);
      return updatedData;
    });
  }, []);

  // Load new dataset
  const handleDataLoaded = useCallback((newData: AppDataBackup) => {
    setData(newData);
    setCurrentDate(getTodayString());
  }, []);

  // Pending count for navbar badge
  const pendingCountForToday = useMemo(() => {
    if (!data) return 0;
    return data.records.filter((r) => r.date === currentDate && r.status === 'pending').length;
  }, [data, currentDate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-600">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-semibold">正在载入应用...</p>
      </div>
    );
  }

  const hasData = !!data && data.rules.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingCount={pendingCountForToday}
        totalRulesCount={data?.rules.length || 0}
        totalRecordsCount={data?.records.length || 0}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onOpenOptimization={() => setIsOptimizationOpen(true)}
        currentDate={currentDate}
      />

      {/* Main Content Area: dense padding on mobile for maximum viewport efficiency */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-6">
        {hasData ? (
          <>
            {activeTab === 'tasks' && (
              <TaskRemindersView
                data={data!}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                onUpdateRecord={handleUpdateRecord}
                onBatchUpdateRecords={handleBatchUpdateRecords}
                onSkipMonthRemaining={handleSkipMonthRemaining}
                onNavigateToTab={(tab) => setActiveTab(tab as ActiveTab)}
              />
            )}

            {activeTab === 'analytics' && <AnalyticsView data={data!} />}

            {activeTab === 'rules' && (
              <RuleManagerView
                rules={data!.rules}
                records={data!.records}
                currentDate={currentDate}
                onAddRule={handleAddRule}
                onUpdateRule={handleUpdateRule}
                onDeleteRuleWithCascade={handleDeleteRuleWithCascade}
              />
            )}
          </>
        ) : (
          /* Empty Initial State: Clear prompt to import user's data or start fresh */
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center max-w-lg mx-auto my-12 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">当前任务数据为空</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              系统当前未预置任何任务数据。您可以点击下方按钮导入您之前的 JSON 备份文件，或者直接创建第一条周期任务规则。
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsImportExportOpen(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                导入我的备份数据
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('rules')}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                手动创建周期规则
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>周期任务与收益提醒助手 · 纯现金收益大屏与周期任务管理</span>
          <div className="flex items-center gap-4">
            {hasData && (
              <button
                type="button"
                onClick={() => setIsOptimizationOpen(true)}
                className="hover:text-indigo-600 transition-colors"
              >
                模版优化诊断
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsImportExportOpen(true)}
              className="hover:text-indigo-600 transition-colors"
            >
              数据导入/导出
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {data && (
        <>
          <TemplateOptimizationModal
            isOpen={isOptimizationOpen}
            onClose={() => setIsOptimizationOpen(false)}
            data={data}
          />

          <DataImportExportModal
            isOpen={isImportExportOpen}
            onClose={() => setIsImportExportOpen(false)}
            currentData={data}
            onDataLoaded={handleDataLoaded}
          />
        </>
      )}
    </div>
  );
}
