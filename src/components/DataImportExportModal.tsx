import React, { useState, useRef } from 'react';
import { AppDataBackup } from '../types';
import {
  DEFAULT_BACKUP_PATH,
  normalizeBackupData,
  exportDataAsJson,
  saveDataToLocalStorage,
  formatDate,
  getEmptyBackup,
  clearLocalStorage,
} from '../services/dataStorage';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  Trash2,
  X,
} from 'lucide-react';

interface DataImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: AppDataBackup;
  onDataLoaded: (newData: AppDataBackup) => void;
}

export const DataImportExportModal: React.FC<DataImportExportModalProps> = ({
  isOpen,
  onClose,
  currentData,
  onDataLoaded,
}) => {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Load from preloaded workspace backup file
  const handleLoadSampleFile = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(DEFAULT_BACKUP_PATH);
      if (!res.ok) {
        throw new Error(`加载失败: HTTP ${res.status}`);
      }
      const json = await res.json();
      const normalized = normalizeBackupData(json);
      saveDataToLocalStorage(normalized);
      onDataLoaded(normalized);
      setStatusMsg({
        type: 'success',
        text: `成功导入随附备份数据！包含 ${normalized.rules.length} 条规则、${normalized.records.length} 条打卡记录。`,
      });
    } catch (err) {
      console.error(err);
      setStatusMsg({
        type: 'error',
        text: `读取备份文件失败: ${(err as Error).message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle uploaded JSON file
  const handleFileProcess = (file: File) => {
    if (!file.name.endsWith('.json')) {
      setStatusMsg({ type: 'error', text: '请上传有效的 .json 格式文件' });
      return;
    }

    setLoading(true);
    setStatusMsg(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const normalized = normalizeBackupData(parsed);
        saveDataToLocalStorage(normalized);
        onDataLoaded(normalized);
        setStatusMsg({
          type: 'success',
          text: `成功导入文件 "${file.name}"！包含 ${normalized.rules.length} 条规则、${normalized.records.length} 条打卡记录。`,
        });
      } catch (err) {
        console.error(err);
        setStatusMsg({
          type: 'error',
          text: `JSON 解析失败: ${(err as Error).message || '请检查文件内容是否正确'}`,
        });
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setStatusMsg({ type: 'error', text: '文件读取发生错误' });
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Clear data to empty state
  const handleClearData = () => {
    if (confirm('确定要清空当前所有规则和打卡记录吗？清空后数据恢复为初始空白状态。')) {
      clearLocalStorage();
      const empty = getEmptyBackup();
      onDataLoaded(empty);
      setStatusMsg({ type: 'success', text: '已清空所有本地数据，当前状态为空白。' });
    }
  };

  // Export
  const handleExport = () => {
    exportDataAsJson(currentData, `周期任务备份_${formatDate(new Date())}.json`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">数据导入与备份管理</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">{statusMsg.text}</span>
            </div>
          )}

          {/* Primary: Drag & Drop / Select Local File Upload (Works Everywhere) */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-indigo-300 hover:border-indigo-500 bg-indigo-50/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
            />
            <Upload className="w-8 h-8 text-indigo-600 mx-auto mb-2 opacity-90" />
            <h4 className="text-sm font-bold text-slate-800">
              点击选择或拖拽您的 JSON 备份文件至此
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              支持任意周期任务备份（.json）文件，数据纯本地解析并保存在浏览器中
            </p>
          </div>

          {/* Optional Helper: Load Sample File if present */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">
                  从工作区内置随附文件载入
                </span>
                <span className="text-[11px] text-slate-400">
                  若工作区包含历史样本文件，可一键导入
                </span>
              </div>

              <button
                type="button"
                onClick={handleLoadSampleFile}
                disabled={loading}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 disabled:opacity-50 rounded-xl text-xs font-semibold shadow-2xs transition-colors shrink-0 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                尝试载入
              </button>
            </div>
          </div>

          {/* Current In-Memory Stats */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-600 flex items-center justify-between">
            <span className="font-medium">当前本地数据规模:</span>
            <span className="font-semibold text-slate-800 tabular-nums">
              {currentData.rules.length} 条规则 · {currentData.records.length} 条打卡记录
            </span>
          </div>
        </div>

        {/* Footer with Export & Clear Buttons */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentData.rules.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                导出备份 JSON
              </button>
            )}

            {currentData.rules.length > 0 && (
              <button
                type="button"
                onClick={handleClearData}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1 transition-colors"
                title="清空当前所有本地数据"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空数据
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
