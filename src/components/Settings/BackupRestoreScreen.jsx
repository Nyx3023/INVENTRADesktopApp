import { useState, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  ArchiveBoxArrowDownIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ShieldExclamationIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import ModalPortal from '../common/ModalPortal';

const CONFIRM_PHRASE = 'I CONFIRM THE DELETION';

const DELETE_OPTIONS = [
  { key: 'transactions',      label: 'Transactions & Sales History', description: 'All sales transactions and transaction items', color: 'orange' },
  { key: 'products',          label: 'Products',                      description: 'All products and deleted products records',   color: 'blue'   },
  { key: 'product_images',    label: 'Product Images',                description: 'All uploaded product image files',            color: 'purple' },
  { key: 'categories',        label: 'Categories',                    description: 'All product categories',                     color: 'green'  },
  { key: 'suppliers',         label: 'Suppliers',                     description: 'All supplier records',                       color: 'cyan'   },
  { key: 'purchase_orders',   label: 'Purchase Orders',               description: 'All purchase orders and their items',         color: 'indigo' },
  { key: 'stock_adjustments', label: 'Stock Adjustments',             description: 'All inventory adjustment records',            color: 'pink'   },
  { key: 'activity_logs',     label: 'Activity Logs',                 description: 'All system activity log entries',             color: 'gray'   },
  { key: 'audit_logs',        label: 'Audit Logs',                    description: 'All inventory audit records',                 color: 'yellow' },
];

const colorMap = {
  orange: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  blue:   'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  green:  'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  cyan:   'bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  pink:   'bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  gray:   'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
};

export default function BackupRestoreScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // Backup
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem('lastBackupTime') || null);

  // Restore
  const [restoreFile, setRestoreFile] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // Delete
  const [selectedCategories, setSelectedCategories] = useState({});
  const [deleteStep, setDeleteStep] = useState(0); // 0=idle, 1=warn, 2=confirm
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);



  // ── Backup ────────────────────────────────────────────────
  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const res = await fetch(`/api/backup/create?adminId=${user?.id}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const now = new Date();
      const filename = `INVENTRA-backup-${now.toISOString().split('T')[0]}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const timeStr = now.toLocaleString();
      localStorage.setItem('lastBackupTime', timeStr);
      setLastBackup(timeStr);
      toast.success('Backup created and downloaded!');
    } catch (err) {
      toast.error('Backup failed: ' + err.message);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // ── Restore ───────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      toast.error('Please select a valid INVENTRA backup (.zip) file');
      return;
    }
    setRestoreFile(file);
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setIsRestoring(true);
    setShowRestoreConfirm(false);
    try {
      const formData = new FormData();
      formData.append('backup', restoreFile);
      if (user?.id) formData.append('adminId', user.id);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      toast.success('Backup restored successfully! Please refresh the app.');
      setRestoreFile(null);
    } catch (err) {
      toast.error('Restore failed: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const toggleCategory = (key) => {
    setSelectedCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    const all = {};
    DELETE_OPTIONS.forEach(o => { all[o.key] = true; });
    setSelectedCategories(all);
  };

  const deselectAll = () => setSelectedCategories({});

  const selectedCount = Object.values(selectedCategories).filter(Boolean).length;
  const selectedKeys = DELETE_OPTIONS.filter(o => selectedCategories[o.key]).map(o => o.key);

  const handleDeleteConfirmed = async () => {
    if (confirmPhrase !== CONFIRM_PHRASE) {
      toast.error(`Please type exactly: ${CONFIRM_PHRASE}`);
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch('/api/backup/delete-selective', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ categories: selectedKeys, adminPassword, confirmText: confirmPhrase, adminId: user?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deletion failed');
      toast.success(`Successfully deleted: ${selectedKeys.join(', ')}`);
      setDeleteStep(0);
      setSelectedCategories({});
      setConfirmPhrase('');
      setAdminPassword('');
    } catch (err) {
      toast.error('Deletion failed: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetDeleteFlow = () => {
    setDeleteStep(0);
    setConfirmPhrase('');
    setAdminPassword('');
    setShowPassword(false);
  };

  return (
    <div className="space-y-6">
      {/* ── Panel 1: Create Backup ── */}
      <div className={`${colors.card.primary} rounded-2xl shadow border ${colors.border.primary} p-6`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-3 bg-teal-100 dark:bg-teal-900/30 rounded-xl">
            <ArchiveBoxArrowDownIcon className="h-7 w-7 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex-1">
            <h2 className={`text-lg font-semibold ${colors.text.primary}`}>Create Backup</h2>
            <p className={`text-sm ${colors.text.secondary} mt-1`}>
              Downloads a complete backup of your database and all product images as a single <code>.zip</code> file.
            </p>
            {lastBackup && (
              <p className={`text-xs ${colors.text.tertiary} mt-2 flex items-center gap-1`}>
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                Last backup: {lastBackup}
              </p>
            )}
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="mt-4 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-600/20"
            >
              <ArchiveBoxArrowDownIcon className="h-5 w-5" />
              {isCreatingBackup ? 'Creating Backup...' : 'Download Backup'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Panel 2: Restore Backup ── */}
      <div className={`${colors.card.primary} rounded-2xl shadow border ${colors.border.primary} p-6`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <ArrowUpTrayIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className={`text-lg font-semibold ${colors.text.primary}`}>Restore from Backup</h2>
            <p className={`text-sm ${colors.text.secondary} mt-1`}>
              Select an INVENTRA backup <code>.zip</code> file to restore. <strong>This will overwrite all current data.</strong>
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`px-4 py-2.5 border-2 border-dashed rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${colors.border.primary} ${colors.text.secondary} hover:${colors.text.primary} hover:border-blue-400`}
              >
                <ArrowUpTrayIcon className="h-5 w-5" />
                {restoreFile ? restoreFile.name : 'Choose Backup File'}
              </button>
              {restoreFile && (
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  disabled={isRestoring}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-600/20"
                >
                  <ArrowUpTrayIcon className="h-5 w-5" />
                  {isRestoring ? 'Restoring...' : 'Restore Now'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Panel 3: Danger Zone ── */}
      <div className="rounded-2xl shadow border-2 border-red-300 dark:border-red-800 p-6 bg-red-50/50 dark:bg-red-950/10">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <ShieldExclamationIcon className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Danger Zone — Reset Data</h2>
            <p className={`text-sm ${colors.text.secondary} mt-1`}>
              Permanently delete selected data categories. This action <strong>cannot be undone</strong>.
            </p>
          </div>
        </div>

        {/* Category Checkboxes */}
        <div className="flex gap-3 mb-4">
          <button onClick={selectAll} className={`text-xs px-3 py-1.5 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.text.primary} transition-colors`}>Select All</button>
          <button onClick={deselectAll} className={`text-xs px-3 py-1.5 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.text.primary} transition-colors`}>Deselect All</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {DELETE_OPTIONS.map(opt => (
            <label
              key={opt.key}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                selectedCategories[opt.key]
                  ? `${colorMap[opt.color]} border-2`
                  : `${colors.card.primary} ${colors.border.primary} hover:${colors.bg.secondary}`
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded accent-red-600 flex-shrink-0"
                checked={!!selectedCategories[opt.key]}
                onChange={() => toggleCategory(opt.key)}
              />
              <div>
                <p className={`text-sm font-medium ${colors.text.primary}`}>{opt.label}</p>
                <p className={`text-xs ${colors.text.secondary} mt-0.5`}>{opt.description}</p>
              </div>
            </label>
          ))}
        </div>

        <button
          disabled={selectedCount === 0}
          onClick={() => setDeleteStep(1)}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
        >
          <TrashIcon className="h-5 w-5" />
          Delete {selectedCount > 0 ? `${selectedCount} Selected` : 'Selected'}
        </button>
      </div>

      {/* ── Restore Confirm Modal ── */}
      {showRestoreConfirm && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}>
              <div className="flex items-center gap-4 p-6 border-b border-yellow-200 dark:border-yellow-800">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Confirm Restore</h3>
                  <p className={`text-sm ${colors.text.secondary}`}>This will overwrite your current data</p>
                </div>
                <button onClick={() => setShowRestoreConfirm(false)} className="ml-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl mb-6">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>Warning:</strong> All existing data (products, transactions, users, etc.) will be replaced with the backup contents. Make sure you have a recent backup of your current data before proceeding.
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowRestoreConfirm(false)} className={`px-4 py-2 rounded-xl border ${colors.border.primary} ${colors.text.secondary}`}>
                    Cancel
                  </button>
                  <button onClick={handleRestore} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center gap-2">
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    Yes, Restore
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Delete Step 1: Warning ── */}
      {deleteStep === 1 && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}>
              <div className="flex items-center gap-4 p-6 border-b border-red-200 dark:border-red-800">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Are You Sure?</h3>
                  <p className={`text-sm ${colors.text.secondary}`}>Step 1 of 2</p>
                </div>
              </div>
              <div className="p-6">
                <p className={`text-sm ${colors.text.primary} mb-4`}>
                  You are about to permanently delete <strong>{selectedCount}</strong> data {selectedCount === 1 ? 'category' : 'categories'}:
                </p>
                <ul className="space-y-1 mb-6">
                  {DELETE_OPTIONS.filter(o => selectedCategories[o.key]).map(o => (
                    <li key={o.key} className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                      <TrashIcon className="h-4 w-4 flex-shrink-0" />
                      {o.label}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3 justify-end">
                  <button onClick={resetDeleteFlow} className={`px-4 py-2 rounded-xl border ${colors.border.primary} ${colors.text.secondary}`}>
                    Cancel
                  </button>
                  <button onClick={() => setDeleteStep(2)} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium">
                    Yes, Continue →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Delete Step 2: Final Confirm ── */}
      {deleteStep === 2 && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}>
              <div className="flex items-center gap-4 p-6 border-b border-red-200 dark:border-red-800">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <ShieldExclamationIcon className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Final Confirmation</h3>
                  <p className={`text-sm text-red-600 dark:text-red-400`}>Step 2 of 2 — This cannot be undone</p>
                </div>
              </div>
              <div className="p-6 space-y-5">
                {/* Admin Password */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                    Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Enter your admin password"
                      className={`w-full pr-10 px-3 py-2.5 border rounded-xl ${colors.input.primary} focus:ring-2 focus:ring-red-500`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirmation Phrase */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                    Type exactly to confirm:
                    <code className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-mono">
                      {CONFIRM_PHRASE}
                    </code>
                  </label>
                  <input
                    type="text"
                    value={confirmPhrase}
                    onChange={(e) => setConfirmPhrase(e.target.value)}
                    placeholder={CONFIRM_PHRASE}
                    className={`w-full px-3 py-2.5 border rounded-xl ${colors.input.primary} focus:ring-2 focus:ring-red-500 font-mono text-sm`}
                  />
                  {confirmPhrase.length > 0 && confirmPhrase !== CONFIRM_PHRASE && (
                    <p className="text-xs text-red-500 mt-1">Phrase does not match</p>
                  )}
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={resetDeleteFlow} className={`px-4 py-2 rounded-xl border ${colors.border.primary} ${colors.text.secondary}`}>
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirmed}
                    disabled={isDeleting || confirmPhrase !== CONFIRM_PHRASE || !adminPassword}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <TrashIcon className="h-4 w-4" />
                    {isDeleting ? 'Deleting...' : 'Delete Now'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
