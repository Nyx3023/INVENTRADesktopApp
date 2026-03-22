import { XMarkIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { formatCurrency, formatDate } from '../../utils/formatters';
import ModalPortal from '../common/ModalPortal';

const DeleteConfirmationModal = ({ transaction, onConfirm, onCancel }) => {
  if (!transaction) return null;

  // formatDate is now imported from utils/formatters.js

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <ArchiveBoxIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Archive Transaction
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Move transaction to archives
            </p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Transaction Details</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">ID:</span>
              <span className="font-mono text-gray-900 dark:text-white">{transaction.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Date:</span>
              <span className="text-gray-900 dark:text-white">{formatDate(transaction.timestamp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Amount:</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(transaction.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Items:</span>
              <span className="text-gray-900 dark:text-white">{transaction.items?.length || 0} items</span>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <div className="flex">
            <ArchiveBoxIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">Archive Information</h4>
              <div className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Transaction will be moved to archives</li>
                  <li>It will be automatically deleted after 60 days</li>
                  <li>You can restore it from the Archives page before then</li>
                  <li>Only administrators can archive transactions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
          >
            Archive Transaction
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default DeleteConfirmationModal; 