import React, { useRef } from 'react';
import type { WorkoutEntry } from '../types/workout';
import { X, Download, Upload, FileSpreadsheet, FileJson } from 'lucide-react';

interface DataExportImportProps {
  isOpen: boolean;
  entries: WorkoutEntry[];
  onClose: () => void;
  onImportData: (newEntries: WorkoutEntry[]) => void;
}

export const DataExportImport: React.FC<DataExportImportProps> = ({
  isOpen,
  entries,
  onClose,
  onImportData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IronPeriod_Workout_Data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Mesocycle', 'Microcycle', 'Status', 'Workout', 'PR Record', 'Diet Notes'];
    const rows = entries.map(e => [
      `"${e.displayDate}"`,
      `"${e.mesocycle}"`,
      `"${e.microcycle}"`,
      `"${e.status || ''}"`,
      `"${(e.workout || '').replace(/"/g, '""')}"`,
      `"${(e.pr || '').replace(/"/g, '""')}"`,
      `"${(e.diet || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IronPeriod_Workout_Data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            onImportData(parsed);
            alert(`Successfully imported ${parsed.length} workout logs!`);
            onClose();
          }
        } else {
          alert('CSV import preview available. Recommended format is JSON export.');
        }
      } catch (err) {
        alert('Invalid file format. Please upload a valid JSON backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md glass-panel p-6 md:p-8 space-y-6 border-emerald-500/40">
        
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Data Management</h3>
              <p className="text-xs text-slate-400 font-medium">Backup or restore your periodization log</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-[var(--text-muted)] uppercase">
            Export Data Backup ({entries.length} days)
          </label>

          <button
            onClick={handleExportJSON}
            className="w-full btn-secondary justify-start p-3 text-sm font-bold border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
          >
            <FileJson className="w-5 h-5 text-rose-400" />
            Export Full JSON Backup
          </button>

          <button
            onClick={handleExportCSV}
            className="w-full btn-secondary justify-start p-3 text-sm font-bold border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Export CSV for Microsoft Excel
          </button>
        </div>

        <div className="pt-4 border-t border-[var(--border-color)] space-y-3">
          <label className="block text-xs font-bold text-[var(--text-muted)] uppercase">
            Restore / Import Data
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,.csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full btn-secondary justify-start p-3 text-sm font-bold border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
          >
            <Upload className="w-5 h-5 text-blue-400" />
            Upload & Restore JSON File
          </button>
        </div>

      </div>
    </div>
  );
};
